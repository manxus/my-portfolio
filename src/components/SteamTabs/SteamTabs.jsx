import styles from './SteamTabs.module.css';

const TABS = [
  { id: 'library', label: 'LIBRARY' },
  { id: 'wishlist', label: 'WISHLIST' },
  { id: 'reviews', label: 'REVIEWS' },
  { id: 'tierlist', label: 'TIER LIST' },
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
