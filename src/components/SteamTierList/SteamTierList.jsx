import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import steamTierlistData from '../../data/steam-tierlist.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import styles from './SteamTierList.module.css';

const { tierLists } = steamTierlistData;

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export default function SteamTierList({ games }) {
  const [activeCategory, setActiveCategory] = useState(
    tierLists[0]?.category || '',
  );

  const gameMap = useMemo(() => {
    const m = {};
    for (const g of games) m[g.appId] = g;
    return m;
  }, [games]);

  const activeTierList = tierLists.find((t) => t.category === activeCategory);

  if (tierLists.length === 0) {
    return (
      <p className={styles.empty}>No tier lists yet. Check back soon.</p>
    );
  }

  return (
    <EditableSection collection="steam-tierlist" dataKey="tierLists">
      <div className={styles.container}>
        <div className={styles.categoryBar}>
          {tierLists.map((tl, i) => (
            <button
              key={tl.category}
              className={`${styles.categoryBtn} ${activeCategory === tl.category ? styles.categoryActive : ''}`}
              onClick={() => setActiveCategory(tl.category)}
            >
              {tl.category.toUpperCase()}
              <EditableItemControls index={i} />
            </button>
          ))}
        </div>

        {activeTierList && (
          <motion.div
            key={activeCategory}
            className={styles.tierGrid}
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {TIER_ORDER.map((tier) => {
              const appIds = activeTierList.tiers[tier] || [];
              return (
                <motion.div
                  key={tier}
                  className={styles.tierRow}
                  variants={fadeUp}
                >
                  <div
                    className={styles.tierLabel}
                    data-tier={tier}
                  >
                    {tier}
                  </div>
                  <div className={styles.tierGames}>
                    {appIds.length === 0 && (
                      <span className={styles.tierEmpty}>---</span>
                    )}
                    {appIds.map((id) => {
                      const game = gameMap[id];
                      if (!game) return null;
                      return (
                        <div key={id} className={styles.gameThumb} title={game.name}>
                          <img
                            src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`}
                            alt={game.name}
                            className={styles.gameImg}
                            loading="lazy"
                            onError={(e) => {
                              e.target.src = game.headerUrl;
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </EditableSection>
  );
}
