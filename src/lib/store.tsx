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
  SEED_TOTAL_EVER,
  SEVERITIES,
} from './constants';
import { parseAmount } from './money';
import { loadState, saveState } from './storage';
import { newId } from './id';
import { getSupabase, isSupabaseConfigured } from './supabase/client';
import {
  archiveRule,
  cashOut,
  createJar,
  deleteFine,
  insertFine,
  insertRule,
  joinJar,
  loadFines,
  loadJar,
  loadRules,
  setDisplayName,
  setMemberSettings,
  updateRule,
} from './supabase/api';
import type { JarContext } from './supabase/api';
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

  /**
   * The jar this device is signed in to, or null when running on seed data.
   * Its presence is what switches the app from local demo to real.
   */
  jar: JarContext | null;
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
  jar: null,
};

/** The slice that survives a reload. */
type Persisted = Pick<
  State,
  | 'me'
  | 'partner'
  | 'fines'
  | 'rules'
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
  | { type: 'fine/submit'; id: string; at: string; extraRuleId: string }
  | { type: 'fine/undo' }
  | { type: 'fine/clearAnim' }
  | { type: 'rule/add'; id: string; name: string; price: number }
  | { type: 'rule/edit'; id: string; name: string; price: number }
  | { type: 'rule/delete'; id: string }
  | { type: 'rule/openEditor'; id: string | null }
  | { type: 'dest/set'; dest: string }
  | { type: 'cashout'; pick: number }
  | { type: 'cashout/clear' }
  | { type: 'notif/toggle'; key: keyof NotificationPrefs }
  | { type: 'mystery/toggle' }
  | { type: 'remote/hydrate'; jar: JarContext; rules: Rule[]; fines: Fine[] }
  | { type: 'remote/clear' }
  | { type: 'reset' };

/**
 * What screens dispatch. Ids and timestamps are filled in by the provider's
 * dispatch wrapper, so a screen never has to mint one and the reducer stays
 * pure.
 */
export type UiAction =
  | Exclude<
      Action,
      | { type: 'fine/submit' }
      | { type: 'rule/add' }
      | { type: 'remote/hydrate' }
      | { type: 'remote/clear' }
      | { type: 'hydrate' }
    >
  | { type: 'fine/submit' }
  | { type: 'rule/add'; name: string; price: number };

/**
 * Build the fine the current draft describes.
 *
 * Pure, and shared: the reducer applies it optimistically and the sync layer
 * sends the very same row to Postgres. Both need the pricing and labelling
 * rules, and they must not be allowed to drift apart. The id and timestamp are
 * passed in rather than generated here — see lib/id.
 */
export function buildFine(
  state: State,
  id: string,
  at: string,
  extraRuleId: string,
): { fine: Fine; extraRule: Rule | null } | null {
  const d = state.draft;
  if (!d.who || !d.ruleId) return null;

  let amt: number;
  let label: string;
  let sev: Severity;
  let extraRule: Rule | null = null;

  if (d.ruleId === 'custom') {
    amt = parseAmount(d.customAmt);
    if (!amt) return null;
    label = d.customName.trim() || 'Something else';
    sev = 'one-off';
    // Its own uuid. Deriving one from the fine's id looked tidy and was not:
    // rules.id is a uuid column, so `<uuid>-rule` was rejected outright.
    if (d.saveAsRule) extraRule = { id: extraRuleId, name: label, price: amt };
  } else {
    const rule = state.rules.find((r) => r.id === d.ruleId);
    if (!rule) return null;
    const mult = SEVERITIES.find((x) => x.id === d.sev)?.mult ?? 1;
    amt = Math.round(rule.price * mult * 100) / 100;
    label = rule.name;
    sev = d.sev;
  }

  return {
    fine: {
      id,
      who: d.who,
      by: 'A',
      rule: d.ruleId,
      label,
      sev,
      amt,
      when: at,
      day: new Date(at).getDay(),
    },
    extraRule,
  };
}

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
      const built = buildFine(state, action.id, action.at, action.extraRuleId);
      if (!built) return state;
      const { fine, extraRule } = built;

      return {
        ...state,
        fines: [fine, ...state.fines],
        rules: extraRule ? [...state.rules, extraRule] : state.rules,
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
        rules: [...state.rules, { id: action.id, name: action.name, price: action.price }],
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

    case 'remote/hydrate': {
      const { jar, rules, fines } = action;
      return {
        ...state,
        jar,
        me: jar.meName,
        partner: jar.partnerName,
        rules,
        fines,
        totalEver: jar.totalEver,
        mystery: jar.mystery,
        palette: jar.palette,
        notif: jar.notif,
        onboarded: true,
        // The jar drawing is a function of how full the jar is, and a real jar
        // starts empty rather than at the seed's fifteen.
        coins: Math.max(COIN_FLOOR, Math.min(COIN_CAP, fines.length)),
      };
    }

    case 'remote/clear':
      // Detach from the jar, but stay onboarded: signing out should land you
      // back in the local demo, not at the first-run screen. The provider
      // re-hydrates the saved demo immediately after this.
      return { ...INITIAL, onboarded: true };

    case 'reset':
      // Only ever a demo affordance. With a real jar the database is the
      // record, and refilling the screen with seed fines would just lie.
      if (state.jar) return state;
      return { ...INITIAL, palette: state.palette, onboarded: true };

    default:
      return state;
  }
}

/* ── context ─────────────────────────────────────────────────────────────── */

export type AuthState = {
  /** null while unknown, then the signed-in user or false for signed-out. */
  userId: string | null;
  email: string | null;
  ready: boolean;
};

type Ctx = {
  state: State;
  /** Screens dispatch UiActions; the wrapper fills in ids and mirrors writes. */
  dispatch: (action: UiAction) => void;
  /** False until localStorage has been read, so the first paint matches SSR. */
  hydrated: boolean;
  /**
   * True when money must be masked: Mystery jar is on and the user is not
   * mid-Peek — or the persisted settings have not been read yet, in which
   * case this fails closed. See the note in StoreProvider.
   */
  sealed: boolean;
  peeking: boolean;
  peek: () => void;

  auth: AuthState;
  /** True once a real jar is loaded. False means the local seed demo. */
  remote: boolean;
  /** Configured project, whether or not anyone is signed in. */
  configured: boolean;
  signOut: () => Promise<void>;
  /** Create a jar, or join one by invite code. Returns an error message. */
  startJar: () => Promise<string | null>;
  joinByCode: (code: string) => Promise<string | null>;
  /** Surfaces a failed remote write; screens may show it, none must crash on it. */
  syncError: string | null;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ userId: null, email: null, ready: false });
  const [syncError, setSyncError] = useState<string | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The wrapper below reads state at dispatch time to derive what to write
  // remotely, and a ref is the only way to see the current value from inside a
  // stable callback.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const sb = getSupabase();
  const configured = isSupabaseConfigured();
  const remote = state.jar !== null;

  /* ── local persistence (demo mode only) ───────────────────────────────── */

  useEffect(() => {
    const saved = loadState<Persisted>();
    if (saved) baseDispatch({ type: 'hydrate', payload: saved });
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Once a real jar is loaded Postgres is the record; writing it back to
    // localStorage would only create a second, staler copy to disagree with.
    if (!hydrated || remote) return;
    saveState(persistedOf(state));
  }, [state, hydrated, remote]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', state.palette);
  }, [state.palette]);

  /* ── auth ─────────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!sb) {
      setAuth({ userId: null, email: null, ready: true });
      return;
    }
    let alive = true;

    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuth({
        userId: data.session?.user.id ?? null,
        email: data.session?.user.email ?? null,
        ready: true,
      });
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setAuth({
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
        ready: true,
      });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [sb]);

  /* ── load the jar, then keep it live ──────────────────────────────────── */

  /**
   * Detach from the jar and restore whatever the local demo held before
   * sign-in. localStorage is still intact because the persistence effect
   * stops writing while a real jar is loaded.
   */
  const resetToLocal = useCallback(() => {
    baseDispatch({ type: 'remote/clear' });
    const saved = loadState<Persisted>();
    if (saved) baseDispatch({ type: 'hydrate', payload: saved });
  }, []);

  // The dispatch wrapper is stable and must not be rebuilt whenever reload
  // changes identity, so it reaches it through a ref.
  const reloadRef = useRef<(() => Promise<void>) | null>(null);

  const reload = useCallback(async () => {
    if (!sb || !auth.userId) return;
    try {
      const jar = await loadJar(sb, auth.userId);
      if (!jar) return;
      const [rules, fines] = await Promise.all([
        loadRules(sb, jar.jarId),
        loadFines(sb, jar.jarId, jar.meId),
      ]);
      baseDispatch({ type: 'remote/hydrate', jar, rules, fines });
      setSyncError(null);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Could not reach the jar');
    }
  }, [sb, auth.userId]);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  // The notice says its piece and goes. Leaving it up would turn one refused
  // write into a permanent banner.
  useEffect(() => {
    if (!syncError) return;
    const t = setTimeout(() => setSyncError(null), 5200);
    return () => clearTimeout(t);
  }, [syncError]);

  useEffect(() => {
    if (!auth.ready) return;
    if (!auth.userId) {
      // Signed out: fall back to the local demo rather than an empty screen.
      if (stateRef.current.jar) resetToLocal();
      return;
    }
    void reload();
  }, [auth.ready, auth.userId, reload, resetToLocal]);

  // Both people have to see a fine the moment it lands. Any change to the
  // jar's rows refetches — the payloads are small and a refetch cannot drift
  // the way incremental patching can.
  const jarId = state.jar?.jarId ?? null;
  useEffect(() => {
    if (!sb || !jarId) return;
    const channel = sb
      .channel(`jar:${jarId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fines', filter: `jar_id=eq.${jarId}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rules', filter: `jar_id=eq.${jarId}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jar_members', filter: `jar_id=eq.${jarId}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_outs', filter: `jar_id=eq.${jarId}` }, () => void reload())
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
    // Keyed on the id, not the jar object: reload() dispatches a new object
    // every time, which would resubscribe on every incoming change.
  }, [sb, jarId, reload]);

  /* ── the dispatch wrapper ─────────────────────────────────────────────── */

  const dispatch = useCallback(
    (action: UiAction) => {
      const prev = stateRef.current;
      const jar = prev.jar;

      // Fill in what the reducer needs but must not generate itself.
      let applied: Action;
      if (action.type === 'fine/submit') {
        applied = {
          type: 'fine/submit',
          id: newId(),
          at: new Date().toISOString(),
          extraRuleId: newId(),
        };
      } else if (action.type === 'rule/add') {
        applied = { type: 'rule/add', id: newId(), name: action.name, price: action.price };
      } else {
        applied = action;
      }

      // Optimistic: the UI never waits on the network. A failed write surfaces
      // through syncError and the next realtime refetch corrects the view.
      baseDispatch(applied);

      if (!sb || !jar) return;
      const fail = (e: unknown) => {
        setSyncError(e instanceof Error ? e.message : 'Could not save that');
        // The optimistic change is still on screen and the database refused
        // it, so no realtime event is coming to correct it. Refetch, or the
        // two disagree until the app is reopened.
        void reloadRef.current?.();
      };

      switch (applied.type) {
        case 'fine/submit': {
          const built = buildFine(prev, applied.id, applied.at, applied.extraRuleId);
          if (!built) return;
          const writes: Promise<unknown>[] = [insertFine(sb, jar.jarId, jar, built.fine)];
          if (built.extraRule) writes.push(insertRule(sb, jar.jarId, built.extraRule));
          Promise.all(writes).catch(fail);
          break;
        }
        case 'fine/undo': {
          if (prev.lastFine) deleteFine(sb, prev.lastFine.id).catch(fail);
          break;
        }
        case 'rule/add':
          insertRule(sb, jar.jarId, {
            id: applied.id,
            name: applied.name,
            price: applied.price,
          }).catch(fail);
          break;
        case 'rule/edit':
          updateRule(sb, { id: applied.id, name: applied.name, price: applied.price }).catch(fail);
          break;
        case 'rule/delete':
          archiveRule(sb, applied.id).catch(fail);
          break;
        case 'cashout': {
          const chosen = DESTINATIONS.find((d) => d.id === prev.dest) ?? DESTINATIONS[0];
          const pool = DESTINATIONS.filter((d) => d.id !== 'wheel');
          const spun = chosen.id === 'wheel';
          const name = spun ? pool[applied.pick % pool.length].name : chosen.name;
          cashOut(sb, name, spun).catch(fail);
          break;
        }
        case 'setName': {
          const target = applied.person === 'A' ? jar.meId : jar.partnerId;
          // You can rename yourself. Renaming the other person is a local
          // nickname only — their profile is theirs.
          if (applied.person === 'A' && target) {
            setDisplayName(sb, target, applied.name || NAME_FALLBACK_ME).catch(fail);
          }
          break;
        }
        case 'mystery/toggle':
          setMemberSettings(sb, jar.jarId, jar.meId, { mystery: !prev.mystery }).catch(fail);
          break;
        case 'setPalette':
          setMemberSettings(sb, jar.jarId, jar.meId, { palette: applied.palette }).catch(fail);
          break;
        case 'notif/toggle': {
          const column =
            applied.key === 'fined'
              ? 'notify_fined'
              : applied.key === 'selfFined'
                ? 'notify_self_fined'
                : 'notify_milestone';
          setMemberSettings(sb, jar.jarId, jar.meId, {
            [column]: !prev.notif[applied.key],
          }).catch(fail);
          break;
        }
        default:
          break;
      }
    },
    [sb],
  );

  /* ── jar lifecycle ────────────────────────────────────────────────────── */

  const startJar = useCallback(async (): Promise<string | null> => {
    if (!sb || !auth.userId) return 'Sign in first';
    try {
      await createJar(sb);
      await reload();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not start the jar';
    }
  }, [sb, auth.userId, reload]);

  const joinByCode = useCallback(
    async (code: string): Promise<string | null> => {
      if (!sb || !auth.userId) return 'Sign in first';
      try {
        await joinJar(sb, code.trim());
        await reload();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not join that jar';
      }
    },
    [sb, auth.userId, reload],
  );

  const signOut = useCallback(async () => {
    if (!sb) return;
    // Let a failure reach the caller — the screen shows the reason rather
    // than silently pretending the session ended.
    const { error } = await sb.auth.signOut();
    if (error) throw new Error(error.message);
    resetToLocal();
  }, [sb, resetToLocal]);

  /* ── peek ─────────────────────────────────────────────────────────────── */

  const peek = useCallback(() => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeeking(true);
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
  }, []);

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
      // Fails closed before hydration. The reducer starts from INITIAL, where
      // mystery is false, so a user who has the mode ON would otherwise get
      // one painted frame of their real total — the server pass and the first
      // client pass both render it — before localStorage is read. The handoff
      // is blunt about this: "any single unmasked figure that reveals the
      // total defeats it." A masked frame for everyone is the cheaper mistake.
      sealed: !hydrated || (state.mystery && !peeking),
      peeking,
      peek,
      auth,
      remote,
      configured,
      signOut,
      startJar,
      joinByCode,
      syncError,
    }),
    [
      state, dispatch, hydrated, peeking, peek, auth, remote, configured,
      signOut, startJar, joinByCode, syncError,
    ],
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
