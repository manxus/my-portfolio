import { useSettingsStore } from '../../stores/settingsStore';
import styles from './CrtOverlay.module.css';

export default function CrtOverlay() {
  const crtFilter = useSettingsStore((s) => s.crtFilter);
  const effectsEnabled = useSettingsStore((s) => s.effectsEnabled);

  if (!crtFilter || !effectsEnabled) return null;

  return <div className={styles.overlay} />;
}
