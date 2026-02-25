import { useSettingsStore } from '../stores/settingsStore';
import styles from './Settings.module.css';

const ACCENT_COLORS = [
  { value: '#5f8f8f', label: 'Teal' },
  { value: '#8f5f5f', label: 'Rust' },
  { value: '#5f6f8f', label: 'Steel' },
  { value: '#6f8f5f', label: 'Moss' },
  { value: '#8f6f8f', label: 'Mauve' },
  { value: '#8f8f5f', label: 'Sand' },
];

const FONT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export default function Settings() {
  const {
    theme,
    accentColor,
    soundEnabled,
    soundVolume,
    effectsEnabled,
    crtFilter,
    particlesEnabled,
    reduceMotion,
    fontSize,
    setTheme,
    setAccentColor,
    setSoundEnabled,
    setSoundVolume,
    setEffectsEnabled,
    setCrtFilter,
    setParticlesEnabled,
    setReduceMotion,
    setFontSize,
    resetAll,
  } = useSettingsStore();

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>DISPLAY</h3>
          <div className={styles.setting}>
            <label className={styles.label}>Theme</label>
            <div className={styles.segmented}>
              <button
                className={`${styles.segmentBtn} ${theme === 'dark' ? styles.segmentActive : ''}`}
                onClick={() => setTheme('dark')}
              >
                DARK
              </button>
              <button
                className={`${styles.segmentBtn} ${theme === 'light' ? styles.segmentActive : ''}`}
                onClick={() => setTheme('light')}
              >
                LIGHT
              </button>
            </div>
          </div>

          <div className={styles.setting}>
            <label className={styles.label}>Font Size</label>
            <div className={styles.segmented}>
              {FONT_SIZES.map((fs) => (
                <button
                  key={fs.value}
                  className={`${styles.segmentBtn} ${fontSize === fs.value ? styles.segmentActive : ''}`}
                  onClick={() => setFontSize(fs.value)}
                >
                  {fs.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.setting}>
            <label className={styles.label}>Accent Color</label>
            <div className={styles.colorPicker}>
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`${styles.colorSwatch} ${accentColor === c.value ? styles.colorActive : ''}`}
                  style={{ '--swatch': c.value }}
                  onClick={() => setAccentColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>EFFECTS</h3>
          <div className={styles.setting}>
            <label className={styles.label}>Visual Effects</label>
            <Toggle value={effectsEnabled} onChange={setEffectsEnabled} />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>CRT Scanline Filter</label>
            <Toggle value={crtFilter} onChange={setCrtFilter} />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>Particle Effects</label>
            <Toggle value={particlesEnabled} onChange={setParticlesEnabled} />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>Reduce Motion</label>
            <Toggle value={reduceMotion} onChange={setReduceMotion} />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>AUDIO</h3>
          <div className={styles.setting}>
            <label className={styles.label}>Sound Effects</label>
            <Toggle value={soundEnabled} onChange={setSoundEnabled} />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>Volume</label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                disabled={!soundEnabled}
              />
              <span className={styles.sliderValue}>
                {Math.round(soundVolume * 100)}%
              </span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>SYSTEM</h3>
          <div className={styles.setting}>
            <button className={styles.resetButton} onClick={resetAll}>
              RESET TO DEFAULTS
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
    >
      <span className={styles.toggleThumb} />
      <span className={styles.toggleLabel}>{value ? 'ON' : 'OFF'}</span>
    </button>
  );
}
