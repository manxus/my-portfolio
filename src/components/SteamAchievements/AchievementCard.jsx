import { fmtDate, fmtPct, rarityLabel } from './achievementShared';
import styles from './AchievementCard.module.css';

export default function AchievementCard({ ach }) {
  const icon = ach.unlocked ? ach.iconUrl : ach.iconGrayUrl || ach.iconUrl;
  const date = fmtDate(ach.unlockTime);
  const tier = rarityLabel(ach.globalPct);
  return (
    <div
      className={`${styles.achCard} ${ach.unlocked ? '' : styles.achLocked}`}
      title={ach.description || ach.name}
    >
      <div className={styles.achIconWrap}>
        {icon ? (
          <img
            className={styles.achIcon}
            src={icon}
            alt=""
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className={styles.achIconFallback} aria-hidden="true">
            ?
          </div>
        )}
      </div>
      <div className={styles.achBody}>
        <p className={styles.achName}>{ach.name}</p>
        {ach.gameName && <p className={styles.achGame}>{ach.gameName}</p>}
        <div className={styles.achMeta}>
          <span className={styles.achRarity} data-tier={tier || undefined}>
            {fmtPct(ach.globalPct)}
            {tier ? ` · ${tier}` : ''}
          </span>
          {ach.unlocked ? (
            date && <span className={styles.achDate}>{date}</span>
          ) : (
            <span className={styles.achStatus}>LOCKED</span>
          )}
        </div>
      </div>
    </div>
  );
}
