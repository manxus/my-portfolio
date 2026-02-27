import { useSettingsStore } from '../stores/settingsStore';
import { useSound } from '../hooks/useSound';
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

const PARTICLE_SPEEDS = [
  { value: 0.5, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 2, label: 'Fast' },
  { value: 4, label: 'Ludicrous' },
];

const SOUND_THEMES = [
  { value: 'default', label: 'Default' },
  { value: 'retro', label: 'Retro' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'soft', label: 'Soft' },
  { value: 'scifi', label: 'Sci-Fi' },
];

const COLORBLIND_MODES = [
  { value: 'none', label: 'None' },
  { value: 'protanopia', label: 'Protanopia' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'tritanopia', label: 'Tritanopia' },
];

export default function Settings() {
  const {
    theme,
    accentColor,
    soundEnabled,
    soundVolume,
    soundTheme,
    effectsEnabled,
    crtFilter,
    particlesEnabled,
    reduceMotion,
    fontSize,
    particleSpeed,
    colorblindMode,
    monochrome,
    setTheme,
    setAccentColor,
    setSoundEnabled,
    setSoundVolume,
    setSoundTheme,
    setEffectsEnabled,
    setCrtFilter,
    setParticlesEnabled,
    setReduceMotion,
    setFontSize,
    setParticleSpeed,
    setColorblindMode,
    setMonochrome,
    resetAll,
  } = useSettingsStore();

  const { play } = useSound();

  const previewSound = (themeValue) => {
    setSoundTheme(themeValue);
    setTimeout(() => play('select'), 50);
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>

        {/* ---- ACCESSIBILITY ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>ACCESSIBILITY</h3>
          <div className={styles.setting}>
            <label className={styles.label}>Colorblind Mode</label>
            <div className={styles.segmented}>
              {COLORBLIND_MODES.map((cm) => (
                <button
                  key={cm.value}
                  className={`${styles.segmentBtn} ${colorblindMode === cm.value ? styles.segmentActive : ''} ${monochrome ? styles.segmentDisabled : ''}`}
                  onClick={() => setColorblindMode(cm.value)}
                  disabled={monochrome}
                >
                  {cm.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>
              Monochrome
              <span className={styles.hint}>Full grayscale filter</span>
            </label>
            <Toggle value={monochrome} onChange={setMonochrome} />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>
              Reduce Motion
              <span className={styles.hint}>Disables transitions &amp; animations</span>
            </label>
            <Toggle value={reduceMotion} onChange={setReduceMotion} />
          </div>
        </section>

        {/* ---- AUDIO ---- */}
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
          <div className={styles.setting}>
            <label className={styles.label}>
              Sound Theme
              <span className={styles.hint}>Click to preview each theme</span>
            </label>
            <div className={styles.segmented}>
              {SOUND_THEMES.map((st) => (
                <button
                  key={st.value}
                  className={`${styles.segmentBtn} ${soundTheme === st.value ? styles.segmentActive : ''} ${!soundEnabled ? styles.segmentDisabled : ''}`}
                  onClick={() => previewSound(st.value)}
                  disabled={!soundEnabled}
                >
                  {st.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---- DISPLAY ---- */}
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

        {/* ---- EFFECTS ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>EFFECTS</h3>
          <div className={styles.setting}>
            <label className={styles.label}>
              Visual Effects
              <span className={styles.hint}>Master toggle for all visual effects</span>
            </label>
            <Toggle value={effectsEnabled} onChange={setEffectsEnabled} />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>CRT Scanline Filter</label>
            <Toggle
              value={crtFilter}
              onChange={setCrtFilter}
              disabled={!effectsEnabled}
            />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>Particle Effects</label>
            <Toggle
              value={particlesEnabled}
              onChange={setParticlesEnabled}
              disabled={!effectsEnabled}
            />
          </div>
          <div className={styles.setting}>
            <label className={styles.label}>Particle Speed</label>
            <div className={styles.segmented}>
              {PARTICLE_SPEEDS.map((ps) => (
                <button
                  key={ps.value}
                  className={`${styles.segmentBtn} ${particleSpeed === ps.value ? styles.segmentActive : ''} ${!effectsEnabled || !particlesEnabled ? styles.segmentDisabled : ''}`}
                  onClick={() => setParticleSpeed(ps.value)}
                  disabled={!effectsEnabled || !particlesEnabled}
                >
                  {ps.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---- SYSTEM ---- */}
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

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      className={`${styles.toggle} ${value ? styles.toggleOn : ''} ${disabled ? styles.toggleDisabled : ''}`}
      onClick={() => !disabled && onChange(!value)}
      role="switch"
      aria-checked={value}
      aria-disabled={disabled}
    >
      <span className={styles.toggleThumb} />
      <span className={styles.toggleLabel}>{value ? 'ON' : 'OFF'}</span>
    </button>
  );
}
