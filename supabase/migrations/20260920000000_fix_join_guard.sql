-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: a failed join reported success.
--
-- jar_members carries a unique index on user_id alone (one jar per person), and
-- join_jar_by_code ended with an untargeted `on conflict do nothing`. So when
-- somebody who already had a jar redeemed an invite, the insert quietly hit
-- that unique violation, the `do nothing` swallowed it, and the function still
-- returned the jar id. The client read that as success and sent them to a jar
-- they had never joined — their own, empty one.
--
-- This is the exact trap the magic-link flow walks into: follow an invite while
-- signed out, get bounced through sign-in, the callback finds no pending code
-- and creates a jar, and from then on the real invite can never be redeemed.
--
-- The rewrite below decides explicitly rather than leaving it to a constraint:
-- re-joining the jar you are already in is a no-op that succeeds, being in a
-- different jar is a refusal with a reason, and the insert is left to fail
-- loudly if anything else is wrong.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.join_jar_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me        uuid := (select auth.uid());
  target    uuid;
  current   uuid;
  headcount int;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  -- Accept both "JAR-4K2P" and "4k2p".
  select j.id into target
  from public.jars j
  where j.invite_code = upper(regexp_replace(code, '^jar-', '', 'i'));

  if target is null then
    raise exception 'no jar with that code';
  end if;

  select m.jar_id into current from public.jar_members m where m.user_id = me;

  -- Already in it. Idempotent: redeeming the same link twice is not an error.
  if current = target then
    return target;
  end if;

  -- In a different jar. This is the case the old `on conflict do nothing`
  -- turned into a silent success.
  if current is not null then
    raise exception 'you are already in a jar — leave it before joining another';
  end if;

  select count(*) into headcount from public.jar_members m where m.jar_id = target;
  if headcount >= 2 then
    raise exception 'that jar is already a pair';
  end if;

  -- No `on conflict` clause: at this point a conflict means a real race, and
  -- it should surface rather than be mistaken for having joined.
  insert into public.jar_members (jar_id, user_id) values (target, me);

  return target;
end;
$$;

revoke all on function public.join_jar_by_code(text) from public;
grant execute on function public.join_jar_by_code(text) to authenticated;

-- ── leaving a jar ────────────────────────────────────────────────────────────
-- The refusal above is only fair if there is a way out. Deleting your own
-- membership row is already permitted by jar_members_delete_self, but doing it
-- through a function keeps the client from having to know that, and gives us
-- somewhere to put the rule that the last person out does not delete the jar —
-- the history stays, orphaned but intact, in case they come back.

create or replace function public.leave_jar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  delete from public.jar_members m where m.user_id = me;
end;
$$;

revoke all on function public.leave_jar() from public;
grant execute on function public.leave_jar() to authenticated;
