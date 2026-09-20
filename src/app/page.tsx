'use client';

/**
 * Welcome — first run. One breath of explanation, then create-or-join.
 *
 * The two buttons part here. Starting a jar goes through the names step;
 * arriving with a code goes straight to /pair?join=1, which leads with the code
 * box rather than an invite the user has no use for. The hint rides in the URL
 * because it lives for exactly one navigation. It skips the names step because
 * a joiner's names come from the jar they are joining — and because relaying it
 * through /setup would mean a Suspense boundary on a screen that reads nothing.
 *
 * This is also the gate: anyone who has already been through pairing — either
 * by finishing it or by skipping it — goes straight to the jar instead.
 *
 * Both buttons are HeroUI's in the app's .btn clothes. The second one is a
 * ghost, not a secondary: HeroUI's secondary variant paints a neutral fill,
 * and this button is a hairline border on the page. Ghost is the transparent
 * one; .btn-secondary supplies the border.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { Jar } from '@/components/Jar';
import { useStore } from '@/lib/store';

export default function WelcomePage() {
  const router = useRouter();
  const { state, hydrated } = useStore();
  const startJar = () => router.push('/setup');
  const joinJar = () => router.push('/pair?join=1');

  useEffect(() => {
    // replace, not push, so Back does not come straight back here.
    if (hydrated && state.onboarded) router.replace('/jar');
  }, [hydrated, state.onboarded, router]);

  // Hold the first paint until the persisted flag is known, so a returning
  // user never sees a frame of the first-run screen.
  if (!hydrated || state.onboarded) return null;

  return (
    <div className="sj-screen sj-screen--centered">
      <Jar
        width={176}
        height={220}
        coins={3}
        fill="var(--color-accent-100)"
        fillOpacity={0.6}
        highlightOpacity={0.55}
      />

      <h1 style={{ fontSize: 40, margin: '14px 0 8px' }}>Sorry Jar</h1>

      <p className="text-muted" style={{ fontSize: 15, maxWidth: 270, textWrap: 'pretty' }}>
        A shared jar for the small stuff. Set your rules, log the fines, spend it on something you
        both like.
      </p>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 22 }}
      >
        <Button
          className="btn btn-primary btn-block"
          variant="primary"
          fullWidth
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          onPress={startJar}
        >
          Start a jar
        </Button>
        <Button
          className="btn btn-secondary btn-block"
          variant="ghost"
          fullWidth
          style={{ height: 50, fontSize: 15, marginTop: 0 }}
          onPress={joinJar}
        >
          I have an invite code
        </Button>
      </div>
    </div>
  );
}
