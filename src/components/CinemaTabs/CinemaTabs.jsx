import styles from './CinemaTabs.module.css';

export default function CinemaTabs({ tabs, activeTab, onTabChange }) {
  return (
    <nav className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
          {tab.count != null && <span className={styles.count}>{tab.count}</span>}
        </button>
      ))}
    </nav>
  );
}
