'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser Supabase client.
 *
 * Returns null when the project is not configured, and that is a supported
 * state, not an error: with no client the app runs exactly as it always has —
 * seed data in localStorage — so the demo keeps working for anyone without an
 * account, and a missing env var can never blank the screen.
 *
 * `NEXT_PUBLIC_` values are compiled into the bundle and readable by anyone.
 * That is fine for the URL and the publishable/anon key; row level security is
 * what actually protects the data. Never reach for the service_role key here.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Supabase is migrating from the legacy `anon` JWT to a publishable key.
// Accept either, preferring the newer one.
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  if (typeof window === 'undefined' || !url || !key) {
    cached = null;
    return cached;
  }

  cached = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The magic-link callback is handled client side, so the static
      // Capacitor build needs no server route to complete a sign-in.
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return cached;
}

/** True when the project is configured at all. Cheap, and safe during SSR. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}
