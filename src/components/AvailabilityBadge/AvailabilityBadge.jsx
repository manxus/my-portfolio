import { resolveAvailability } from '../../utils/availability';
import styles from './AvailabilityBadge.module.css';

export default function AvailabilityBadge({ availability, variant = 'header' }) {
  const resolved = resolveAvailability(availability);
  if (!resolved) return null;

  const { label, dotClass, note } = resolved;

  if (variant === 'inline') {
    return (
      <span className={styles.inlineValue}>
        <span className={`${styles.dot} ${styles[dotClass]}`} aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <div className={styles.headerBadge}>
      <div className={styles.headerRow}>
        <span className={`${styles.dot} ${styles[dotClass]}`} aria-hidden />
        <span className={styles.label}>{label}</span>
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}
