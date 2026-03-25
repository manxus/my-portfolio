/**
 * Personal tier lists by category.
 * Each tier references games by appId.
 * The page resolves them against the game library for images/names.
 */
export const tierLists = [
  {
    category: 'Overall',
    tiers: {
      S: [620, 292030],
      A: [1174180, 1091500],
      B: [730],
      C: [570],
      D: [],
      F: [],
    },
  },
  {
    category: 'Story',
    tiers: {
      S: [1174180, 292030],
      A: [620, 1091500],
      B: [],
      C: [],
      D: [],
      F: [],
    },
  },
  {
    category: 'Multiplayer',
    tiers: {
      S: [730],
      A: [620],
      B: [570],
      C: [],
      D: [],
      F: [],
    },
  },
];
