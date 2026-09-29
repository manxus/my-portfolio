import { useEffect } from 'react';
import { useScrollOverflow } from '../../hooks/useScrollOverflow';
import { TABS } from './tabs';
import styles from './SteamTabs.module.css';

export default function SteamTabs({ activeTab, onTabChange }) {
  const {
    ref: navRef,
    overflow,
    onScroll: measure,
    scrollByPage: scrollBy,
  } = useScrollOverflow();

  // Keep the active tab fully visible, e.g. after picking one that was half
  // under a fade, or landing on a tab from the far end. Scrolls only the
  // strip itself, so the page never jumps.
  useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector('[aria-current="page"]');
    if (!tab) return;
    const pad = 32;
    const start = tab.offsetLeft - pad;
    const end = tab.offsetLeft + tab.offsetWidth + pad - nav.clientWidth;
    if (nav.scrollLeft > start) nav.scrollTo({ left: start, behavior: 'smooth' });
    else if (nav.scrollLeft < end) nav.scrollTo({ left: end, behavior: 'smooth' });
  }, [activeTab, navRef]);

  return (
    <div className={styles.wrap}>
      <nav ref={navRef} className={styles.tabs} onScroll={measure}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {/* Mouse users have no swipe, so the fades double as scroll buttons.
          Keyboard users already reach every tab with Tab, hence tabIndex -1. */}
      <button
        type="button"
        className={`${styles.edge} ${styles.edgeLeft}`}
        data-visible={overflow.left ? 'true' : undefined}
        onClick={() => scrollBy(-1)}
        tabIndex={-1}
        aria-label="Scroll tabs left"
      >
        &#8249;
      </button>
      <button
        type="button"
        className={`${styles.edge} ${styles.edgeRight}`}
        data-visible={overflow.right ? 'true' : undefined}
        onClick={() => scrollBy(1)}
        tabIndex={-1}
        aria-label="Scroll tabs right"
      >
        &#8250;
      </button>
    </div>
  );
}
