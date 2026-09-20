'use client';

/**
 * Every read and write against the schema, in one place.
 *
 * The app's own vocabulary and the database's are deliberately different: the
 * UI thinks in 'A' (me) and 'S' (them), because that is what the screens show,
 * while the database thinks in user uuids. Translation happens here and
 * nowhere else, so no screen ever has to know a uuid exists.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Fine, NotificationPrefs, Person, Rule, Severity } from '@/lib/types';

/* ── the jar as this device sees it ──────────────────────────────────────── */

export type JarContext = {
  jarId: string;
  inviteCode: string;
  startedOn: string;
  currency: string;
  /** This device's user. Always 'A'. */
  meId: string;
  /** The other member, once someone has joined. */
  partnerId: string | null;
  meName: string;
  partnerName: string;
  mystery: boolean;
  notif: NotificationPrefs;
  totalEver: number;
};

type MemberRow = {
  user_id: string;
  mystery: boolean;
  palette: string;
  partner_nickname: string | null;
  notify_fined: boolean;
  notify_self_fined: boolean;
  notify_milestone: boolean;
};

type FineRow = {
  id: string;
  on_user: string;
  by_user: string;
  rule_id: string | null;
  label: string;
  severity: Severity;
  amount: string | number;
  occurred_at: string;
};

type CashOutRef = { cashed_at: string; destination: string };

/** Postgres numeric comes back as a string; money must not go through a float twice. */
function money(value: string | number): number {
  return Math.round(Number(value) * 100) / 100;
}

/* ── bootstrap ───────────────────────────────────────────────────────────── */

/**
 * Load the caller's jar, or null when they are not in one yet. Null is a
 * normal state — it is what the Pairing screen exists to resolve.
 */
export async function loadJar(sb: SupabaseClient, meId: string): Promise<JarContext | null> {
  const { data: membership, error } = await sb
    .from('jar_members')
    .select('jar_id')
    .eq('user_id', meId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!membership) return null;
  const jarId = membership.jar_id as string;

  const [{ data: jar }, { data: members }, { data: profiles }, { data: cashOuts }] =
    await Promise.all([
      sb.from('jars').select('id, invite_code, started_on, currency').eq('id', jarId).single(),
      sb
        .from('jar_members')
        .select(
          'user_id, mystery, palette, partner_nickname, notify_fined, notify_self_fined, notify_milestone',
        )
        .eq('jar_id', jarId),
      sb.from('profiles').select('id, display_name'),
      sb.from('cash_outs').select('amount').eq('jar_id', jarId),
    ]);

  if (!jar) return null;

  const rows = (members ?? []) as MemberRow[];
  const mine = rows.find((m) => m.user_id === meId);
  const theirs = rows.find((m) => m.user_id !== meId) ?? null;

  const nameOf = (id: string | null, fallback: string) => {
    if (!id) return fallback;
    const p = (profiles ?? []).find((x) => (x as { id: string }).id === id) as
      | { display_name: string | null }
      | undefined;
    const name = p?.display_name?.trim();
    return name && name.length > 0 ? name : fallback;
  };

  return {
    jarId,
    inviteCode: jar.invite_code as string,
    startedOn: jar.started_on as string,
    currency: jar.currency as string,
    meId,
    partnerId: theirs?.user_id ?? null,
    meName: nameOf(meId, 'You'),
    // What you call them wins over what they call themselves — see the
    // partner_nickname migration.
    partnerName: mine?.partner_nickname?.trim() || nameOf(theirs?.user_id ?? null, 'Them'),
    mystery: mine?.mystery ?? false,
    notif: {
      fined: mine?.notify_fined ?? true,
      selfFined: mine?.notify_self_fined ?? true,
      milestone: mine?.notify_milestone ?? true,
    },
    totalEver: (cashOuts ?? []).reduce((a, c) => a + money((c as { amount: string }).amount), 0),
  };
}

export async function createJar(sb: SupabaseClient): Promise<string | null> {
  const { data, error } = await sb.rpc('create_jar', { jar_name: 'Our jar' });
  if (error) throw new Error(error.message);
  return (data as string) ?? null;
}

export async function joinJar(sb: SupabaseClient, code: string): Promise<string> {
  const { data, error } = await sb.rpc('join_jar_by_code', { code });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ── rules ───────────────────────────────────────────────────────────────── */

export async function loadRules(sb: SupabaseClient, jarId: string): Promise<Rule[]> {
  const { data, error } = await sb
    .from('rules')
    .select('id, name, price')
    .eq('jar_id', jarId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    price: money(r.price as string),
  }));
}

export async function insertRule(sb: SupabaseClient, jarId: string, rule: Rule) {
  const { error } = await sb
    .from('rules')
    .insert({ id: rule.id, jar_id: jarId, name: rule.name, price: rule.price });
  if (error) throw new Error(error.message);
}

export async function updateRule(sb: SupabaseClient, rule: Rule) {
  const { error } = await sb
    .from('rules')
    .update({ name: rule.name, price: rule.price })
    .eq('id', rule.id);
  if (error) throw new Error(error.message);
}

/**
 * Retire rather than delete. A deleted rule would drop out of history's reach;
 * archiving keeps every fine that points at it intact.
 */
export async function archiveRule(sb: SupabaseClient, id: string) {
  const { error } = await sb
    .from('rules')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/* ── fines ───────────────────────────────────────────────────────────────── */

/** Rows map to 'A'/'S' against this device's user; anyone else reads as the partner. */
function personOf(userId: string, meId: string): Person {
  return userId === meId ? 'A' : 'S';
}

export async function loadFines(sb: SupabaseClient, jarId: string, meId: string): Promise<Fine[]> {
  const { data, error } = await sb
    .from('fines')
    .select('id, on_user, by_user, rule_id, label, severity, amount, occurred_at')
    .eq('jar_id', jarId)
    .is('cash_out_id', null)
    .order('occurred_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => fineFromRow(row as FineRow, meId));
}

/**
 * Every fine the jar has ever held, cashed out or not.
 *
 * loadFines deliberately filters to the current jar; the export does not, which
 * is the whole reason cashing out stamps fines rather than deleting them. Each
 * row carries the cash-out that swept it, so the CSV can say which.
 */
export async function loadAllFines(
  sb: SupabaseClient,
  jarId: string,
  meId: string,
): Promise<{ fine: Fine; cashedOutAt: string | null; destination: string | null }[]> {
  const PAGE = 500;
  const rows: unknown[] = [];

  // Paged deliberately: a project caps a response at 1000 rows by default, and
  // a truncated export looks exactly like a complete one.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('fines')
      .select(
        'id, on_user, by_user, rule_id, label, severity, amount, occurred_at, cash_out_id, cash_outs(cashed_at, destination)',
      )
      .eq('jar_id', jarId)
      .order('occurred_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  return rows.map((row) => {
    // PostgREST types an embedded relation as an array even when the foreign
    // key makes it at most one row, and hands back an object at runtime.
    // Accept either rather than guessing.
    const r = row as unknown as FineRow & { cash_outs: CashOutRef | CashOutRef[] | null };
    const swept = Array.isArray(r.cash_outs) ? (r.cash_outs[0] ?? null) : r.cash_outs;
    return {
      fine: fineFromRow(r, meId),
      cashedOutAt: swept?.cashed_at ?? null,
      destination: swept?.destination ?? null,
    };
  });
}

export function fineFromRow(row: FineRow, meId: string): Fine {
  const at = new Date(row.occurred_at);
  return {
    id: row.id,
    who: personOf(row.on_user, meId),
    by: personOf(row.by_user, meId),
    rule: row.rule_id ?? 'custom',
    label: row.label,
    sev: row.severity,
    amt: money(row.amount),
    when: row.occurred_at,
    day: at.getDay(),
  };
}

export async function insertFine(
  sb: SupabaseClient,
  jarId: string,
  jar: JarContext,
  fine: Fine,
): Promise<void> {
  // 'A' is always this device. A fine on the partner needs them to exist.
  const onUser = fine.who === 'A' ? jar.meId : jar.partnerId;
  if (!onUser) throw new Error('No partner in this jar yet');

  const { error } = await sb.from('fines').insert({
    id: fine.id,
    jar_id: jarId,
    on_user: onUser,
    by_user: jar.meId,
    rule_id: fine.rule === 'custom' ? null : fine.rule,
    label: fine.label,
    severity: fine.sev,
    amount: fine.amt,
    occurred_at: fine.when,
  });
  if (error) throw new Error(error.message);
}

/**
 * The Undo. The policy only permits this for the person who logged it, within
 * five minutes, on a fine that has not been cashed out — so a stale Undo fails
 * closed at the database rather than being trusted from the client.
 */
export async function deleteFine(sb: SupabaseClient, id: string) {
  const { error } = await sb.from('fines').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function cashOut(
  sb: SupabaseClient,
  destination: string,
  spun: boolean,
): Promise<{ amount: number; destination: string } | null> {
  const { data, error } = await sb.rpc('cash_out_jar', { destination, spun });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { amount: money(row.amount), destination: row.destination as string };
}

/* ── people and settings ─────────────────────────────────────────────────── */

export async function setDisplayName(sb: SupabaseClient, userId: string, name: string) {
  const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) throw new Error(error.message);
}

/** Mystery jar, palette and the notification switches are each person's own. */
export async function setMemberSettings(
  sb: SupabaseClient,
  jarId: string,
  userId: string,
  patch: Partial<{
    mystery: boolean;
    partner_nickname: string | null;
    notify_fined: boolean;
    notify_self_fined: boolean;
    notify_milestone: boolean;
  }>,
) {
  const { error } = await sb
    .from('jar_members')
    .update(patch)
    .eq('jar_id', jarId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
