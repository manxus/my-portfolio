/**
 * Manual overrides / supplements for auto-fetched Steam game data.
 * Keys are appIds. Values override or extend the fetched genres/categories.
 * If a field is provided here it takes precedence over auto-fetched data.
 */
export const gameOverrides = {
  620: {
    genres: ['Puzzle', 'Action'],
    categories: ['Single-player', 'Co-op'],
  },
  730: {
    genres: ['FPS', 'Competitive'],
    categories: ['Multi-player'],
  },
  570: {
    genres: ['MOBA', 'Strategy'],
    categories: ['Multi-player'],
  },
  1174180: {
    genres: ['Action', 'Adventure', 'Open World'],
    categories: ['Single-player'],
  },
  1091500: {
    genres: ['RPG', 'Action', 'Open World'],
    categories: ['Single-player'],
  },
  292030: {
    genres: ['RPG', 'Action', 'Open World'],
    categories: ['Single-player'],
  },
};
