import { useState, useMemo } from 'react';
import styles from './SteamWishlist.module.css';

function libraryCapsuleUrl(appId) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

function WishlistCard({ item }) {
  const [phase, setPhase] = useState('library');

  const handleImgError = () => {
    setPhase((p) => {
      if (p === 'library') return item.headerUrl ? 'header' : 'none';
      return 'none';
    });
  };

  const showImage = phase === 'library' || (phase === 'header' && Boolean(item.headerUrl));

  return (
    <a
      href={`https://store.steampowered.com/app/${item.appId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      aria-label={item.name}
    >
      <div className={styles.cardInner}>
        {showImage && (
          <img
            src={phase === 'library' ? libraryCapsuleUrl(item.appId) : item.headerUrl}
            alt=""
            className={styles.image}
            loading="lazy"
            onError={handleImgError}
          />
        )}
        {!showImage && (
          <div className={styles.placeholder}>
            <span className={styles.placeholderTitle}>{item.name}</span>
          </div>
        )}
      </div>
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
