import { useEffect } from 'react';
import { useSettingsStore, ACCENT_PALETTE } from '../stores/settingsStore';
import { CURSOR_STYLES } from '../utils/cursors';
import { useReducedMotion } from './useReducedMotion';

export function useSettingsApplier() {
  const theme = useSettingsStore((s) => s.theme);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const reduceMotion = useReducedMotion();
  const colorblindMode = useSettingsStore((s) => s.colorblindMode);
  const monochrome = useSettingsStore((s) => s.monochrome);
  const cursorStyle = useSettingsStore((s) => s.cursorStyle);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Inline on <html>, so these beat theme.css; the light set has to be chosen
  // here rather than in the stylesheet.
  useEffect(() => {
    const root = document.documentElement.style;
    const palette = ACCENT_PALETTE[accentColor];
    const shades =
      theme === 'light' && palette?.light
        ? palette.light
        : { accent: accentColor, bright: palette?.bright ?? accentColor, dim: palette?.dim };
    root.setProperty('--accent', shades.accent);
    root.setProperty('--accent-bright', shades.bright);
    if (shades.dim) root.setProperty('--accent-dim', shades.dim);
    root.setProperty(
      '--accent-glow',
      `${accentColor}1f`,
    );
    root.setProperty('--terminal', shades.accent);
    root.setProperty('--terminal-bright', shades.bright);
  }, [accentColor, theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-reduce-motion',
      String(reduceMotion),
    );
  }, [reduceMotion]);

  useEffect(() => {
    // Apply on #root (not <html>) so portaled admin modals stay editable.
    const root = document.getElementById('root');
    const hasFilter = monochrome || (colorblindMode && colorblindMode !== 'none');
    if (root) {
      root.style.filter = hasFilter ? 'url(#bv-vision-filter)' : '';
    }
    document.documentElement.style.filter = '';
  }, [colorblindMode, monochrome]);

  useEffect(() => {
    const root = document.documentElement.style;
    const style = CURSOR_STYLES[cursorStyle] ?? CURSOR_STYLES.default;
    const cursors = style.getCursors(accentColor);
    if (cursors) {
      root.setProperty('--cursor-default', cursors.default);
      root.setProperty('--cursor-pointer', cursors.pointer);
    } else {
      root.removeProperty('--cursor-default');
      root.removeProperty('--cursor-pointer');
    }
  }, [cursorStyle, accentColor]);
}
