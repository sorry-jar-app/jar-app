# Sorry Jar

A shared swear-jar / apology-jar app for two people. A couple defines rules, each rule has a base
price, and when someone breaks one the other logs a fine. **Money is tracked only** — nothing moves
through the app.

Mobile web PWA, deployed on Vercel, wrapped for iOS/Android with Capacitor.
Domains: `imsorryjar.app`, `imsorry.app`, `sorryjar.app`.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Plain CSS with custom properties — the **Organic** design system, ported verbatim |
| State | React reducer + context (`src/lib/store.tsx`), persisted to localStorage |
| Native | Capacitor 8 (static export target) |
| Database | Supabase (Postgres + RLS), applied by the GitHub integration on merge to `main` |
| Deploy | Vercel |

No Tailwind, no CSS-in-JS, no component library. The design system is one stylesheet of tokens and
classes; everything else reads from it.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in from the Supabase project's API settings
npm run dev                  # http://localhost:3000
```

The app runs without Supabase configured — state falls back to localStorage.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Vercel build (a normal Next app — route handlers work) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:static` | Static `out/` bundle for Capacitor |
| `npm run cap:sync` | Static build, then copy into the native projects |
| `npm run cap:ios` / `cap:android` | Sync, then open Xcode / Android Studio |

### Two build targets, one codebase

`next.config.ts` switches on `BUILD_TARGET`:

- **Vercel** — a normal Next build. Server route handlers can be added later for auth, pairing,
  sync and push.
- **Capacitor** — `BUILD_TARGET=capacitor` sets `output: 'export'` and emits a static `out/`.

Every screen is a client component today, so both targets emit the same UI. **Keep it that way:**
anything server-only belongs behind a route handler the native build calls over HTTPS, never in a
server component.

The native projects are not committed. Run `npx cap add ios` / `npx cap add android` once locally;
they land in gitignored `ios/` and `android/`.

## Layout

```
design/                 The handoff, kept as reference
  HANDOFF.md              The written spec — product decisions, screens, copy
  prototype.dc.html       The clickable design prototype (open it in a browser)
  organic.styles.css      The design system as delivered
src/
  app/                  One directory per screen — routes match the handoff's eleven screens
  components/           Jar, Avatar, Toggle, TabBar, ScreenHeader, WhoPicker, AmountField, Icons
  lib/
    store.tsx             The whole app state, in one reducer
    constants.ts          Seed data, rules, destinations, coin slots — ported from the prototype
    money.ts              money() / masked() / veil() / parseAmount()
    storage.ts            The persistence seam — swap this file for a real backend
    types.ts
  styles/
    organic.css           The design system, ported verbatim (see the header comment)
    palettes.css          The four palettes
    app.css               App classes — every repeated pattern from the prototype
supabase/
  migrations/           Applied on merge to main by the GitHub integration
  README.md             The schema, and the decisions behind it
```

## Things that will bite you

**The contrast rule.** The 500 step of both accent ramps is too light to carry cream text
(3.42:1 and 2.74:1). Anything with text or a glyph on an accent fill uses the **600** step
(7.11:1 and 5.82:1). The 500 step is for non-text fills only — chart bars, coins, toggle tracks.
This holds across all four palettes; they share the same too-light 500.

**Mystery jar is all-or-nothing.** An opt-in mode that masks every figure which could reconstruct
the running total. A single unmasked figure defeats it. Read `sealed` from the store — never
`state.mystery` — and route the figure through `veil()`. When you add a screen that shows money,
decide explicitly whether it seals. What does *not* seal, deliberately: individual fine amounts in
History and on Landed, and the "Total ever" stat.

**`Fine.label` is denormalised on purpose.** A fine stores the rule's name as it read when logged,
rather than resolving through `rule` at read time. Renaming or deleting a rule must not rewrite
history, and one-off fines have no rule to point at. Keep it.

**Fines are final.** No confirm/dispute flow. Logging is instant and irreversible except for the
Undo on the landed screen. Disputes happen out loud, not in the app.

**The jar is a placeholder.** Hand-built SVG. It reads correctly, but it needs real artwork from an
illustrator before launch.

## Backend

The schema lives in [`supabase/`](supabase/) and is documented in
[`supabase/README.md`](supabase/README.md) — tables, the three atomic functions, and the RLS
model. It has been applied to a clean Postgres and exercised end to end.

The **client is not wired to it yet**. `src/lib/storage.ts` is still localStorage, and it is the
seam: everything above it is written against the store, so swapping in Supabase is that one file
plus making the store's writes async.

## Not built yet

Needed before this is a real product:

- **Auth and pairing** — Sign in with Apple/Google, then pair by invite code or link
  (`sorryjar.app/j/<code>`), SMS invite optional. **Solo use before pairing must keep working.**
- **Sync** — both people see a fine the moment it lands.
- **Push** — three triggers only: partner fined you, partner fined themselves, jar crossed a round
  number. Nothing else. The client explicitly declined streak reminders, weekly recaps and
  re-engagement nudges.
- **Export** — the Settings row promises CSV of fine history.
- **The jar illustration** — real artwork to replace the placeholder SVG.

**Money stays tracked-only.** No payment rails, no balance transfer, no disbursement.
