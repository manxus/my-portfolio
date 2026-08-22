import { GAMES } from '../../pages/games/registry';
import styles from './GamesTabs.module.css';

export default function GamesTabs({ activeTab, onTabChange }) {
  return (
    <nav className={styles.tabs}>
      {GAMES.map((game) => (
        <button
          key={game.id}
          className={`${styles.tab} ${activeTab === game.id ? styles.active : ''}`}
          onClick={() => onTabChange(game.id)}
        >
          {game.label}
        </button>
      ))}
    </nav>
  );
}
