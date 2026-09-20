-- ─────────────────────────────────────────────────────────────────────────────
-- What you call the other person.
--
-- Settings offers two name fields, "You" and "Them", and the handoff says they
-- "drive every name in the app". Only the first of them worked: your own name
-- is your profile, which you may edit, but the partner field wrote nowhere.
-- With a real jar it did not even survive locally — the next realtime refetch
-- overwrote it from their profile — so renaming them appeared to work and then
-- quietly undid itself the next time they logged a fine.
--
-- Their display name is theirs to set. What you call them is yours, so it
-- belongs on your membership row rather than on their profile: each person can
-- hold their own name for the other, and neither can edit the other's identity.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.jar_members
  add column if not exists partner_nickname text;

comment on column public.jar_members.partner_nickname is
  'What THIS member calls the other one. Overrides the partner''s profile name '
  'in this member''s app only. Null means use their own display name.';

-- No new policy needed: jar_members_update_self already scopes updates to your
-- own row, which is exactly the right boundary for this.
