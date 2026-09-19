# Database

The schema for Sorry Jar, applied by the Supabase GitHub integration on merge to `main`.
Working directory in the integration settings is `.` — this folder is at the repo root.

## Local

```bash
npx supabase start              # needs Docker (OrbStack works)
npx supabase db reset           # re-apply every migration from scratch
npx supabase migration new <name>
```

## The shape

| Table | What it holds |
| --- | --- |
| `profiles` | One row per auth user, mirroring `auth.users`. Created by a trigger. |
| `jars` | A couple's jar: invite code, currency, start date. |
| `jar_members` | Who is in the jar, **and each person's own settings** — Mystery jar, palette, the three notification switches. |
| `rules` | Name and base price. Retired with `archived_at`, not deleted. |
| `fines` | Who it's on, who logged it, the denormalised label, severity, amount. |
| `cash_outs` | Each time the jar was emptied. The lifetime "Total ever" is `sum(amount)`. |
| `push_tokens` | Device tokens for the three push triggers. |

Three functions do the things that must be atomic, all `SECURITY DEFINER`:

- `create_jar(name)` — makes the jar, joins the caller, seeds the three starting rules.
- `join_jar_by_code(code)` — accepts `JAR-4K2P` or `4k2p`. Refuses a jar that is already a pair.
  Definer because the joiner cannot see the jar until they are in it.
- `cash_out_jar(destination, spun)` — writes the cash-out, then stamps every uncashed fine with it.

## Decisions worth knowing

**Cashing out does not delete fines.** The prototype emptied the list. Here each fine is stamped
with the `cash_out` that swept it, and the current jar is `where cash_out_id is null`. Settings
promises a CSV export of history and Stats has a lifetime total — both need the rows to survive.

**`fines.label` is denormalised.** A fine stores the rule's name as it read when logged. Renaming
or deleting a rule must not rewrite history, and one-off fines have no rule to point at.
`rule_id` is `on delete set null` for the same reason.

**Fines are final.** There is no update policy on `fines`, and no `update` grant. The only
reversal is the Undo, expressed as a delete the logger may make within five minutes, on a fine
that has not been cashed out. Disputes happen out loud, not in the app.

**Either person can fine either person.** One insert policy, no separate accuse and self-report
paths. The insert check only requires that `by_user` is the caller and `on_user` is in the jar.

**Solo use works.** A jar with one member is a valid jar. The client asked for that explicitly —
do not add a constraint requiring two.

**Per-user settings live on `jar_members`.** Mystery jar, the palette and the notification
switches are each person's own choice, not the couple's.

**RLS is deny-by-default** and every policy routes through `is_jar_member(jar_id)`, which is
`SECURITY DEFINER` so the membership lookup does not re-enter RLS and recurse. Grants are explicit
rather than relying on Supabase's default privileges, and `anon` gets nothing.

## Verified

The migration was applied to a clean Postgres 17 and exercised end to end. Confirmed: the auth
trigger creates profiles; `create_jar` seeds three rules and a unique code; `join_jar_by_code`
accepts the lowercase unprefixed form; both people can fine either person; an outsider sees zero
jars, fines, rules and members; a fine cannot be attributed to the other person; a fine cannot be
edited; you cannot undo a fine someone else logged; you can undo your own; a third person is
refused from a full jar; `cash_out_jar` moves the balance to `total_ever` while keeping every row;
and a swept fine can no longer be undone.

## Not built yet

Push delivery (the tokens table is here, the sender is not) and the CSV export endpoint.
