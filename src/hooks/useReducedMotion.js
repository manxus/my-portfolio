import { useSettingsStore } from '../stores/settingsStore';
import { useMediaQuery } from './useMediaQuery';

export function useSystemReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// The in-app toggle can only add reduced motion on top of the OS preference, never remove it.
export function useReducedMotion() {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const systemReducedMotion = useSystemReducedMotion();
  return reduceMotion || systemReducedMotion;
}
