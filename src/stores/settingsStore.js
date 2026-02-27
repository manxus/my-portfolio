import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ACCENT_PALETTE = {
  '#5f8f8f': { bright: '#82bfbf', dim: '#3d6363' },
  '#8f5f5f': { bright: '#bf8282', dim: '#633d3d' },
  '#5f6f8f': { bright: '#8299bf', dim: '#3d4963' },
  '#6f8f5f': { bright: '#99bf82', dim: '#49633d' },
  '#8f6f8f': { bright: '#bf99bf', dim: '#634963' },
  '#8f8f5f': { bright: '#bfbf82', dim: '#63633d' },
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
      resetAll: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'bv-settings',
    },
  ),
);
