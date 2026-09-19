# Deployment

## Vercel

The project has to be created under the Vercel account that will own it — importing the repo is
the whole setup, since Next.js needs no configuration on Vercel.

1. **Import the repo.** Vercel → Add New → Project → import `sorry-jar-app/jar-app`.
   If the repo does not appear, the Vercel GitHub app has not been granted access to the
   `sorry-jar-app` org: *Adjust GitHub App Permissions* on the import screen, or
   GitHub → org Settings → GitHub Apps → Vercel → Repository access.

2. **Settings — all defaults.** Framework preset auto-detects as Next.js. Do not override the
   build command, output directory or install command; `next.config.ts` only switches to a static
   export when `BUILD_TARGET=capacitor` is set, which Vercel must **not** set.

3. **Environment variables** (Production, Preview and Development):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | from the Supabase project's API settings |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page |

   The anon key is public by design — row level security is what protects the data.
   **Never** add the `service_role` key, and never prefix anything secret with `NEXT_PUBLIC_`.

4. **Domain.** Production domain is `sorryjar.app`, which is what the Pairing screen's invite link
   already says (`sorryjar.app/j/4k2p`, `src/lib/constants.ts`). Changing the production domain
   means changing that constant too, or the invite link lies.

   Add it under Project → Settings → Domains. Vercel prints the exact DNS records to create at the
   registrar on that screen — use those rather than any value written down here, since they vary by
   domain and change over time. The usual shape is an `A` record on the apex and a `CNAME` on
   `www`. Point `imsorryjar.app` and `imsorry.app` at the same project as redirects.

## Supabase

The GitHub integration applies `supabase/migrations` on merge to `main`. In Supabase → Settings →
Integrations → GitHub: repository `sorry-jar-app/jar-app`, working directory `.`, production
branch `main`.

Schema and the reasoning behind it: [`supabase/README.md`](supabase/README.md).

## Capacitor

The native projects are not committed — generate them once, locally:

```bash
npx cap add ios          # needs Xcode
npx cap add android      # needs Android Studio
npm run cap:ios          # static build, sync, open Xcode
```

`npm run cap:sync` rebuilds `out/` and copies it into both platforms. Because that build is a
static export, **anything server-only must stay behind a route handler the native app calls over
HTTPS** — never a server component, or the native build will silently lose it.
