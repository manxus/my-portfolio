import { useEffect } from 'react';
import { useSettingsStore, ACCENT_PALETTE } from '../stores/settingsStore';
import { CURSOR_STYLES } from '../utils/cursors';

export function useSettingsApplier() {
  const theme = useSettingsStore((s) => s.theme);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const colorblindMode = useSettingsStore((s) => s.colorblindMode);
  const monochrome = useSettingsStore((s) => s.monochrome);
  const cursorStyle = useSettingsStore((s) => s.cursorStyle);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement.style;
    const palette = ACCENT_PALETTE[accentColor];
    root.setProperty('--accent', accentColor);
    if (palette) {
      root.setProperty('--accent-bright', palette.bright);
      root.setProperty('--accent-dim', palette.dim);
    }
    root.setProperty(
      '--accent-glow',
      `${accentColor}1f`,
    );
    root.setProperty('--terminal', accentColor);
    root.setProperty('--terminal-bright', palette?.bright ?? accentColor);
  }, [accentColor]);

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
    const hasFilter = monochrome || (colorblindMode && colorblindMode !== 'none');
    if (hasFilter) {
      document.documentElement.style.filter = 'url(#bv-vision-filter)';
    } else {
      document.documentElement.style.filter = '';
    }
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
