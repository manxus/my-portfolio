import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      accentColor: '#5f8f8f',
      soundEnabled: false,
      soundVolume: 0.5,
      effectsEnabled: true,
      crtFilter: false,
      particlesEnabled: true,
      reduceMotion: false,
      fontSize: 'medium',

      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSoundVolume: (soundVolume) => set({ soundVolume }),
      setEffectsEnabled: (effectsEnabled) => set({ effectsEnabled }),
      setCrtFilter: (crtFilter) => set({ crtFilter }),
      setParticlesEnabled: (particlesEnabled) => set({ particlesEnabled }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setFontSize: (fontSize) => set({ fontSize }),
      resetAll: () =>
        set({
          theme: 'dark',
          accentColor: '#5f8f8f',
          soundEnabled: false,
          soundVolume: 0.5,
          effectsEnabled: true,
          crtFilter: false,
          particlesEnabled: true,
          reduceMotion: false,
          fontSize: 'medium',
        }),
    }),
    {
      name: 'bv-settings',
    },
  ),
);
