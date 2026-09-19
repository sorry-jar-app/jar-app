-- ─────────────────────────────────────────────────────────────────────────────
-- Sorry Jar — initial schema.
--
-- One jar, two ledgers: a single shared balance where every fine is attributed
-- to a person. Money is TRACKED ONLY. There are no payment rails here and
-- there should never be — no balances to move, no disbursement, no rails.
--
-- Two shapes worth knowing before you read further:
--
--   * fines.label is denormalised on purpose. A fine stores the rule's name as
--     it read at the moment it was logged. Renaming or deleting a rule must not
--     rewrite history, and a one-off fine has no rule to point at.
--
--   * Cashing out does NOT delete fines. The prototype emptied the list, but
--     Settings promises a CSV export of history and Stats has a lifetime total,
--     so instead each fine is stamped with the cash_out that swept it. The
--     "current jar" is the fines where cash_out_id is null.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── enums ────────────────────────────────────────────────────────────────────

create type public.severity as enum ('mild', 'bad', 'unforgivable', 'one-off');

-- ── profiles ─────────────────────────────────────────────────────────────────
-- One row per auth user. Mirrors auth.users so the app can read a display name
-- without touching the auth schema.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user, mirroring auth.users.';

-- ── jars ─────────────────────────────────────────────────────────────────────
-- A couple's jar. Solo use before pairing is supported and expected: a jar with
-- one member is a valid, fully working jar. The client asked for that
-- explicitly — do not add a constraint requiring two members.

create table public.jars (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Our jar',
  invite_code  text not null unique,
  currency     text not null default 'USD',
  started_on   date not null default current_date,
  created_by   uuid not null references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now()
);

comment on column public.jars.invite_code is
  'Short code behind sorryjar.app/j/<code>. Unique across all jars.';

-- ── membership ───────────────────────────────────────────────────────────────
-- Per-user settings live here, not on the jar: Mystery jar, the palette and the
-- notification switches are each person's own choice, not the couple's.

create table public.jar_members (
  jar_id            uuid not null references public.jars (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  joined_at         timestamptz not null default now(),

  mystery           boolean not null default false,
  palette           text not null default 'Mulberry',

  notify_fined      boolean not null default true,
  notify_self_fined boolean not null default true,
  notify_milestone  boolean not null default true,

  primary key (jar_id, user_id),
  constraint palette_known check (palette in ('Mulberry', 'Pine', 'Ink', 'Terracotta'))
);

-- A person is in one jar at a time. Lift this when multi-jar lands; the Stats
-- screen already says "Across 3 jars", so it is coming.
create unique index jar_members_one_jar_per_user on public.jar_members (user_id);

-- ── rules ────────────────────────────────────────────────────────────────────

create table public.rules (
  id         uuid primary key default gen_random_uuid(),
  jar_id     uuid not null references public.jars (id) on delete cascade,
  name       text not null,
  price      numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  -- Retired rather than deleted, so a rule can leave the list without the
  -- history that references it going strange.
  archived_at timestamptz,

  constraint rules_name_not_blank check (length(btrim(name)) > 0),
  constraint rules_price_positive check (price > 0)
);

create index rules_jar_active on public.rules (jar_id) where archived_at is null;

-- ── cash-outs ────────────────────────────────────────────────────────────────
-- Written before the fines are swept, so fines.cash_out_id has something to
-- point at. The lifetime "Total ever" is the sum of this table.

create table public.cash_outs (
  id          uuid primary key default gen_random_uuid(),
  jar_id      uuid not null references public.jars (id) on delete cascade,
  amount      numeric(10, 2) not null,
  destination text not null,
  -- True when the couple picked "Spin the wheel" and the app chose for them.
  spun        boolean not null default false,
  cashed_by   uuid not null references auth.users (id) on delete restrict,
  cashed_at   timestamptz not null default now(),

  constraint cash_outs_amount_not_negative check (amount >= 0)
);

create index cash_outs_jar_time on public.cash_outs (jar_id, cashed_at desc);

-- ── fines ────────────────────────────────────────────────────────────────────

create table public.fines (
  id          uuid primary key default gen_random_uuid(),
  jar_id      uuid not null references public.jars (id) on delete cascade,

  -- Who the fine is on.
  on_user     uuid not null references auth.users (id) on delete restrict,
  -- Who logged it. Drives the notification copy, never the ledger.
  by_user     uuid not null references auth.users (id) on delete restrict,

  -- Null for a one-off. Set null rather than cascading, so deleting a rule
  -- leaves its history intact.
  rule_id     uuid references public.rules (id) on delete set null,
  -- The rule's name as it read when this was logged. See the header.
  label       text not null,

  severity    public.severity not null,
  amount      numeric(10, 2) not null,

  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  -- Set when a cash-out sweeps this fine. Null means it is in the current jar.
  cash_out_id uuid references public.cash_outs (id) on delete set null,

  constraint fines_label_not_blank check (length(btrim(label)) > 0),
  constraint fines_amount_positive check (amount > 0),
  -- A one-off has no rule; a rule-based fine has a real severity.
  constraint fines_oneoff_shape check (
    (severity = 'one-off' and rule_id is null) or (severity <> 'one-off')
  )
);

create index fines_jar_current on public.fines (jar_id, occurred_at desc)
  where cash_out_id is null;
create index fines_jar_all on public.fines (jar_id, occurred_at desc);
create index fines_cash_out on public.fines (cash_out_id);

-- ── push tokens ──────────────────────────────────────────────────────────────
-- Three triggers only: partner fined you, partner fined themselves, jar crossed
-- a round number. The client declined streak reminders, weekly recaps and
-- re-engagement nudges — do not add a fourth.

create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token      text not null,
  platform   text not null,
  created_at timestamptz not null default now(),

  unique (user_id, token),
  constraint push_platform_known check (platform in ('ios', 'android', 'web'))
);

-- ── helpers ──────────────────────────────────────────────────────────────────

-- SECURITY DEFINER so the membership lookup inside a policy does not itself
-- re-enter RLS on jar_members and recurse. search_path is pinned for the same
-- reason every definer function should pin it.
create or replace function public.is_jar_member(target_jar uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.jar_members m
    where m.jar_id = target_jar and m.user_id = (select auth.uid())
  );
$$;

comment on function public.is_jar_member is
  'True when the caller belongs to the jar. Used by every RLS policy below.';

-- The caller's jar, or null when they have none yet.
create or replace function public.current_jar_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.jar_id from public.jar_members m
  where m.user_id = (select auth.uid())
  limit 1;
$$;

-- Keep profiles in step with auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── row level security ───────────────────────────────────────────────────────
-- Everything is deny-by-default. A person can reach exactly their own row and
-- the rows of the jar they belong to.

alter table public.profiles    enable row level security;
alter table public.jars        enable row level security;
alter table public.jar_members enable row level security;
alter table public.rules       enable row level security;
alter table public.fines       enable row level security;
alter table public.cash_outs   enable row level security;
alter table public.push_tokens enable row level security;

-- profiles: your own, plus the person you share a jar with.
create policy profiles_select_self_or_partner on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.jar_members mine
      join public.jar_members theirs on theirs.jar_id = mine.jar_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- jars: members read; anyone signed in may create one (they become a member in
-- the same transaction); only members may rename or restart it.
create policy jars_select_member on public.jars
  for select to authenticated
  using (public.is_jar_member(id));

create policy jars_insert_self on public.jars
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy jars_update_member on public.jars
  for update to authenticated
  using (public.is_jar_member(id))
  with check (public.is_jar_member(id));

-- jar_members: you see every member of your jar, but write only your own row.
-- Joining by invite code goes through join_jar_by_code() below, not a direct
-- insert, so that the code is actually checked.
create policy jar_members_select_same_jar on public.jar_members
  for select to authenticated
  using (public.is_jar_member(jar_id));

create policy jar_members_insert_self on public.jar_members
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy jar_members_update_self on public.jar_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy jar_members_delete_self on public.jar_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- rules: any member may add, reprice or retire one. "Both of you have to agree
-- to a change" is a social rule, not a database one.
create policy rules_all_member on public.rules
  for all to authenticated
  using (public.is_jar_member(jar_id))
  with check (public.is_jar_member(jar_id));

-- fines: either person can log a fine on either person — equal weight, no
-- separate accuse and self-report paths. The logger must be the caller, and
-- the person fined must be in the jar.
create policy fines_select_member on public.fines
  for select to authenticated
  using (public.is_jar_member(jar_id));

create policy fines_insert_member on public.fines
  for insert to authenticated
  with check (
    public.is_jar_member(jar_id)
    and by_user = (select auth.uid())
    and exists (
      select 1 from public.jar_members m
      where m.jar_id = fines.jar_id and m.user_id = fines.on_user
    )
  );

-- Fines are final. The only reversal is the Undo immediately after logging, so
-- delete is allowed to the person who logged it, for a short window, and there
-- is no update policy at all — a logged fine cannot be edited.
create policy fines_delete_own_recent on public.fines
  for delete to authenticated
  using (
    public.is_jar_member(jar_id)
    and by_user = (select auth.uid())
    and cash_out_id is null
    and created_at > now() - interval '5 minutes'
  );

create policy cash_outs_select_member on public.cash_outs
  for select to authenticated
  using (public.is_jar_member(jar_id));

create policy cash_outs_insert_member on public.cash_outs
  for insert to authenticated
  with check (public.is_jar_member(jar_id) and cashed_by = (select auth.uid()));

create policy push_tokens_all_self on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── table privileges ─────────────────────────────────────────────────────────
-- A hosted Supabase project sets default privileges that would cover this, but
-- state it explicitly so the schema is correct on any Postgres and so `anon` is
-- deliberately left with nothing. RLS above narrows these further; a grant only
-- opens the door, the policy decides who walks through.
--
-- Note what is NOT granted: update on fines. Fines are final — the only
-- reversal is the Undo, which is a delete.

grant usage on schema public to anon, authenticated;

grant select, update                   on public.profiles    to authenticated;
grant select, insert, update           on public.jars        to authenticated;
grant select, insert, update, delete   on public.jar_members to authenticated;
grant select, insert, update, delete   on public.rules       to authenticated;
grant select, insert,         delete   on public.fines       to authenticated;
grant select, insert                   on public.cash_outs   to authenticated;
grant select, insert, update, delete   on public.push_tokens to authenticated;

-- ── operations that need to be atomic ────────────────────────────────────────

-- Create a jar, join it, and seed the three starting rules in one transaction.
create or replace function public.create_jar(jar_name text default 'Our jar')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_jar uuid;
  code    text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  -- Short, unambiguous code. Retry on the (very unlikely) collision.
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (select 1 from public.jars j where j.invite_code = code);
  end loop;

  insert into public.jars (name, invite_code, created_by)
  values (jar_name, code, (select auth.uid()))
  returning id into new_jar;

  insert into public.jar_members (jar_id, user_id)
  values (new_jar, (select auth.uid()));

  insert into public.rules (jar_id, name, price) values
    (new_jar, 'Swearing', 1.00),
    (new_jar, 'Late again', 2.50),
    (new_jar, 'Phone at dinner', 2.00);

  return new_jar;
end;
$$;

-- Join by invite code. SECURITY DEFINER because the joiner cannot see the jar
-- until they are in it, so they cannot look the code up themselves.
create or replace function public.join_jar_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
  headcount int;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  -- Accept both "JAR-4K2P" and "4k2p".
  select j.id into target
  from public.jars j
  where j.invite_code = upper(regexp_replace(code, '^jar-', '', 'i'));

  if target is null then
    raise exception 'no jar with that code';
  end if;

  select count(*) into headcount from public.jar_members m where m.jar_id = target;
  if headcount >= 2 then
    raise exception 'that jar is already a pair';
  end if;

  insert into public.jar_members (jar_id, user_id)
  values (target, (select auth.uid()))
  on conflict do nothing;

  return target;
end;
$$;

-- Cash out: record it, then stamp every uncashed fine with it. One transaction,
-- so the jar can never be half-emptied.
create or replace function public.cash_out_jar(destination text, spun boolean default false)
returns public.cash_outs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target  uuid := public.current_jar_id();
  total   numeric(10, 2);
  created public.cash_outs;
begin
  if target is null then
    raise exception 'no jar';
  end if;
  if not public.is_jar_member(target) then
    raise exception 'not a member of that jar';
  end if;

  select coalesce(sum(f.amount), 0) into total
  from public.fines f
  where f.jar_id = target and f.cash_out_id is null;

  insert into public.cash_outs (jar_id, amount, destination, spun, cashed_by)
  values (target, total, destination, spun, (select auth.uid()))
  returning * into created;

  update public.fines f
  set cash_out_id = created.id
  where f.jar_id = target and f.cash_out_id is null;

  return created;
end;
$$;

revoke all on function public.create_jar(text) from public;
revoke all on function public.join_jar_by_code(text) from public;
revoke all on function public.cash_out_jar(text, boolean) from public;
grant execute on function public.create_jar(text) to authenticated;
grant execute on function public.join_jar_by_code(text) to authenticated;
grant execute on function public.cash_out_jar(text, boolean) to authenticated;

-- ── realtime ─────────────────────────────────────────────────────────────────
-- Both people need to see a fine the moment it lands.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.fines;
    alter publication supabase_realtime add table public.rules;
    alter publication supabase_realtime add table public.cash_outs;
    alter publication supabase_realtime add table public.jar_members;
  end if;
end
$$;
