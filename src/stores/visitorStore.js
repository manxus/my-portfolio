import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import medalsData from '../data/visitorMedals.json';
import { useSettingsStore } from './settingsStore';

export const STORY_ROUTES = ['/qa-portfolio', '/steam-library', '/tech'];
export const DLCS_ROUTES = ['/resume', '/side-projects'];
export const EXTRA_ROUTES = [
  '/media',
  '/music',
  '/books',
  '/tabletop',
  '/cinema',
  '/travel-log',
  '/livestream',
];

export const ALL_LEAF_ROUTES = [
  ...STORY_ROUTES,
  ...DLCS_ROUTES,
  ...EXTRA_ROUTES,
  '/settings',
  '/credits',
  '/patch-notes',
];

const SESSION_ROUTES_KEY = 'bv_visitor_session_routes';
const SESSION_UPTIME_KEY = 'bv_visitor_max_uptime';
const SESSION_ROUTE_TIMES_KEY = 'bv_visitor_route_times';

function clearSessionAchievementData() {
  try {
    sessionStorage.removeItem(SESSION_ROUTES_KEY);
    sessionStorage.removeItem(SESSION_UPTIME_KEY);
    sessionStorage.removeItem(SESSION_ROUTE_TIMES_KEY);
  } catch {
    /* ignore */
  }
}

const { medals, displayOrder: defaultDisplayOrder } = medalsData;

function getDefaultMedalOrder() {
  if (defaultDisplayOrder?.length) return defaultDisplayOrder;
  return medals.map((m) => m.id);
}

export function getOrderedMedals(customOrder) {
  const order = customOrder?.length ? customOrder : getDefaultMedalOrder();
  const byId = Object.fromEntries(medals.map((m) => [m.id, m]));
  const seen = new Set();
  const result = [];

  for (const id of order) {
    if (byId[id] && !seen.has(id)) {
      result.push(byId[id]);
      seen.add(id);
    }
  }

  for (const id of getDefaultMedalOrder()) {
    if (byId[id] && !seen.has(id)) {
      result.push(byId[id]);
      seen.add(id);
    }
  }

  for (const m of medals) {
    if (!seen.has(m.id)) result.push(m);
  }

  return result;
}

export function getEffectiveMedalOrder(customOrder) {
  return getOrderedMedals(customOrder).map((m) => m.id);
}

function isMedalOrderStale(order) {
  if (!order?.length) return false;
  const ids = new Set(medals.map((m) => m.id));
  if (order.length !== ids.size) return true;
  return order.some((id) => !ids.has(id));
}

function hasAll(routes, required) {
  return required.every((r) => routes.includes(r));
}

function getSessionRoutes() {
  try {
    const raw = sessionStorage.getItem(SESSION_ROUTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addSessionRoute(path) {
  if (!path || path === '/') return;
  try {
    const routes = getSessionRoutes();
    if (!routes.includes(path)) {
      sessionStorage.setItem(SESSION_ROUTES_KEY, JSON.stringify([...routes, path]));
    }
  } catch {
    /* ignore */
  }
}

function recordRouteTimestamp(path) {
  if (!path || path === '/') return;
  try {
    const raw = sessionStorage.getItem(SESSION_ROUTE_TIMES_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    sessionStorage.setItem(
      SESSION_ROUTE_TIMES_KEY,
      JSON.stringify([...entries, { path, t: Date.now() }]),
    );
  } catch {
    /* ignore */
  }
}

function isSpeedrunComplete() {
  try {
    const raw = sessionStorage.getItem(SESSION_ROUTE_TIMES_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - 120_000;
    const recent = entries.filter((e) => e.t >= cutoff);
    const unique = new Set(recent.map((e) => e.path));
    return unique.size >= 5;
  } catch {
    return false;
  }
}

function getMaxSessionUptime() {
  try {
    return Number(sessionStorage.getItem(SESSION_UPTIME_KEY) || 0);
  } catch {
    return 0;
  }
}

function setMaxSessionUptime(seconds) {
  try {
    const current = getMaxSessionUptime();
    if (seconds > current) {
      sessionStorage.setItem(SESSION_UPTIME_KEY, String(seconds));
    }
  } catch {
    /* ignore */
  }
}

function isNightShift() {
  return new Date().getHours() >= 22;
}

function isEarlyBird() {
  return new Date().getHours() < 8;
}

function evaluateMedals(rawStats) {
  const settings = useSettingsStore.getState();
  const stats = normalizeStats(rawStats);
  const sessionRoutes = getSessionRoutes();
  const maxUptime = Math.max(stats.maxSessionUptime || 0, getMaxSessionUptime());
  const visited = stats.visitedRoutes || [];
  const visitDays = stats.visitDays || [];
  const cursorStylesUsed = stats.cursorStylesUsed || [];

  const checks = {
    first_boot: stats.bootComplete,
    welcome_back: (() => {
      if (!stats.firstVisitAt) return false;
      return new Date(stats.firstVisitAt).toDateString() !== new Date().toDateString();
    })(),
    story_complete: hasAll(visited, STORY_ROUTES),
    dlc_complete: hasAll(visited, DLCS_ROUTES),
    extra_complete: hasAll(visited, EXTRA_ROUTES),
    full_catalog: hasAll(visited, ALL_LEAF_ROUTES),
    patch_reader: visited.includes('/patch-notes'),
    cv_download: stats.cvDownloaded,
    settings_tinker: stats.settingsChanged,
    factory_reset: stats.settingsReset,
    session_5: maxUptime >= 300,
    session_15: maxUptime >= 900,
    session_30: maxUptime >= 1800,
    deep_session: sessionRoutes.length >= 8,
    hiring_path:
      sessionRoutes.includes('/qa-portfolio') && sessionRoutes.includes('/resume'),
    credits_survivor: stats.creditsFinished,
    exit_warning: stats.exitModalOpened,
    ludicrous: settings.particleSpeed === 4,
    keyboard_master: stats.keyboardNavUsed,
    boot_skip: stats.bootSkipped,
    the_light_it_hurt: stats.lightThemeUsed && settings.theme === 'dark',
    sound_check: settings.soundEnabled,
    speedrun: stats.speedrunCompleted || isSpeedrunComplete(),
    night_shift: stats.nightShiftSeen || (maxUptime > 0 && isNightShift()),
    early_bird: stats.earlyBirdSeen || (maxUptime > 0 && isEarlyBird()),
    achievement_hunter: stats.steamAchievementsTab,
    steam_curator: stats.steamCuratorClicked,
    comms_open: stats.commsClicked,
    full_retro: settings.crtFilter && settings.monochrome,
    aim_trainer: cursorStylesUsed.length >= 3,
    no_regrets: stats.exitConfirmed,
    patient_boot: stats.bootComplete && !stats.bootSkipped,
    regular: visitDays.length >= 3,
    veteran: visitDays.length >= 7,
  };

  return medals
    .filter((m) => m.id !== 'platinum_build' && checks[m.id])
    .map((m) => m.id);
}

function isPlatinumEligible(unlocked) {
  return medals
    .filter((m) => m.id !== 'platinum_build')
    .every((m) => unlocked.includes(m.id));
}

const DEFAULT_STATS = {
  firstVisitAt: null,
  bootComplete: false,
  bootSkipped: false,
  creditsFinished: false,
  exitModalOpened: false,
  exitConfirmed: false,
  keyboardNavUsed: false,
  cvDownloaded: false,
  settingsChanged: false,
  settingsReset: false,
  visitedRoutes: [],
  visitDays: [],
  maxSessionUptime: 0,
  lightThemeUsed: false,
  steamAchievementsTab: false,
  steamCuratorClicked: false,
  commsClicked: false,
  cursorStylesUsed: [],
  speedrunCompleted: false,
  nightShiftSeen: false,
  earlyBirdSeen: false,
};

function normalizeStats(stats = {}) {
  return {
    ...DEFAULT_STATS,
    ...stats,
    visitedRoutes: stats.visitedRoutes ?? [],
    visitDays: stats.visitDays ?? [],
    cursorStylesUsed: stats.cursorStylesUsed ?? [],
  };
}

export const useVisitorStore = create(
  persist(
    (set, get) => ({
      unlocked: [],
      pendingUnlock: null,
      unlockQueue: [],
      drawerOpen: false,
      medalOrder: [],
      stats: { ...DEFAULT_STATS },

      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

      clearPendingUnlock: () => {
        const { unlockQueue } = get();
        if (unlockQueue.length > 0) {
          const [next, ...rest] = unlockQueue;
          set({ pendingUnlock: next, unlockQueue: rest });
          return;
        }
        set({ pendingUnlock: null });
      },

      unlock: (id) => {
        const medal = medals.find((m) => m.id === id);
        if (!medal) return;
        const { unlocked, pendingUnlock, unlockQueue } = get();
        if (unlocked.includes(id)) return;
        const entry = {
          id: medal.id,
          title: medal.title,
          description: medal.description,
        };
        if (pendingUnlock) {
          set({
            unlocked: [...unlocked, id],
            unlockQueue: [...unlockQueue, entry],
          });
          return;
        }
        set({
          unlocked: [...unlocked, id],
          pendingUnlock: entry,
        });
      },

      checkMedals: () => {
        const state = get();
        const stats = normalizeStats(state.stats);
        if (
          !Array.isArray(state.stats?.visitDays) ||
          !Array.isArray(state.stats?.cursorStylesUsed)
        ) {
          set({ stats });
        }
        const earned = evaluateMedals(stats);
        for (const id of earned) {
          if (!state.unlocked.includes(id)) {
            get().unlock(id);
          }
        }
        const { unlocked } = get();
        if (isPlatinumEligible(unlocked)) {
          get().unlock('platinum_build');
        }
      },

      initVisit: () => {
        const stats = normalizeStats(get().stats);
        const now = new Date().toISOString();
        const today = now.slice(0, 10);
        const visitDays = stats.visitDays.includes(today)
          ? stats.visitDays
          : [...stats.visitDays, today];
        set({
          stats: {
            ...stats,
            firstVisitAt: stats.firstVisitAt || now,
            visitDays,
          },
        });
        get().checkMedals();
      },

      trackRoute: (path) => {
        if (!path || path === '/') return;
        const stats = normalizeStats(get().stats);
        const visitedRoutes = stats.visitedRoutes.includes(path)
          ? stats.visitedRoutes
          : [...stats.visitedRoutes, path];
        addSessionRoute(path);
        recordRouteTimestamp(path);
        const speedrunCompleted =
          stats.speedrunCompleted || isSpeedrunComplete();
        set({
          stats: { ...stats, visitedRoutes, speedrunCompleted },
        });
        get().checkMedals();
      },

      trackBootComplete: ({ skipped = false } = {}) => {
        const { stats } = get();
        set({
          stats: {
            ...stats,
            bootComplete: true,
            bootSkipped: stats.bootSkipped || skipped,
          },
        });
        get().checkMedals();
      },

      trackBootSkip: () => {
        const { stats } = get();
        set({ stats: { ...stats, bootSkipped: true } });
        get().checkMedals();
      },

      trackCreditsFinished: () => {
        const { stats } = get();
        if (stats.creditsFinished) return;
        set({ stats: { ...stats, creditsFinished: true } });
        get().checkMedals();
      },

      trackExitModal: () => {
        const { stats } = get();
        if (stats.exitModalOpened) return;
        set({ stats: { ...stats, exitModalOpened: true } });
        get().checkMedals();
      },

      trackExitConfirm: () => {
        const { stats } = get();
        if (stats.exitConfirmed) return;
        set({ stats: { ...stats, exitConfirmed: true } });
        get().checkMedals();
      },

      trackKeyboardNav: () => {
        const { stats } = get();
        if (stats.keyboardNavUsed) return;
        set({ stats: { ...stats, keyboardNavUsed: true } });
        get().checkMedals();
      },

      trackCvDownload: () => {
        const { stats } = get();
        if (stats.cvDownloaded) return;
        set({ stats: { ...stats, cvDownloaded: true } });
        get().checkMedals();
      },

      trackSettingsChange: () => {
        const { stats } = get();
        if (stats.settingsChanged) return;
        set({ stats: { ...stats, settingsChanged: true } });
        get().checkMedals();
      },

      trackSettingsReset: () => {
        const { stats } = get();
        if (stats.settingsReset) return;
        set({ stats: { ...stats, settingsReset: true } });
        get().checkMedals();
      },

      trackLightTheme: () => {
        const { stats } = get();
        if (stats.lightThemeUsed) return;
        set({ stats: { ...stats, lightThemeUsed: true } });
        get().checkMedals();
      },

      trackCursorStyle: (style) => {
        if (!style) return;
        const stats = normalizeStats(get().stats);
        const cursorStylesUsed = stats.cursorStylesUsed.includes(style)
          ? stats.cursorStylesUsed
          : [...stats.cursorStylesUsed, style];
        if (cursorStylesUsed.length === stats.cursorStylesUsed.length) return;
        set({ stats: { ...stats, cursorStylesUsed } });
        get().checkMedals();
      },

      trackSteamAchievementsTab: () => {
        const { stats } = get();
        if (stats.steamAchievementsTab) return;
        set({ stats: { ...stats, steamAchievementsTab: true } });
        get().checkMedals();
      },

      trackSteamCuratorClick: () => {
        const { stats } = get();
        if (stats.steamCuratorClicked) return;
        set({ stats: { ...stats, steamCuratorClicked: true } });
        get().checkMedals();
      },

      trackCommsClick: () => {
        const { stats } = get();
        if (stats.commsClicked) return;
        set({ stats: { ...stats, commsClicked: true } });
        get().checkMedals();
      },

      trackUptime: (seconds) => {
        setMaxSessionUptime(seconds);
        const { stats } = get();
        const nightShiftSeen = stats.nightShiftSeen || (seconds > 0 && isNightShift());
        const earlyBirdSeen = stats.earlyBirdSeen || (seconds > 0 && isEarlyBird());
        const maxSessionUptime = Math.max(stats.maxSessionUptime, seconds);
        set({ stats: { ...stats, maxSessionUptime, nightShiftSeen, earlyBirdSeen } });
        get().checkMedals();
      },

      resetAchievements: () => {
        clearSessionAchievementData();
        set({
          unlocked: [],
          pendingUnlock: null,
          unlockQueue: [],
          drawerOpen: false,
          stats: { ...DEFAULT_STATS },
        });
      },

      unlockAllAchievements: () => {
        set({
          unlocked: medals.map((m) => m.id),
          pendingUnlock: null,
          unlockQueue: [],
        });
      },

      moveMedal: (id, direction) => {
        const current = getEffectiveMedalOrder(get().medalOrder);
        const index = current.indexOf(id);
        if (index === -1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= current.length) return;

        const next = [...current];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        set({ medalOrder: next });
      },

      resetMedalOrder: () => set({ medalOrder: [] }),
    }),
    {
      name: 'bv-visitor-medals',
      partialize: (state) => ({
        unlocked: state.unlocked,
        stats: state.stats,
        medalOrder: state.medalOrder,
      }),
      merge: (persistedState, currentState) => {
        let medalOrder = persistedState?.medalOrder ?? currentState.medalOrder;
        if (isMedalOrderStale(medalOrder)) {
          medalOrder = getEffectiveMedalOrder(medalOrder);
        }

        return {
          ...currentState,
          ...persistedState,
          unlocked: persistedState?.unlocked ?? currentState.unlocked,
          stats: normalizeStats(persistedState?.stats),
          medalOrder,
        };
      },
    },
  ),
);

export function getMedalDefinitions() {
  return medals;
}

export function getMedalCounts(unlocked) {
  return {
    unlocked: unlocked.length,
    total: medals.length,
  };
}

export function hasAllAchievementsUnlocked(unlocked) {
  return medals.length > 0 && medals.every((m) => unlocked.includes(m.id));
}
