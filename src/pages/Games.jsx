import { useState, Suspense } from 'react';
import GamesTabs from '../components/GamesTabs/GamesTabs';
import { GAMES, DEFAULT_GAME } from './games/registry';

/**
 * Shell for the per-game stat pages. Each tab keeps its own page component untouched -- they bring
 * their own container, layout observer and palette -- so this only owns which one is mounted.
 */
export default function Games() {
  const [activeTab, setActiveTab] = useState(DEFAULT_GAME);

  const active = GAMES.find((game) => game.id === activeTab) ?? GAMES[0];
  const { Component } = active;

  return (
    <div>
      <GamesTabs activeTab={active.id} onTabChange={setActiveTab} />

      {/* No spinner: the chunks are small and a flash of loading chrome on every tab press reads
          worse than the tab simply taking a beat to paint. */}
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    </div>
  );
}
