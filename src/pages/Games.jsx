import { useState } from 'react';
import GamesTabs from '../components/GamesTabs/GamesTabs';
import Battlefield4 from './Battlefield4';
import CounterStrike from './CounterStrike';
import RuneScape from './RuneScape';

/**
 * Shell for the per-game stat pages. Each tab keeps its own page component untouched -- they bring
 * their own container, layout observer and palette -- so this only owns which one is mounted.
 */
export default function Games() {
  const [activeTab, setActiveTab] = useState('battlefield4');

  return (
    <div>
      <GamesTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'battlefield4' && <Battlefield4 />}
      {activeTab === 'counterstrike' && <CounterStrike />}
      {activeTab === 'runescape' && <RuneScape />}
    </div>
  );
}
