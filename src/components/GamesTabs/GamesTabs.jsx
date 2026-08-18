import styles from './GamesTabs.module.css';

const TABS = [
  { id: 'battlefield4', label: 'BATTLEFIELD 4' },
  { id: 'counterstrike', label: 'COUNTER-STRIKE 2' },
  { id: 'runescape', label: 'RUNESCAPE' },
];

export default function GamesTabs({ activeTab, onTabChange }) {
  return (
    <nav className={styles.tabs}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
