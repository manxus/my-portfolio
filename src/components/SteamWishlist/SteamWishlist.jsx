import { useState, useMemo } from 'react';
import styles from './SteamWishlist.module.css';

export default function SteamWishlist({ wishlist }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wishlist;
    return wishlist.filter((item) => item.name.toLowerCase().includes(q));
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
          <a
            key={item.appId}
            href={`https://store.steampowered.com/app/${item.appId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.card}
          >
            <img
              src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${item.appId}/library_600x900.jpg`}
              alt={item.name}
              className={styles.image}
              loading="lazy"
              onError={(e) => {
                e.target.src = item.headerUrl;
                e.target.style.objectFit = 'cover';
              }}
            />
            {item.priority === 0 && (
              <span className={styles.badge}>COMING SOON</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
