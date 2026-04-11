import { useState, useMemo } from 'react';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import styles from './SteamWishlist.module.css';

function WishlistCard({ item }) {
  return (
    <a
      href={`https://store.steampowered.com/app/${item.appId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      aria-label={item.name}
    >
      <SteamGameCover
        fill
        appId={item.appId}
        title={item.name}
        headerUrl={item.headerUrl}
      />
    </a>
  );
}

export default function SteamWishlist({ wishlist }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? [...wishlist]
      : wishlist.filter((item) => item.name.toLowerCase().includes(q));
    list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
        numeric: true,
      }),
    );
    return list;
  }, [wishlist, search]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <input
          type="text"
          placeholder="Search wishlist…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
        <span className={styles.count}>{filtered.length} items</span>
      </div>

      {filtered.length === 0 && (
        <p className={styles.empty}>No wishlist items match your search.</p>
      )}

      <div className={styles.grid}>
        {filtered.map((item) => (
          <WishlistCard key={item.appId} item={item} />
        ))}
      </div>
    </div>
  );
}
