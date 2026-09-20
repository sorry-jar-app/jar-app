'use client';

/**
 * A route that does not exist.
 *
 * Worth having its own screen rather than Next's default: under the Capacitor
 * static export a missing path dead-ends in the WebView with no browser chrome
 * and no way back into the app at all.
 */

import { Button } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { Jar } from '@/components/Jar';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="sj-screen sj-screen--centered">
      <Jar width={140} height={175} coins={0} showLidShade={false} showHighlight={false} />

      <h2 style={{ fontSize: 24, margin: '18px 0 6px' }}>Nothing here</h2>
      <p className="text-muted" style={{ fontSize: 14, margin: 0, maxWidth: 260 }}>
        Whatever this was, it is not any more.
      </p>

      <Button
        size="lg"
        fullWidth
        style={{ marginTop: 26 }}
        onPress={() => router.replace('/jar')}
      >
        Back to the jar
      </Button>
    </div>
  );
}
