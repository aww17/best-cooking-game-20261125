// Frozen scenes reached by playing the same actions and ticks as a live shift.
// No scores, tickets, cooked patties or game-over statistics are invented here.
import { STEP, PATTY } from './config.js';
import { SCREEN_PLAY } from './world.js';

function advance(world, seconds) {
  const ticks = Math.round(seconds / STEP);
  for (let i = 0; i < ticks && world.state.screen === SCREEN_PLAY; i += 1) world.step();
}

function until(world, seconds) {
  advance(world, Math.max(0, seconds - world.state.tick * STEP));
}

function openOrders(world) {
  return world.state.orders.filter((order) => order.state === 'open');
}

function assemble(world, order) {
  world.trashPlate();
  for (const id of order.recipe.want) world.clickBin(id);
  if (order.recipe.requires.patty) {
    advance(world, PATTY.cookSeconds + STEP);
    for (let i = 0; i < world.state.grill.length; i += 1) world.takeSlot(i);
  }
}

function serveOrder(world, order) {
  const before = world.state.served;
  assemble(world, order);
  world.serve();
  if (world.state.served !== before + 1) throw new Error('Screenshot action failed to serve a dish');
}

function stageAssembly(world) {
  until(world, 15);
  const garden = openOrders(world).find((order) => order.recipe.id === 'garden');
  if (garden) serveOrder(world, garden);
  world.clickBin('patty');
  until(world, 18);
  for (const id of ['bun', 'lettuce', 'tomato']) world.clickBin(id);
}

export function stageShot(name, world) {
  world.begin(SCREEN_PLAY);
  if (name === 'end') {
    while (world.state.served < 5 && world.state.screen === SCREEN_PLAY) {
      const order = openOrders(world)[0];
      if (order) serveOrder(world, order);
      else advance(world, STEP);
    }
    while (world.state.screen === SCREEN_PLAY) {
      world.clickBin('bun');
      world.serve();
    }
  } else if (name === 'play') {
    until(world, 15);
    const garden = openOrders(world).find((order) => order.recipe.id === 'garden');
    if (garden) serveOrder(world, garden);
    until(world, 30);
    world.clickBin('patty');
    world.clickBin('bun');
    world.clickBin('lettuce');
    until(world, 33);
  } else {
    stageAssembly(world);
    if (name === 'serve') {
      advance(world, PATTY.cookSeconds / 2 + STEP);
      world.takeCooked();
    }
  }
  return { name, screen: world.state.screen, time: world.state.tick * STEP };
}
