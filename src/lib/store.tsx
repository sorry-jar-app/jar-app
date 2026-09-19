'use client';

/**
 * The whole app's state, in one reducer.
 *
 * It mirrors the prototype's component state one key at a time, minus the
 * `screen` string — that became real routes. What is left is the data a real
 * backend will own: fines, rules, names, settings, and the in-progress fine
 * draft that /log and /log/one-off share.
 *
 * Persistence is localStorage through lib/storage, behind `persisted` so the
 * draft and the transient cash-out payload do not survive a reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  COIN_CAP,
  COIN_FLOOR,
  DEFAULT_ME,
  DEFAULT_PARTNER,
  DEFAULT_RULES,
  DESTINATIONS,
  NAME_FALLBACK_ME,
  NAME_FALLBACK_PARTNER,
  PEEK_MS,
  SEED_COINS,
  SEED_FINES,
  SEED_NEXT_ID,
  SEED_TOTAL_EVER,
  SEVERITIES,
} from './constants';
import { parseAmount } from './money';
import { loadState, saveState } from './storage';
import type {
  Fine,
  NotificationPrefs,
  PaletteName,
  Person,
  Rule,
  Severity,
} from './types';

/* ── shape ───────────────────────────────────────────────────────────────── */

export type Draft = {
  /** Who the in-progress fine is on. */
  who: Person | null;
  /** Selected rule id, or 'custom' for a one-off. */
  ruleId: string | null;
  sev: Exclude<Severity, 'one-off'>;
  customName: string;
  customAmt: string;
  saveAsRule: boolean;
};

export type CashOut = {
  amt: number;
  dest: string;
  spun: boolean;
};

export type State = {
  me: string;
  partner: string;
  fines: Fine[];
  rules: Rule[];
  nextId: number;
  coins: number;
  totalEver: number;
  notif: NotificationPrefs;
  mystery: boolean;
  palette: PaletteName;
  /** True once the pair step has been passed, either way. */
  onboarded: boolean;

  /* Transient — not persisted. */
  draft: Draft;
  /** The fine the landed screen shows, and the only thing Undo can reverse. */
  lastFine: Fine | null;
  /** True for one render after a fine lands, so the new coin animates. */
  animCoin: boolean;
  dest: string;
  cashOut: CashOut | null;
  /** Which rule the edit screen is on. */
  editingRuleId: string | null;
};

const EMPTY_DRAFT: Draft = {
  who: null,
  ruleId: null,
  sev: 'bad',
  customName: '',
  customAmt: '',
  saveAsRule: false,
};

const INITIAL: State = {
  me: DEFAULT_ME,
  partner: DEFAULT_PARTNER,
  fines: SEED_FINES,
  rules: DEFAULT_RULES.slice(),
  nextId: SEED_NEXT_ID,
  coins: SEED_COINS,
  totalEver: SEED_TOTAL_EVER,
  notif: { fined: true, selfFined: true, milestone: true },
  mystery: false,
  palette: 'Mulberry',
  onboarded: false,

  draft: EMPTY_DRAFT,
  lastFine: null,
  animCoin: false,
  dest: DESTINATIONS[0].id,
  cashOut: null,
  editingRuleId: null,
};

/** The slice that survives a reload. */
type Persisted = Pick<
  State,
  | 'me'
  | 'partner'
  | 'fines'
  | 'rules'
  | 'nextId'
  | 'coins'
  | 'totalEver'
  | 'notif'
  | 'mystery'
  | 'palette'
  | 'onboarded'
>;

function persistedOf(s: State): Persisted {
  return {
    me: s.me,
    partner: s.partner,
    fines: s.fines,
    rules: s.rules,
    nextId: s.nextId,
    coins: s.coins,
    totalEver: s.totalEver,
    notif: s.notif,
    mystery: s.mystery,
    palette: s.palette,
    onboarded: s.onboarded,
  };
}

/* ── actions ─────────────────────────────────────────────────────────────── */

export type Action =
  | { type: 'hydrate'; payload: Partial<Persisted> }
  | { type: 'setName'; person: Person; name: string }
  | { type: 'setPalette'; palette: PaletteName }
  | { type: 'setOnboarded' }
  | { type: 'draft/patch'; patch: Partial<Draft> }
  | { type: 'draft/reset' }
  | { type: 'fine/submit' }
  | { type: 'fine/undo' }
  | { type: 'fine/clearAnim' }
  | { type: 'rule/add'; name: string; price: number }
  | { type: 'rule/edit'; id: string; name: string; price: number }
  | { type: 'rule/delete'; id: string }
  | { type: 'rule/openEditor'; id: string | null }
  | { type: 'dest/set'; dest: string }
  | { type: 'cashout'; pick: number }
  | { type: 'cashout/clear' }
  | { type: 'notif/toggle'; key: keyof NotificationPrefs }
  | { type: 'mystery/toggle' }
  | { type: 'reset' };

/* ── reducer ─────────────────────────────────────────────────────────────── */

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.payload };

    case 'setName': {
      const name = action.name;
      return action.person === 'A'
        ? { ...state, me: name || NAME_FALLBACK_ME }
        : { ...state, partner: name || NAME_FALLBACK_PARTNER };
    }

    case 'setPalette':
      return { ...state, palette: action.palette };

    case 'setOnboarded':
      return { ...state, onboarded: true };

    case 'draft/patch':
      return { ...state, draft: { ...state.draft, ...action.patch } };

    case 'draft/reset':
      return { ...state, draft: EMPTY_DRAFT };

    case 'fine/submit': {
      const d = state.draft;
      if (!d.who || !d.ruleId) return state;

      let amt: number;
      let label: string;
      let sev: Severity;
      let extraRule: Rule | null = null;

      if (d.ruleId === 'custom') {
        amt = parseAmount(d.customAmt);
        if (!amt) return state;
        label = d.customName.trim() || 'Something else';
        sev = 'one-off';
        if (d.saveAsRule) {
          extraRule = { id: 'r' + state.nextId + 'c', name: label, price: amt };
        }
      } else {
        const rule = state.rules.find((r) => r.id === d.ruleId);
        if (!rule) return state;
        const mult = SEVERITIES.find((x) => x.id === d.sev)?.mult ?? 1;
        amt = Math.round(rule.price * mult * 100) / 100;
        label = rule.name;
        sev = d.sev;
      }

      const fine: Fine = {
        id: state.nextId,
        who: d.who,
        by: 'A',
        rule: d.ruleId,
        label,
        sev,
        amt,
        when: 'Just now',
        day: new Date().getDay(),
      };

      return {
        ...state,
        fines: [fine, ...state.fines],
        rules: extraRule ? [...state.rules, extraRule] : state.rules,
        nextId: state.nextId + 1,
        lastFine: fine,
        coins: Math.min(COIN_CAP, state.coins + 1),
        animCoin: true,
        draft: EMPTY_DRAFT,
      };
    }

    case 'fine/undo': {
      if (!state.lastFine) return state;
      const id = state.lastFine.id;
      return {
        ...state,
        fines: state.fines.filter((f) => f.id !== id),
        coins: Math.max(COIN_FLOOR, state.coins - 1),
        lastFine: null,
        animCoin: false,
      };
    }

    case 'fine/clearAnim':
      return state.animCoin ? { ...state, animCoin: false } : state;

    case 'rule/add': {
      if (!action.name || !action.price) return state;
      return {
        ...state,
        rules: [...state.rules, { id: 'r' + state.nextId, name: action.name, price: action.price }],
        nextId: state.nextId + 1,
      };
    }

    case 'rule/edit': {
      if (!action.name || !action.price) return state;
      return {
        ...state,
        rules: state.rules.map((r) =>
          r.id === action.id ? { id: r.id, name: action.name, price: action.price } : r,
        ),
        editingRuleId: null,
      };
    }

    case 'rule/delete':
      return {
        ...state,
        rules: state.rules.filter((r) => r.id !== action.id),
        editingRuleId: null,
      };

    case 'rule/openEditor':
      return { ...state, editingRuleId: action.id };

    case 'dest/set':
      return { ...state, dest: action.dest };

    case 'cashout': {
      const amt = state.fines.reduce((a, f) => a + f.amt, 0);
      const chosen = DESTINATIONS.find((d) => d.id === state.dest) ?? DESTINATIONS[0];
      const pool = DESTINATIONS.filter((d) => d.id !== 'wheel');
      const spun = chosen.id === 'wheel';
      const name = spun ? pool[action.pick % pool.length].name : chosen.name;
      return {
        ...state,
        fines: [],
        coins: COIN_FLOOR,
        totalEver: state.totalEver + amt,
        cashOut: { amt, dest: name, spun },
        lastFine: null,
        animCoin: false,
      };
    }

    case 'cashout/clear':
      return { ...state, cashOut: null };

    case 'notif/toggle':
      return {
        ...state,
        notif: { ...state.notif, [action.key]: !state.notif[action.key] },
      };

    case 'mystery/toggle':
      return { ...state, mystery: !state.mystery };

    case 'reset':
      return { ...INITIAL, palette: state.palette, onboarded: true };

    default:
      return state;
  }
}

/* ── context ─────────────────────────────────────────────────────────────── */

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  /** False until localStorage has been read, so the first paint matches SSR. */
  hydrated: boolean;
  /** True when Mystery jar is on and the user is not mid-Peek. */
  sealed: boolean;
  peeking: boolean;
  peek: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read persisted state after mount — never during render, so the server
  // pass and the first client pass agree.
  useEffect(() => {
    const saved = loadState<Persisted>();
    if (saved) dispatch({ type: 'hydrate', payload: saved });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(persistedOf(state));
  }, [state, hydrated]);

  // The palette is a single attribute write on <html>.
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', state.palette);
  }, [state.palette]);

  const peek = useCallback(() => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeeking(true);
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
  }, []);

  // Clear on unmount, and re-seal the moment Mystery jar is switched off.
  useEffect(() => {
    return () => {
      if (peekTimer.current) clearTimeout(peekTimer.current);
    };
  }, []);

  useEffect(() => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeeking(false);
  }, [state.mystery]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      dispatch,
      hydrated,
      sealed: state.mystery && !peeking,
      peeking,
      peek,
    }),
    [state, hydrated, peeking, peek],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/* ── derived selectors ───────────────────────────────────────────────────── */

/** The jar total, or one person's share of it. */
export function sumFines(fines: Fine[], who?: Person): number {
  return fines.reduce((a, f) => (who && f.who !== who ? a : a + f.amt), 0);
}

export function displayName(state: State, who: Person): string {
  return who === 'A' ? state.me : state.partner;
}

export function initialOf(name: string): string {
  return name.charAt(0);
}
