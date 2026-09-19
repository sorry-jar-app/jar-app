# Handoff: Sorry Jar

## Overview

Sorry Jar is a shared swear-jar / apology-jar app for two people. A couple defines rules ("Swearing", "Late again"), each rule has a base price, and when someone breaks one the other logs a fine. Money is **tracked only** — nothing moves through the app. The jar fills up as a visual, and when it's full enough the couple cashes it out toward something they both enjoy.

Target surface: **mobile web (PWA)**, 390×844 viewport. Intended deployment: Vercel. Domains owned: `imsorryjar.app`, `imsorry.app`, `sorryjar.app`.

Core product decisions already settled with the client (do not re-litigate these):

- **One jar, two ledgers.** A single shared balance, but every fine is attributed to a person.
- **Fines are final.** No confirm/dispute flow. Logging is instant and irreversible except for an Undo immediately after. Disputes happen out loud, not in the app.
- **Either person can log a fine on either person.** One "Log a fine" button, you pick who it's on. Equal weight — no separate "accuse" and "self-report" paths.
- **Price per rule × severity multiplier** chosen at log time (Mild ×1, Bad ×2, Unforgivable ×3).
- **The jar just grows.** No goal allocation as money comes in; the destination is chosen at cash-out.
- **Tone: playfully petty, dialed back.** Dry and warm, never nagging. See "Copy" below.

## About the Design Files

`Sorry Jar.dc.html` in this bundle is a **design reference created in HTML** — a working prototype showing the intended look, flow, and behavior. It is **not production code to copy directly**.

The task is to recreate these designs in the target codebase's environment using its established patterns and libraries. If no codebase exists yet, the natural choice given the Vercel target is **Next.js (App Router) + React + TypeScript**, with Tailwind or CSS variables carrying the tokens below.

The prototype holds all state in a single React component with `useState`-equivalent local state and seeded demo data. Production needs real persistence, auth, pairing, and push — see "Backend Notes".

## Fidelity

**High fidelity.** Colors, typography, spacing, radii, and interaction states are final and come from the bound **Organic** design system. Recreate pixel-accurately. Layout is a fixed 390×844 phone frame in the prototype; in production it should fill the viewport and respect safe-area insets.

The one deliberately unfinished area is **illustration**: the jar is a hand-built SVG placeholder. It reads correctly but a designer/illustrator should replace it with real artwork before launch.

## Design Tokens

All tokens come from the Organic design system stylesheet (`_ds/organic-.../styles.css`, bundled here). Never hard-code a value the tokens already carry.

### Color

The app ships **four palettes**; Mulberry is the default and the one the client selected. Each palette overrides the same CSS custom properties on `:root`, so palette switching is a single style write and nothing else in the app changes.

**Mulberry (default)**

| Token | Hex | Used for |
| --- | --- | --- |
| `--color-bg` | `#f7f1e8` | Page ground, cream |
| `--color-surface` | `#ece3d7` | Cards, rows, unselected pills |
| `--color-accent` | `#8c4767` | Links, active tab, focus ring |
| `--color-accent-100` | `#fbeef4` | Tinted panels, notification feed rows |
| `--color-accent-200` | `#f5dce8` | Muted chart bars |
| `--color-accent-300` | `#e8bed2` | Sealed-state bar fill, empty-state icon |
| `--color-accent-400` | `#d193ae` | Coin fill |
| `--color-accent-500` | `#b06e8d` | Coin fill, chart bars, toggle track (non-text) |
| `--color-accent-600` | `#74405c` | **Filled pills, avatars, selected states** (text-bearing) |
| `--color-accent-700` | `#5d3349` | Text on tinted grounds, destructive text, jar lid |
| `--color-accent-800` | `#412433` | — |
| `--color-accent-900` | `#2a1721` | — |
| `--color-accent-2` | `#5f7355` | Second voice, sage |
| `--color-accent-2-100` | `#eef5e6` | Stat cards, info panels |
| `--color-accent-2-300` | `#c4d6b3` | Sealed-state bar fill (partner side) |
| `--color-accent-2-500` | `#829a72` | Coin fill, partner chart bar |
| `--color-accent-2-600` | `#516343` | **Partner avatars, partner selected states** |
| `--color-accent-2-700` | `#3f4f34` | Partner initial on cream disc |
| `--color-accent-2-800` | `#2e3a26` | Headings on sage-tinted panels |
| `--color-text` | `#201e1d` | Body text |
| `--color-neutral-200/300/400/600` | from Organic ramp | Track backgrounds, muted bars, inactive tabs |

**Alternate palettes** (same keys, different values):

- **Pine** — accent `#2f5d50`, bg `#f6f1e6`, surface `#e8e2d4`
- **Ink** — accent `#2f4a7a`, bg `#f6f2ea`, surface `#e7e3d9`
- **Terracotta** — accent `#c67139`, bg `#f5ead8`, surface `#ebddc5` (the Organic system's own default)

Full ramps for each are in the `PALETTES` object at the top of the prototype's logic class.

**Contrast rule — important.** The 500 step of both accent ramps is too light to carry cream text at body sizes (measured 3.42:1 and 2.74:1). Any element with text or a glyph on an accent fill must use the **600 step** (7.11:1 and 5.82:1 respectively). The 500 step is fine for non-text fills — chart bars, coins, toggle tracks. This holds across all four palettes; they share the same too-light 500.

### Typography

| Token | Value |
| --- | --- |
| `--font-heading` | `"Caprasimo", system-ui, sans-serif` |
| `--font-body` | `"Figtree", system-ui, sans-serif` |

Caprasimo is display-only: the wordmark, all screen titles, every currency figure, and stat numbers. Figtree carries everything else. Sizes used, in px:

- Wordmark / screen title in a header row: 19
- Jar total on home: 52 (`letter-spacing: -0.02em`, `line-height: 1`)
- Cash-out total: 56 · Landed-fine amount: 44 · Cashed-out amount: 48
- One-off amount input: 30 · Rule-detail price input: 26
- Screen `<h3>`: Organic default · Section label `<h6>`: Organic default, color `color-mix(in srgb, var(--color-text) 60%, transparent)`
- Body / row labels: 15 · Secondary rows: 14 · Meta and captions: 12–13 · Tab labels: 10 (`letter-spacing: 0.04em`)
- Welcome headline: 40 · Pairing headline: 30 · Invite code: 38 (`letter-spacing: 0.06em`)

### Spacing, radius, shadow

`--space-1: 4.4px` · `--space-2: 8.8px` · `--space-3: 13.2px` · `--space-4: 17.6px` · `--space-6: 26.4px` · `--space-8: 35.2px`

`--radius-sm: 8px` · `--radius-md: 16px` · `--radius-lg: 28px`

`--shadow-sm: 0 1px 2px color-mix(in srgb, #2e2b25 14%, transparent)`
`--shadow-md: 0 3px 10px color-mix(in srgb, #2e2b25 16%, transparent)`
`--shadow-lg: 0 12px 32px color-mix(in srgb, #2e2b25 22%, transparent)`

Applied radii in this app: phone frame 46px · cards and info panels 26–28px · rows, pills, buttons, inputs 999px (fully round) · severity buttons 24px · toggle tracks 999px.

Screen horizontal padding is 24px throughout; header rows use 18–22px. Top padding on every screen is 46px to clear the status bar.

### Interaction states

From Organic, do not restyle per element: hover tints and pressed states come one step further along the accent ramp; keyboard focus is `outline: 2px solid var(--color-accent); outline-offset: 2px`; disabled drops to 45% opacity. Icons are Lucide at `stroke-width: 2.75`.

## Screens / Views

Eleven screens. The prototype routes between them with a single `screen` state string; in production these are real routes.

### 1. Welcome (`welcome`)

**Purpose:** First run. Explain the product in one breath, then branch to create-or-join.

**Layout:** Centered column, 28px padding. Jar SVG 176×220 → wordmark `<h1>` 40px → one-paragraph description, max-width 270px, muted → two stacked full-width buttons, 10px gap.

**Copy:** "Sorry Jar" / "A shared jar for the small stuff. Set your rules, log the fines, spend it on something you both like." / Primary: "Start a jar" (54px tall) / Secondary: "I have an invite code" (50px tall).

### 2. Pairing (`pair`)

**Purpose:** Get the second person in.

**Layout:** Left-aligned. Headline "Invite your / other half" (30px, two lines) → muted explainer → invite card (surface fill, 32px radius, 26×22 padding, centered) → waiting-status row → spacer → ghost button pinned bottom.

**Card contents:** uppercase 11px accent-700 label "Your code" (`letter-spacing: 0.1em`) → code in Caprasimo 38px (`JAR-4K2P`) → muted URL `sorryjar.app/j/4k2p` → two side-by-side buttons 44px: "Copy link" (secondary), "Text it" (primary).

**Status row:** 9px sage dot + muted "Waiting for Sam to join".

**Bottom:** ghost "Skip for now — start logging" → goes to Home. Solo use before pairing is supported.

### 3. Home / Jar (`home`) — the default screen

**Purpose:** See the jar. Log a fine.

**Layout, top to bottom:**
1. Header row: wordmark left; two 17px icon buttons right (bell → Notifications, gear → Settings).
2. Flexible center block: jar SVG 206×258 → total in Caprasimo 52px → muted sub-line → a row of ghost buttons.
3. Ledger block (24px padding): a names-and-figures row (13px; name bold, figure muted) above a 12px-tall split bar, fully rounded, `--color-neutral-200` track.
4. Primary CTA "Log a fine" — 56px tall, plus icon, full width.
5. Bottom tab bar.

**The jar SVG.** A rounded bottle silhouette: body path `M30 64a42 42 0 0 1 42-42h56a42 42 0 0 1 42 42v142a42 42 0 0 1-42 42H72a42 42 0 0 1-42-42z` in a 200×250 viewBox, 3px stroke at 26% text color, lid `rect x=66 y=2 w=68 h=19 rx=9.5` in accent-700, and a 5px white highlight arc at 50% opacity. Coins are circles clipped to the body path, drawn from a fixed 19-slot array stacked bottom-up, cycling seven fills across both accent ramps and neutral-400. Coin count rises by one per fine, capped at 19, and drops to 3 after cash-out. **Replace with real illustration before launch.**

**Sub-line copy:** "{n} fines since 4 March" — or, sealed, "{n} fines in, total sealed".

**Ghost row:** "Peek" with an eye icon (mystery mode only) and "Spend the jar →".

**Split bar:** left segment width = this person's share of the total, animated `width .5s ease`, accent-500; right segment `flex: 1`, accent-2-500.

### 4. Log a fine (`log`)

**Purpose:** Three decisions — who, what, how bad — then commit.

**Layout:** Back button + title header; scrollable body with three labeled sections at 20px gaps; sticky footer with a 1px `--color-divider` top rule and the CTA.

**Who:** two-column grid, 10px gap. Each option is a pill (999px radius, 13×14 padding) holding a 28px avatar disc and the name. Unselected: surface fill, text color, transparent border. Selected: **accent-600** fill, cream text, matching border.

**Avatar-in-pill rule:** when a pill is selected, its avatar must flip to a cream disc (`--color-bg`) with the initial in accent-700 / accent-2-700. Otherwise the disc is the same color as the pill fill and disappears.

**What happened:** one full-width pill row per rule, name left, price right in Caprasimo 15px, same selected treatment. Below the rules, a permanent **"Something else"** row with a right chevron and the label "One-off" — navigates to screen 5.

**How bad:** three-column grid, 8px gap, 24px radius. Each shows the severity name and its multiplier ("×2") at 11px / 0.7 opacity. Defaults to **Bad**.

**Footnote:** muted 12px "Fines are final once logged. Take it up with each other, not the app."

**CTA:** disabled until who and what are both chosen. Label: "Pick who and what" → "Add $5.00 to the jar", where the amount is base price × multiplier, live.

### 5. One-off fine (`oneoff`)

**Purpose:** Fine something that isn't a rule, at an arbitrary price. Reached from "Something else".

**Layout:** Back (→ Log a fine) + title "One-off fine". Sections: Who (identical to screen 4, shared state) → "What happened" free-text input, 48px tall, placeholder "Ate my leftovers" → "How much" → save-as-rule toggle row.

**Amount field:** a 999px surface-filled row holding a 30px Caprasimo "$" at 50% opacity and a borderless transparent 30px Caprasimo input, placeholder "0.00". Below it, four quick-amount pills in a row (`flex: 1` each): $1, $2, $5, $10 — tapping fills the field, and the matching pill shows selected.

**Save as a rule:** a full-width surface row with a 46×27 toggle. Title "Save as a rule", sub "Keep it in the list for next time". When on, submitting also appends `{name, price}` to the rules list so the one-off becomes permanent.

**No severity section** — the amount is already exact. Severity is recorded as `'one-off'`.

**CTA:** disabled until who and a non-zero amount. "Add an amount" → "Add $4.00 to the jar".

### 6. Fine landed (`landed`)

**Purpose:** Confirm, celebrate mildly, offer the only undo.

**Layout:** Full-bleed `--color-accent-100` ground, centered. Jar SVG 190×238 → amount in Caprasimo 44px → attribution line 15px → muted sub-line → two side-by-side 50px buttons.

**Animation:** the newest coin runs `coinDrop` — `translateY(-120px) rotate(-25deg)` at 0 opacity → settled, `.65s cubic-bezier(.34,1.25,.64,1)`, with `transform-origin` at the coin's own center. The whole jar then runs `jarNudge` — down 4px at 35%, up 2px at 70%, `.6s ease` with a `.35s` delay. Gated by the `coinAnimation` prop.

**Copy:** amount / "Alex · Late again" / "Sam just got a notification." Buttons: "Undo" (secondary) and "Done" (primary).

**Undo** removes the fine, decrements the coin count (floor 3), and returns Home. This is the only way to reverse a fine.

### 7. History (`history`)

**Purpose:** The ledger.

**Layout:** `<h3>` title → filter row → scrollable grouped list, 16px between groups.

**Filters:** three pills — "Everyone", and each person by name. Selected uses the filled-pill treatment.

**Groups:** each day is a header row (muted `<h6>` label left, day subtotal right at 12px) above its fines, 7px apart. Group headers derive from the fine's `when` string in the prototype; production should group by real date and label "Today" / "Yesterday" / weekday / date.

**Fine row:** 999px surface pill, 12×16 padding — 28px avatar disc (accent-600 or accent-2-600 by person) → two-line block with the rule name at 14px and muted "severity · when" at 11px → amount right in Caprasimo 16px.

**Empty state:** centered jar outline icon 44px in accent-300, "Nothing yet" in Caprasimo 20px, and muted "Either you've both been good, or someone isn't logging."

### 8. Stats (`stats`)

Four panels, 12px apart, all 28px radius.

1. **Who owes more this month** — surface panel, two vertical bars in a 104px-tall flex row. Each column: figure in Caprasimo 18px above a bar (`border-radius: 18px 18px 8px 8px`, height `20 + share × 56` px) above the name at 12px. Accent-500 and accent-2-500.
2. **Two side-by-side cards** on `--color-accent-2-100` — "Longest streak" (`9 days`, "Sam, in June") and "Total ever" (lifetime figure, "Across 3 jars"). Headings in accent-2-800, figures Caprasimo 26px.
3. **Most expensive rule** — surface panel, up to four rows, each a label/amount line above an 8px accent-500 progress bar on a neutral-200 track, widths relative to the largest. Totals are grouped by the fine's **label**, so one-off fines appear here under their own names.
4. **Worst day of the week** — surface panel, seven bars in a 76px row, 7px apart, 8px radius, heights relative to the heaviest day. The peak day is accent-500, the rest accent-200. Single-letter labels beneath. Caption: "Tuesdays cost you the most. Worth a look."

### 9. Rules (`rules`)

**Purpose:** Manage the rule list and its prices.

**Layout:** `<h3>` "Rules" + muted sub "Both of you have to agree to a change." → scrollable list → add-rule affordance → severity explainer panel.

**Rule row:** full-width surface button, 26px radius, name left at 15px, price right in Caprasimo 16px, right chevron at 45% opacity. Tapping opens Edit rule.

**Add a rule:** secondary button, 48px, plus icon. Tapping swaps it in place for an inline accent-100 panel (26px radius, 16×18 padding) holding a name input and a 92px price input side by side, with "Cancel" and "Add rule" buttons beneath. Saving requires both a name and a non-zero price.

**Severity explainer:** accent-2-100 panel. Heading "Severity" in accent-2-800, body "Every rule has a base price. When you log it, you pick how bad it was and the price multiplies.", then three sage tags: "Mild ×1", "Bad ×2", "Unforgivable ×3".

### 10. Edit rule (`rule`)

**Purpose:** Rename, reprice, or delete one rule.

**Layout:** Back (→ Rules) + "Edit rule". Body: a "Name" field → a "Base price" field styled like the one-off amount row (26px Caprasimo, "$" prefix) → an accent-2-100 panel showing what this rule has cost so far (Caprasimo 26px) and how many times it's been logged → three accent tags previewing the three severity prices, live from the price field ("Mild $2.50", "Bad $5.00", "Unforgivable $7.50").

**Footer:** "Save changes" primary (52px), then a ghost "Delete this rule" in accent-700. Save requires a name and a non-zero price.

### 11. Cash out (`cashout`) → Cashed out (`cashedout`)

**Cash out.** Back + "Spend the jar". Body: the total centered in Caprasimo 56px with a muted "{n} fines, all forgiven" beneath → "Where's it going" section, one full-width option row per destination (26px radius, 15×18 padding). Each row has an 18px radio circle (2px accent border; when selected, accent fill with `inset 0 0 0 3px var(--color-bg)` to make a ring) and a two-line label. Selected rows take an accent-100 fill and a 1px accent border.

Destinations: **Date night** ("Somewhere neither of you has to cook") · **Trip to Lisbon** ("$248 of $1,200 saved") · **Charity** ("Goes out the same day") · **Spin the wheel** ("Let the app decide").

Footer: CTA "Cash out $48.50" (or "Cash out and reveal" when sealed) above muted 12px "This empties the jar and starts a fresh one."

**Cashed out.** Accent-100 ground, centered. Jar SVG 168×210 (now nearly empty) → muted "Emptied the jar" → amount in Caprasimo 48px → "went to Date night" at 15px → muted note → "Start a new jar" primary.

Picking "Spin the wheel" resolves to a random real destination from the other three, and the note becomes "The wheel picked it. No appeals." Otherwise: "Agreed by both of you."

Cash-out empties the fines list, resets coins to 3, and adds the amount to the lifetime total.

### Notifications (`notifications`)

Reached from the bell on Home. Back + title. Two sections:

**Recent** — up to four accent-100 rows, each a 9px colored dot (person's accent) beside a two-line block: the event at 14px and muted "rule · when" at 12px. Text is attributed by who *logged* it, not who was fined:
- You logged it on them → "You fined Sam $5.00"
- You logged it on yourself → "You fined yourself $3.00"
- They logged it on you → "Sam fined you $5.00"
- They logged it on themselves → "Sam fined themselves $2.50"

Empty: muted "Quiet in here."

**Tell me when** — three toggle rows on surface, 26px radius:
- "Sam fines you" / "The moment it lands"
- "Sam fines themselves" / "Rare, but worth celebrating"
- "The jar hits a round number" / "$50, $100, and so on"

Footnote: "Nothing else will buzz you. No streak nags, no weekly recaps." The client explicitly declined streak reminders, weekly recaps, and re-engagement nudges — do not add them.

### Settings (`settings`)

Back + title. In order:

1. **Names** — two labeled inputs, "You" and "Them". These drive every name in the app; empty falls back to "You" / "Them".
2. **Mystery jar** toggle — see below.
3. **Pairing status** — accent-2-100 row: sage dot, "Paired with Sam", tag "Since March".
4. **Three static surface rows** — Currency (USD $), Jar started (4 March), Export history (CSV).
5. Ghost "Reset this demo" in accent-700 (prototype affordance; drop or repurpose in production).

## Mystery jar

An opt-in mode where the couple stops watching the number. Off by default.

When on, every figure that could reconstruct the running total is masked by replacing each digit with `•` while keeping the currency symbol and decimal shape — `$48.50` → `$••.••`. Masked surfaces:

- Home: the total, both ledger figures, and the sub-line ("{n} fines in, total sealed")
- Home split bar: forced to an even 50/50 in the **300** ramp steps, so the ratio itself gives nothing away
- Stats: both "who owes more" figures, and every "most expensive rule" amount
- History: the day subtotals
- Cash out: the total, and the CTA becomes "Cash out and reveal"

Deliberately **not** masked: individual fine amounts in History and on the landed screen — you know what each fine cost, you just lose the tally — and the lifetime "Total ever" stat.

**Peek** appears on Home only in this mode: tapping reveals every masked figure and the true bar split for **2200ms**, then re-seals. The button label switches to "Hiding again…" while revealed. The timer must be cleared on unmount and reset if tapped again mid-reveal.

This is the one feature where a partial implementation is worse than none — any single unmasked figure that reveals the total defeats it. When adding a new screen that shows money, decide explicitly whether it's sealed.

## Interactions & Behavior

**Navigation.** Bottom tab bar on Home, History, Stats, Rules only — hidden on every pushed screen (Log, One-off, Landed, Rule detail, Cash out, Cashed out, Notifications, Settings) and during onboarding. Active tab is `--color-accent`, inactive `--color-neutral-600`. Four tabs: Jar, History, Stats, Rules.

**Screen transitions.** Every screen mounts with `riseIn` — `translateY(14px)` and 0 opacity → settled, `.28s ease`.

**Coin animation.** Described under screen 6. Governed by the `coinAnimation` prop; when off, coins still accumulate but land without motion.

**Row hover.** `.sj-row:hover` takes `color-mix(in srgb, var(--color-text) 5%, transparent)`.

**Status bar.** The prototype draws a fake iOS status bar (9:41, signal, battery) pinned at the top of the frame, `pointer-events: none`. Drop it in production — the real OS provides it — but keep the 46px top padding as safe-area inset.

**Amount parsing.** All money inputs strip everything but digits and `.`, parse as float, and round to two decimals. A zero or unparseable amount blocks submission.

## State Management

Prototype state, all local to one component:

| Key | Type | Notes |
| --- | --- | --- |
| `screen` | string | One of the eleven screen ids |
| `me`, `partner` | string | Display names, default "Alex" / "Sam" |
| `fines` | Fine[] | Newest first |
| `rules` | Rule[] | Seeded with three, user-extensible |
| `nextId` | number | Id counter for fines and rules |
| `who` | `'A' \| 'S' \| null` | Who the in-progress fine is on |
| `ruleId` | string \| null | Selected rule, or `'custom'` for a one-off |
| `sev` | `'mild' \| 'bad' \| 'unforgivable'` | Defaults to `'bad'` |
| `customName`, `customAmt` | string | One-off draft |
| `saveAsRule` | boolean | Promote the one-off to a rule on submit |
| `lastFine` | Fine \| null | Powers the landed screen and Undo |
| `coins` | number | 0–19, visual only |
| `animCoin` | boolean | True for one render after a fine lands |
| `filter` | `'all' \| 'A' \| 'S'` | History filter |
| `dest` | string | Selected cash-out destination |
| `cashedAmt`, `cashedDest`, `cashedSpun` | number, string, boolean | Cashed-out screen payload |
| `totalEver` | number | Lifetime across jars, seeded at 112 |
| `notif` | `{fined, selfFined, milestone}` | All true by default |
| `mystery`, `peeking` | boolean | Sealed mode and its temporary reveal |
| `addingRule`, `newRuleName`, `newRulePrice` | boolean, string, string | Inline add-rule form |
| `editingRuleId`, `editName`, `editPrice` | string \| null, string, string | Edit-rule form |

**Data shape.**

```ts
type Person = 'A' | 'S';            // A = "me", S = partner
type Severity = 'mild' | 'bad' | 'unforgivable' | 'one-off';

type Rule = {
  id: string;
  name: string;
  price: number;                    // base, in currency units
};

type Fine = {
  id: number;
  who: Person;                      // who it's on
  by: Person;                       // who logged it — drives notification copy
  rule: string;                     // Rule id, or 'custom'
  label: string;                    // denormalized name at time of logging
  sev: Severity;
  amt: number;                      // price × multiplier, or the exact one-off
  when: string;                     // prototype uses a display string; use a timestamp
  day: number;                      // 0–6, for the day-of-week chart
};
```

`label` is stored on the fine rather than resolved through `rule` at read time — deliberately. Renaming or deleting a rule must not rewrite history, and one-off fines have no rule to point at. Keep this.

**Seed data.** Three rules (Swearing $1.00, Late again $2.50, Phone at dinner $2.00), four cash-out destinations, and 17 demo fines totaling $48.50 — Alex $31.00, Sam $17.50, jar started 4 March. Useful as fixtures.

**Key transitions.**

- *Submit fine* — validate → build the Fine → prepend to `fines`, set `lastFine`, increment `coins` (cap 19), set `animCoin`, go to `landed`, clear the draft. If `saveAsRule`, also append a Rule.
- *Undo* — remove `lastFine` from `fines`, decrement `coins` (floor 3), clear `lastFine` and `animCoin`, go to `home`.
- *Cash out* — resolve the destination (spin the wheel picks randomly from the non-wheel three) → empty `fines`, coins to 3, add the amount to `totalEver`, store the payload, go to `cashedout`.
- *Save rule edit* — validate name and price → map over `rules` replacing the one being edited → back to `rules`. Existing fines keep their stored `label` and `amt`.
- *Toggle mystery* — flips `mystery`, always clears `peeking`.

## Backend Notes

Not in the prototype; needed for production.

- **Auth and pairing.** Sign in with Apple/Google, then pair by invite code or link (`sorryjar.app/j/<code>`), with SMS invite as an option. Solo use before pairing must work — the client asked for it explicitly.
- **Sync.** Both people need to see a fine the moment it lands. Realtime subscription or short-poll.
- **Push.** Three triggers only: partner fined you, partner fined themselves, jar crossed a round number ($50, $100, …). Nothing else.
- **Persistence.** Fines, rules, names, jar start date, cash-out history (`totalEver` is a sum over past cash-outs), and per-user settings including mystery mode.
- **Export.** The Settings row promises CSV of fine history.
- **Money.** Tracked only. No payment rails, no balance transfer, no cash-out disbursement.

## Assets

- **Organic design system** — `_ds/organic-8646d193-7cc4-44e4-9abc-08c424cfead3/` is included in this bundle (`styles.css` is the one stylesheet; the bundle JS carries its components). Link it or port its tokens.
- **Fonts** — Caprasimo and Figtree, both Google Fonts, loaded by the Organic stylesheet.
- **Icons** — Lucide, `stroke-width: 2.75`. Used: settings/gear, bell, chevron-left, chevron-right, plus, eye, and three inline bar/line glyphs for the tab bar. The jar tab glyph is a custom bottle outline drawn to match the hero SVG.
- **Jar illustration** — hand-built inline SVG, placeholder quality. Needs real artwork.
- **No photography** in the current design. Organic expects photographs to go through its `.washed` wrapper if any are added.

## Files

- `Sorry Jar.dc.html` — the complete prototype: all eleven screens, all state, all animation. Open it in a browser to click through.
- `_ds/organic-8646d193-7cc4-44e4-9abc-08c424cfead3/` — the Organic design system: `styles.css` (tokens + components), the component bundle, and `readme.md` (the system's own usage guide).
- `support.js` — runtime for the prototype's component format. Not needed in production.
