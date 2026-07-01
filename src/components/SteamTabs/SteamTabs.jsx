import styles from './SteamTabs.module.css';

const TABS = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'library', label: 'LIBRARY' },
  { id: 'achievements', label: 'ACHIEVEMENTS' },
  { id: 'wishlist', label: 'WISHLIST' },
  { id: 'reviews', label: 'REVIEWS' },
  { id: 'tierlist', label: 'TIER LIST' },
  { id: 'milestones', label: 'MILESTONES' },
];

export default function SteamTabs({ activeTab, onTabChange }) {
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
