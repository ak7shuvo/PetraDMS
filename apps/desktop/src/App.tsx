import { useEffect, useState } from 'react';
import type { Health, PetraApi } from '@petra/core';

declare global {
  interface Window {
    petra: PetraApi;
  }
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.petra.invoke('app:health').then(setHealth).catch((e: unknown) => setError(String(e)));
  }, []);

  return (
    <main style={{ padding: 32 }}>
      <h1 data-testid="title">PetraDMS</h1>
      {error && <p data-testid="error">{error}</p>}
      {health && (
        <dl data-testid="health">
          <dt>Journal mode</dt>
          <dd data-testid="journal-mode">{health.journalMode}</dd>
          <dt>Integrity</dt>
          <dd data-testid="integrity">{health.integrity}</dd>
          <dt>Packaged</dt>
          <dd data-testid="packaged">{String(health.packaged)}</dd>
        </dl>
      )}
    </main>
  );
}
