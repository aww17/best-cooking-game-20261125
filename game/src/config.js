// Single source of truth for Simmer & Serve: the logical field, every timing, every
// colour and the recipes. The renderer is laid out to FIELD; no rule depends on the
// window's size. Tune the game here and nowhere else.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step in seconds: the loop runs the world at exactly 60 steps a second. */
export const STEP = 1 / 60;

export const TITLE = 'SIMMER & SERVE';

export const SHIFT = {
  seconds: 150,
  lives: 3,
  startOrders: 2,
  maxOrders: 3,
  spawnDelay: 4,
  spawnDelayMin: 2,
  spawnDelayStep: 0.5,
  orderTime: 45,
  orderTimeMin: 28,
  orderTimeStep: 3,
  difficulty: 300,
  urgent: 10,
};

export const PATTY = {
  cookSeconds: 6,
  keepSeconds: 8,
};

export const PLATE = { maxItems: 5 };

export const SCORE = {
  base: 100,
  perSecond: 2,
  comboBonus: 25,
};

export const GRILL = { slots: 2 };

/** The kitchen's five ingredient ids. A cooked patty is the one the plate accepts. */
export const INGREDIENT = {
  bun: 'bun',
  patty: 'patty',
  lettuce: 'lettuce',
  tomato: 'tomato',
  cheese: 'cheese',
  onion: 'onion',
};

/** The six bins on the counter, left to right, with their hotkey digit. */
export const BINS = [
  { id: INGREDIENT.bun, name: 'Bun', key: '1' },
  { id: INGREDIENT.patty, name: 'Patty', key: '2', isPatty: true },
  { id: INGREDIENT.lettuce, name: 'Lettuce', key: '3' },
  { id: INGREDIENT.tomato, name: 'Tomato', key: '4' },
  { id: INGREDIENT.cheese, name: 'Cheese', key: '5' },
  { id: INGREDIENT.onion, name: 'Onion', key: '6' },
];

/** Human labels used for ingredients on tickets and the plate. */
export const INGREDIENT_NAME = {
  bun: 'Bun',
  patty: 'Patty',
  lettuce: 'Lettuce',
  tomato: 'Tomato',
  cheese: 'Cheese',
  onion: 'Onion',
};

/**
 * The recipes, in the order a fresh ticket is drawn from the seeded RNG. requires is the
 * exact multiset the plate must hold on serving; want is what a ticket prints, top down, so
 * the player can read it as a stack.
 */
export const RECIPES = [
  {
    id: 'classic',
    name: 'Classic Burger',
    requires: { bun: 1, patty: 1, lettuce: 1, tomato: 1 },
    want: ['bun', 'patty', 'lettuce', 'tomato'],
    points: 120,
  },
  {
    id: 'cheesy',
    name: 'Cheesy Melt',
    requires: { bun: 1, patty: 1, cheese: 1, onion: 1 },
    want: ['bun', 'patty', 'cheese', 'onion'],
    points: 130,
  },
  {
    id: 'garden',
    name: 'Garden Stack',
    requires: { bun: 1, lettuce: 1, tomato: 1, onion: 1 },
    want: ['bun', 'lettuce', 'tomato', 'onion'],
    points: 110,
  },
  {
    id: 'double',
    name: 'Double Trouble',
    requires: { bun: 1, patty: 2, cheese: 1 },
    want: ['bun', 'patty', 'patty', 'cheese'],
    points: 150,
  },
];

/** A ticket's required slots, as ingredient ids in reading order (a patty twice for Double Trouble). */
export function ticketWant(recipe) {
  return recipe.want.slice();
}

export const PALETTE = {
  page: '#16100b',
  wall: '#f5e7c8',
  wallShade: '#ecd9b2',
  tile: '#dcb98b',
  tileLine: '#c79f6d',
  wood: '#8a5a32',
  woodDark: '#5e3b1f',
  woodLight: '#b5895a',
  counter: '#c69a63',
  counterDark: '#946a3d',
  steel: '#5d646c',
  steelLight: '#a9b2ba',
  steelDark: '#2f343a',
  grillBar: '#1d2024',
  grillGlow: '#ff6a2b',
  ember: '#ff8b3d',
  grillCooking: '#2a211b',
  red: '#b8352c',
  redDeep: '#8f231c',
  cream: '#fff7e6',
  paper: '#fffaf0',
  paperLine: '#d9c7a6',
  ink: '#3a2a1c',
  inkSoft: '#6b5440',
  gold: '#f4c04a',
  goldLight: '#ffe08a',
  goldDark: '#b8862a',
  green: '#5aa845',
  greenDeep: '#3d7d2f',
  amber: '#e6a23a',
  tomato: '#e0432f',
  tomatoDeep: '#b32a1e',
  lettuce: '#7cc04a',
  lettuceDeep: '#4f8f2c',
  cheese: '#f4c33b',
  cheeseDeep: '#d89a1e',
  onion: '#c49ad8',
  onionDeep: '#8b63a8',
  bun: '#d9a15e',
  bunDeep: '#b77d3e',
  pattyRaw: '#c46a72',
  pattyRawDeep: '#9c4852',
  pattyCooked: '#7a4a2a',
  pattyCookedDeep: '#4e2c16',
  pattyBurnt: '#241a14',
  pattyBurntDeep: '#0f0b08',
  shadow: 'rgba(43, 26, 12, 0.18)',
  dim: 'rgba(30, 18, 8, 0.55)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_SERIF = 'Georgia, "Times New Roman", serif';
