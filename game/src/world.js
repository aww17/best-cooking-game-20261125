// The rules and state of Simmer & Serve, with no drawing and no browser in it. The world
// owns the score, lives, combo, shift clock, the grill's two slots, the plate's stack, the
// order board and the spawn schedule. step(dt) advances one fixed tick using only its tick
// counter and the seeded RNG; it returns bit flags for what happened, so main.js can react
// (sound, shake) while the renderer only ever reads state.
import {
  INGREDIENT,
  PATTY,
  PLATE,
  RECIPES,
  SCORE,
  SHIFT,
  STEP,
} from './config.js';
import { findMatch } from './recipes.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Grill slot phases. */
export const GRILL_EMPTY = 'empty';
export const GRILL_RAW = 'raw';
export const GRILL_COOKED = 'cooked';
export const GRILL_BURNED = 'burned';

/** Events step() reports as bits, which main.js turns into sound once. */
export const EVENT_PICKUP = 1;
export const EVENT_SERVE = 2;
export const EVENT_MISS = 4;
export const EVENT_EXPIRE = 8;
export const EVENT_TICK = 16;
export const EVENT_BURN = 32;
export const EVENT_PATTY_DONE = 64;
export const EVENT_TRASH = 128;
export const EVENT_OVER = 256;

/** Ticket states on the order board. */
export const ORDER_OPEN = 'open';
export const ORDER_DONE = 'done';
export const ORDER_FAIL = 'fail';

/** A fresh grill slot. */
function makeSlot() {
  return { phase: GRILL_EMPTY, progress: 0, keepLeft: 0, flash: 0 };
}

/**
 * Difficulty curve from the score: order time shrinks 3s and the spawn delay 0.5s for
 * every 300 points, down to their configured minimums.
 */
export function difficultyFor(score) {
  const steps = Math.floor(score / SHIFT.difficulty);
  return {
    orderTime: Math.max(SHIFT.orderTimeMin, SHIFT.orderTime - SHIFT.orderTimeStep * steps),
    spawnDelay: Math.max(SHIFT.spawnDelayMin, SHIFT.spawnDelay - SHIFT.spawnDelayStep * steps),
    steps,
  };
}

/** Pick a dish index that no open ticket already holds, so the board shows variety. */
function pickDish(random, orders) {
  const active = new Set();
  for (const order of orders) if (order.state === ORDER_OPEN) active.add(order.recipe.id);
  const pool = [];
  for (let index = 0; index < RECIPES.length; index += 1) {
    if (!active.has(RECIPES[index].id)) pool.push(index);
  }
  const list = pool.length > 0 ? pool : RECIPES.map((_, index) => index);
  return list[Math.floor(random() * list.length) % list.length];
}

export function createWorld(random) {
  let nextOrderId = 1;
  const state = {
    screen: SCREEN_TITLE,
    tick: 0,
    score: 0,
    lives: SHIFT.lives,
    combo: 0,
    bestCombo: 0,
    served: 0,
    shiftLeft: SHIFT.seconds,
    timeMeta: difficultyFor(0),
    grill: [makeSlot(), makeSlot()],
    plate: [],
    orders: [],
    spawnTimer: 0,
    muted: false,
    shake: 0,
    toast: null,
    lastServe: null,
    bellPulse: 0,
    mistakeFlash: 0,
  };

  function reset() {
    state.screen = SCREEN_TITLE;
    state.tick = 0;
    state.score = 0;
    state.lives = SHIFT.lives;
    state.combo = 0;
    state.bestCombo = 0;
    state.served = 0;
    state.shiftLeft = SHIFT.seconds;
    state.timeMeta = difficultyFor(0);
    state.grill = [makeSlot(), makeSlot()];
    state.plate = [];
    state.orders = [];
    state.spawnTimer = 0;
    state.shake = 0;
    state.toast = null;
    state.lastServe = null;
    state.bellPulse = 0;
    state.mistakeFlash = 0;
    nextOrderId = 1;
  }

  function spawnOrder() {
    const recipe = RECIPES[pickDish(random, state.orders)];
    const life = state.timeMeta.orderTime;
    state.orders.push({
      id: nextOrderId,
      recipe,
      total: life,
      left: life,
      state: ORDER_OPEN,
      flash: 0,
      tickedAt: -1,
    });
    nextOrderId += 1;
  }

  function openCount() {
    let count = 0;
    for (const order of state.orders) if (order.state === ORDER_OPEN) count += 1;
    return count;
  }

  /** Set a world up and fill the board with two tickets and a pending refill. */
  function begin(screen) {
    reset();
    state.screen = screen;
    while (openCount() < SHIFT.startOrders) spawnOrder();
    state.spawnTimer = state.timeMeta.spawnDelay;
  }

  function toast(text) {
    state.toast = { text, life: 1.6 };
  }

  // ---------------------------------------------------------------- actions

  /** Put one of an ingredient's bins on the plate; a patty bin instead fills a free grill slot raw. */
  function clickBin(id) {
    if (state.screen !== SCREEN_PLAY) return 0;
    if (id === INGREDIENT.patty) return loadPatty();
    if (state.plate.length >= PLATE.maxItems) {
      toast('Plate is full');
      return 0;
    }
    state.plate.push(id);
    return EVENT_PICKUP;
  }

  function loadPatty() {
    for (const slot of state.grill) {
      if (slot.phase === GRILL_EMPTY) {
        slot.phase = GRILL_RAW;
        slot.progress = 0;
        slot.keepLeft = 0;
        slot.flash = 0.35;
        return EVENT_PICKUP;
      }
    }
    toast('Grill is full');
    return 0;
  }

  /** A grill slot click: a cooked patty goes to the plate, a burnt one is binned. */
  function takeSlot(index) {
    if (state.screen !== SCREEN_PLAY) return 0;
    const slot = state.grill[index];
    if (slot === undefined) return 0;
    slot.flash = 0.35;
    if (slot.phase === GRILL_BURNED) {
      slot.phase = GRILL_EMPTY;
      slot.progress = 0;
      slot.keepLeft = 0;
      toast('Burnt patty binned');
      return EVENT_TRASH;
    }
    if (slot.phase !== GRILL_COOKED) return 0;
    if (state.plate.length >= PLATE.maxItems) {
      toast('Plate is full');
      return 0;
    }
    state.plate.push(INGREDIENT.patty);
    slot.phase = GRILL_EMPTY;
    slot.progress = 0;
    slot.keepLeft = 0;
    return EVENT_PICKUP;
  }

  /** Keyboard G: take the first cooked patty to the plate. */
  function takeCooked() {
    for (let index = 0; index < state.grill.length; index += 1) {
      if (state.grill[index].phase === GRILL_COOKED) return takeSlot(index);
    }
    toast('No patty is ready');
    return 0;
  }

  function trashPlate() {
    if (state.screen !== SCREEN_PLAY) return 0;
    if (state.plate.length === 0) return 0;
    state.plate = [];
    return EVENT_TRASH;
  }

  /** Hand the plate to the pass. An exact match serves; anything else is a mistake. */
  function serve() {
    if (state.screen !== SCREEN_PLAY) return 0;
    if (state.plate.length === 0) {
      toast('The plate is empty');
      return 0;
    }
    const plate = state.plate.slice();
    const order = findMatch(state.orders.filter((o) => o.state === ORDER_OPEN), plate);
    state.plate = [];
    if (order === null) {
      state.lives -= 1;
      state.combo = 0;
      state.shake = 0.5;
      state.mistakeFlash = 0.6;
      toast('Wrong plate!');
      if (state.lives <= 0) {
        state.lives = 0;
        state.screen = SCREEN_OVER;
        return EVENT_MISS | EVENT_OVER;
      }
      return EVENT_MISS;
    }
    const remaining = Math.max(0, order.left);
    const points = SCORE.base + Math.floor(remaining) * SCORE.perSecond;
    const comboBonus = state.combo * SCORE.comboBonus;
    state.score += points + comboBonus;
    state.served += 1;
    state.combo += 1;
    state.timeMeta = difficultyFor(state.score);
    state.spawnTimer = state.timeMeta.spawnDelay;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    order.state = ORDER_DONE;
    order.flash = 0.6;
    state.lastServe = { id: order.id, life: 2.2, name: order.recipe.name, points, comboBonus, reward: points + comboBonus };
    state.bellPulse = 0.5;
    return EVENT_SERVE;
  }

  // ---------------------------------------------------------------- the tick

  /** Advance grill slots and the plate by dt seconds. */
  function cook(dt, eventsRef) {
    let events = eventsRef.value;
    let cooking = 0;
    for (const slot of state.grill) {
      if (slot.flash > 0) slot.flash = Math.max(0, slot.flash - dt);
      if (slot.phase === GRILL_RAW) {
        cooking += 1;
        slot.progress += dt / PATTY.cookSeconds;
        if (slot.progress >= 1) {
          slot.progress = 1;
          slot.phase = GRILL_COOKED;
          slot.keepLeft = PATTY.keepSeconds;
          slot.flash = 0.4;
          events |= EVENT_PATTY_DONE;
        }
      } else if (slot.phase === GRILL_COOKED) {
        slot.keepLeft -= dt;
        if (slot.keepLeft <= 0) {
          slot.keepLeft = 0;
          slot.phase = GRILL_BURNED;
          slot.flash = 0.5;
          events |= EVENT_BURN;
        }
      }
    }
    eventsRef.value = events;
    return cooking;
  }

  function ageOrders(dt, events) {
    for (const order of state.orders) {
      if (order.flash > 0) order.flash = Math.max(0, order.flash - dt);
      if (order.state !== ORDER_OPEN) continue;
      order.left -= dt;
      if (order.left <= 0) {
        order.left = 0;
        order.state = ORDER_FAIL;
        order.flash = 0.6;
        state.lives -= 1;
        state.combo = 0;
        state.shake = 0.5;
        state.mistakeFlash = 0.6;
        // Its replacement arrives after the usual spawn delay.
        state.spawnTimer = difficultyFor(state.score).spawnDelay;
        events |= EVENT_EXPIRE;
      } else {
        const secs = Math.ceil(order.left);
        if (order.left < SHIFT.urgent && secs !== order.tickedAt) {
          if (order.tickedAt > secs || order.tickedAt < 0) events |= EVENT_TICK;
          order.tickedAt = secs;
        }
      }
    }
    return events;
  }

  /** Drop done and failed tickets whose flash has gone, keeping at most maxOrders open ones. */
  function sweepOrders() {
    const kept = [];
    for (const order of state.orders) {
      if (order.state === ORDER_OPEN || order.flash > 0) kept.push(order);
    }
    while (kept.length > SHIFT.maxOrders) {
      for (let index = 0; index < kept.length; index += 1) {
        if (kept[index].state !== ORDER_OPEN) {
          kept.splice(index, 1);
          break;
        }
      }
      if (kept.length <= SHIFT.maxOrders) break;
      kept.shift();
    }
    state.orders = kept;
  }

  /**
   * One fixed step of the world. Returns a bitmask of what happened; main.js reads it
   * for sound. `dt` is STEP. Nothing here reads a clock: the tick counter is time.
   */
  function step() {
    if (state.screen !== SCREEN_PLAY) {
      if (state.toast !== null) state.toast.life -= STEP;
      if (state.toast !== null && state.toast.life <= 0) state.toast = null;
      return 0;
    }
    const dt = STEP;
    state.tick += 1;
    let events = 0;
    const eventsRef = { value: 0 };
    cook(dt, eventsRef);
    events |= eventsRef.value;

    events = ageOrders(dt, events);

    const open = openCount();
    if (open < SHIFT.maxOrders) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnOrder();
        state.spawnTimer = state.timeMeta.spawnDelay;
      }
    }
    sweepOrders();

    state.shiftLeft = Math.max(0, state.shiftLeft - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.bellPulse > 0) state.bellPulse = Math.max(0, state.bellPulse - dt);
    if (state.mistakeFlash > 0) state.mistakeFlash = Math.max(0, state.mistakeFlash - dt);
    if (state.toast !== null) {
      state.toast.life -= dt;
      if (state.toast.life <= 0) state.toast = null;
    }
    if (state.lastServe !== null) {
      state.lastServe.life -= dt;
      if (state.lastServe.life <= 0) state.lastServe = null;
    }

    if (state.lives <= 0 || state.shiftLeft <= 0) {
      state.lives = Math.max(0, state.lives);
      state.screen = SCREEN_OVER;
      events |= EVENT_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, begin, clickBin, takeSlot, takeCooked, serve, trashPlate, step, difficultyFor };
}
