import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useVisitorStore } from '../stores/visitorStore';
import { useSettingsStore } from '../stores/settingsStore';

function getSessionStart() {
  let start = sessionStorage.getItem('bv_session_start');
  if (!start) {
    start = String(Date.now());
    sessionStorage.setItem('bv_session_start', start);
  }
  return Number(start);
}

export function useVisitorTracking() {
  const location = useLocation();
  const initVisit = useVisitorStore((s) => s.initVisit);
  const trackRoute = useVisitorStore((s) => s.trackRoute);
  const trackUptime = useVisitorStore((s) => s.trackUptime);
  const checkMedals = useVisitorStore((s) => s.checkMedals);
  const trackLightTheme = useVisitorStore((s) => s.trackLightTheme);
  const trackCursorStyle = useVisitorStore((s) => s.trackCursorStyle);
  const crtFilter = useSettingsStore((s) => s.crtFilter);
  const particleSpeed = useSettingsStore((s) => s.particleSpeed);
  const monochrome = useSettingsStore((s) => s.monochrome);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const theme = useSettingsStore((s) => s.theme);
  const cursorStyle = useSettingsStore((s) => s.cursorStyle);

  useEffect(() => {
    initVisit();
  }, [initVisit]);

  useEffect(() => {
    trackRoute(location.pathname);
  }, [location.pathname, trackRoute]);

  useEffect(() => {
    if (theme === 'light') trackLightTheme();
    checkMedals();
  }, [theme, trackLightTheme, checkMedals]);

  useEffect(() => {
    trackCursorStyle(cursorStyle);
  }, [cursorStyle, trackCursorStyle]);

  useEffect(() => {
    checkMedals();
  }, [crtFilter, particleSpeed, monochrome, soundEnabled, checkMedals]);

  useEffect(() => {
    const sessionStart = getSessionStart();
    trackUptime(Math.floor((Date.now() - sessionStart) / 1000));
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - sessionStart) / 1000);
      trackUptime(seconds);
    }, 10000);
    return () => clearInterval(tick);
  }, [trackUptime]);
}

export function trackBootComplete(options) {
  useVisitorStore.getState().trackBootComplete(options);
}

export function trackBootSkip() {
  useVisitorStore.getState().trackBootSkip();
}

export function trackCreditsFinished() {
  useVisitorStore.getState().trackCreditsFinished();
}

export function trackExitModal() {
  useVisitorStore.getState().trackExitModal();
}

export function trackExitConfirm() {
  useVisitorStore.getState().trackExitConfirm();
}

export function trackKeyboardNav() {
  useVisitorStore.getState().trackKeyboardNav();
}

export function trackCvDownload() {
  useVisitorStore.getState().trackCvDownload();
}

export function trackSettingsChange() {
  useVisitorStore.getState().trackSettingsChange();
}

export function trackSettingsReset() {
  useVisitorStore.getState().trackSettingsReset();
}

export function trackSteamAchievementsTab() {
  useVisitorStore.getState().trackSteamAchievementsTab();
}

export function trackSteamCuratorClick() {
  useVisitorStore.getState().trackSteamCuratorClick();
}

export function trackCommsClick() {
  useVisitorStore.getState().trackCommsClick();
}
