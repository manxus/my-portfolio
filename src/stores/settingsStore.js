import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Accent choices, keyed by their dark-theme base. The dark shades wash out on
 * the light theme's greys (bright was ~1.6:1), so each has a light set too:
 * accent 4.6:1 and bright 6.1:1 on --bg-secondary (bright means *more*
 * prominent, so on light it is the darker one), and dim a pale fill that keeps
 * --text-primary on top of it at 7.5:1.
 */
const ACCENT_PALETTE = {
  '#5f8f8f': { bright: '#82bfbf', dim: '#3d6363', light: { accent: '#456868', bright: '#385454', dim: '#a3bfbf' } },
  '#8f5f5f': { bright: '#bf8282', dim: '#633d3d', light: { accent: '#825656', bright: '#6a4646', dim: '#cab4b4' } },
  '#5f6f8f': { bright: '#8299bf', dim: '#3d4963', light: { accent: '#54627f', bright: '#445067', dim: '#b1b9c9' } },
  '#6f8f5f': { bright: '#99bf82', dim: '#49633d', light: { accent: '#516845', bright: '#425539', dim: '#acbfa3' } },
  '#8f6f8f': { bright: '#bf99bf', dim: '#634963', light: { accent: '#735973', bright: '#5e495e', dim: '#c5b4c5' } },
  '#8f8f5f': { bright: '#bfbf82', dim: '#63633d', light: { accent: '#636342', bright: '#515136', dim: '#bbbb9d' } },
};

export { ACCENT_PALETTE };

const DEFAULTS = {
  theme: 'dark',
  accentColor: '#5f8f8f',
  soundEnabled: false,
  soundVolume: 0.5,
  soundTheme: 'default',
  effectsEnabled: true,
  crtFilter: false,
  particlesEnabled: true,
  reduceMotion: false,
  fontSize: 'medium',
  particleSpeed: 1,
  colorblindMode: 'none',
  monochrome: false,
  cursorStyle: 'default',
  skipIntro: false,
};

export const useSettingsStore = create(
  persist(
    (set) => ({
      ...DEFAULTS,

      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSoundVolume: (soundVolume) => set({ soundVolume }),
      setSoundTheme: (soundTheme) => set({ soundTheme }),
      setEffectsEnabled: (effectsEnabled) => set({ effectsEnabled }),
      setCrtFilter: (crtFilter) => set({ crtFilter }),
      setParticlesEnabled: (particlesEnabled) => set({ particlesEnabled }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setFontSize: (fontSize) => set({ fontSize }),
      setParticleSpeed: (particleSpeed) => set({ particleSpeed }),
      setColorblindMode: (colorblindMode) => set({ colorblindMode }),
      setMonochrome: (monochrome) => set({ monochrome }),
      setCursorStyle: (cursorStyle) => set({ cursorStyle }),
      setSkipIntro: (skipIntro) => set({ skipIntro }),
      resetAll: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'bv-settings',
    },
  ),
);
