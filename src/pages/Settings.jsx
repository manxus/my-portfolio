import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useSound } from '../hooks/useSound';
import { useSystemReducedMotion } from '../hooks/useReducedMotion';
import { trackSettingsChange, trackSettingsReset } from '../hooks/useVisitorTracking';
import { CURSOR_STYLES } from '../utils/cursors';
import styles from './Settings.module.css';

const CURSOR_OPTIONS = Object.entries(CURSOR_STYLES).map(([value, { label }]) => ({
  value,
  label,
}));

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

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
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
    cursorStyle,
    skipIntro,
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
    setCursorStyle,
    setSkipIntro,
    resetAll,
  } = useSettingsStore();

  const { play } = useSound();
  const systemReducedMotion = useSystemReducedMotion();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const settingsInitialized = useRef(false);

  useEffect(() => {
    if (!settingsInitialized.current) {
      settingsInitialized.current = true;
      return;
    }
    trackSettingsChange();
  }, [
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
    cursorStyle,
    skipIntro,
  ]);

  const previewSound = (themeValue) => {
    setSoundTheme(themeValue);
    setTimeout(() => play('select'), 50);
  };

  // Reset asks for a second click within a few seconds before wiping everything.
  useEffect(() => {
    if (!confirmingReset) return;
    const timer = setTimeout(() => setConfirmingReset(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingReset]);

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);
    trackSettingsReset();
    resetAll();
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>

        {/* ---- ACCESSIBILITY ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>ACCESSIBILITY</h3>
          <div className={styles.setting}>
            <SettingLabel id="set-colorblind">Colorblind Mode</SettingLabel>
            <Segmented
              labelledBy="set-colorblind"
              options={COLORBLIND_MODES}
              value={colorblindMode}
              onChange={setColorblindMode}
              disabled={monochrome}
            />
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-monochrome" hint="Full grayscale filter">
              Monochrome
            </SettingLabel>
            <Toggle labelledBy="set-monochrome" value={monochrome} onChange={setMonochrome} />
          </div>
          <div className={styles.setting}>
            <SettingLabel
              id="set-reduce-motion"
              hint={
                systemReducedMotion
                  ? 'Enabled by your system setting'
                  : 'Disables transitions & animations'
              }
            >
              Reduce Motion
            </SettingLabel>
            <Toggle
              labelledBy="set-reduce-motion"
              value={reduceMotion || systemReducedMotion}
              onChange={setReduceMotion}
              disabled={systemReducedMotion}
            />
          </div>
        </section>

        {/* ---- AUDIO ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>AUDIO</h3>
          <div className={styles.setting}>
            <SettingLabel id="set-sound">Sound Effects</SettingLabel>
            <Toggle labelledBy="set-sound" value={soundEnabled} onChange={setSoundEnabled} />
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-volume" hint="Release to hear the level">
              Volume
            </SettingLabel>
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                onPointerUp={() => play('select')}
                onKeyUp={() => play('select')}
                disabled={!soundEnabled}
                aria-labelledby="set-volume"
                aria-valuetext={`${Math.round(soundVolume * 100)}%`}
              />
              <span className={styles.sliderValue} aria-hidden="true">
                {Math.round(soundVolume * 100)}%
              </span>
            </div>
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-sound-theme" hint="Click to preview each theme">
              Sound Theme
            </SettingLabel>
            <Segmented
              labelledBy="set-sound-theme"
              options={SOUND_THEMES}
              value={soundTheme}
              onChange={previewSound}
              disabled={!soundEnabled}
            />
          </div>
        </section>

        {/* ---- DISPLAY ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>DISPLAY</h3>
          <div className={styles.setting}>
            <SettingLabel id="set-theme">Theme</SettingLabel>
            <Segmented labelledBy="set-theme" options={THEMES} value={theme} onChange={setTheme} />
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-font-size">Font Size</SettingLabel>
            <Segmented
              labelledBy="set-font-size"
              options={FONT_SIZES}
              value={fontSize}
              onChange={setFontSize}
            />
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-accent">Accent Color</SettingLabel>
            <div className={styles.colorPicker} role="group" aria-labelledby="set-accent">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`${styles.colorSwatch} ${accentColor === c.value ? styles.colorActive : ''}`}
                  style={{ '--swatch': c.value }}
                  onClick={() => setAccentColor(c.value)}
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={accentColor === c.value}
                />
              ))}
            </div>
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-cursor" hint="Custom pointer tinted to accent color">
              Cursor Style
            </SettingLabel>
            <Segmented
              labelledBy="set-cursor"
              options={CURSOR_OPTIONS}
              value={cursorStyle}
              onChange={setCursorStyle}
            />
          </div>
        </section>

        {/* ---- EFFECTS ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>EFFECTS</h3>
          <div className={styles.setting}>
            <SettingLabel id="set-effects" hint="Master toggle for all visual effects">
              Visual Effects
            </SettingLabel>
            <Toggle labelledBy="set-effects" value={effectsEnabled} onChange={setEffectsEnabled} />
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-crt">CRT Scanline Filter</SettingLabel>
            <Toggle
              labelledBy="set-crt"
              value={crtFilter}
              onChange={setCrtFilter}
              disabled={!effectsEnabled}
            />
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-particles">Particle Effects</SettingLabel>
            <Toggle
              labelledBy="set-particles"
              value={particlesEnabled}
              onChange={setParticlesEnabled}
              disabled={!effectsEnabled}
            />
          </div>
          <div className={styles.setting}>
            <SettingLabel id="set-particle-speed">Particle Speed</SettingLabel>
            <Segmented
              labelledBy="set-particle-speed"
              options={PARTICLE_SPEEDS}
              value={particleSpeed}
              onChange={setParticleSpeed}
              disabled={!effectsEnabled || !particlesEnabled}
            />
          </div>
        </section>

        {/* ---- SYSTEM ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>SYSTEM</h3>
          <div className={styles.setting}>
            <SettingLabel id="set-skip-intro" hint="Go straight to the main menu on load">
              Skip Intro
            </SettingLabel>
            <Toggle labelledBy="set-skip-intro" value={skipIntro} onChange={setSkipIntro} />
          </div>
          <div className={styles.setting}>
            <button
              type="button"
              className={`${styles.resetButton} ${confirmingReset ? styles.resetConfirming : ''}`}
              onClick={handleReset}
              onBlur={() => setConfirmingReset(false)}
            >
              {confirmingReset ? 'CONFIRM RESET?' : 'RESET TO DEFAULTS'}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

function SettingLabel({ id, hint, children }) {
  return (
    <span id={id} className={styles.label}>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </span>
  );
}

function Segmented({ labelledBy, options, value, onChange, disabled }) {
  return (
    <div className={styles.segmented} role="group" aria-labelledby={labelledBy}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.segmentBtn} ${value === opt.value ? styles.segmentActive : ''} ${disabled ? styles.segmentDisabled : ''}`}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          aria-pressed={value === opt.value}
        >
          {opt.label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Toggle({ labelledBy, value, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${value ? styles.toggleOn : ''} ${disabled ? styles.toggleDisabled : ''}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      aria-labelledby={labelledBy}
      disabled={disabled}
    >
      <span className={styles.toggleThumb} />
      <span className={styles.toggleLabel} aria-hidden="true">{value ? 'ON' : 'OFF'}</span>
    </button>
  );
}
