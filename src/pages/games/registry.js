import { lazy } from 'react';

/**
 * The single list of per-game stat pages. Both the tab bar and the page shell read it, so a new
 * game is registered once rather than in two places that can drift apart.
 *
 * Lazily loaded on purpose: each page imports its own committed stat snapshot at module scope, and
 * eagerly bundling all of them would put every game's JSON in the /games chunk to show one tab.
 */
export const GAMES = [
  {
    id: 'battlefield4',
    label: 'BATTLEFIELD 4',
    Component: lazy(() => import('../Battlefield4')),
  },
  {
    id: 'counterstrike',
    label: 'COUNTER-STRIKE 2',
    Component: lazy(() => import('../CounterStrike')),
  },
  {
    id: 'teamfortress2',
    label: 'TEAM FORTRESS 2',
    Component: lazy(() => import('../TeamFortress2')),
  },
  {
    id: 'payday2',
    label: 'PAYDAY 2',
    Component: lazy(() => import('../Payday2')),
  },
  {
    id: 'satisfactory',
    label: 'SATISFACTORY',
    Component: lazy(() => import('../Satisfactory')),
  },
  {
    id: 'deeprockgalactic',
    label: 'DEEP ROCK GALACTIC',
    Component: lazy(() => import('../DeepRockGalactic')),
  },
  {
    id: 'runescape',
    label: 'RUNESCAPE',
    Component: lazy(() => import('../RuneScape')),
  },
];

export const DEFAULT_GAME = GAMES[0].id;
