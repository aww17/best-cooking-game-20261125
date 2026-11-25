// Boot and the one loop: input is applied, the world advances in fixed 1/60 s steps (several
// in a slow frame, none in a fast one) and the renderer paints what is there. The game
// moves between four screens: title, play, paused and over. Sound is the WebAudio synth in
// audio.js; it is unlocked on the first gesture and is never needed to play.
//
// ?seed=N fixes the order draw (?seed=1). ?shot=cover|play|serve|end stages that scene from
// the real rules (shots.js), paints one frozen frame and sets window.__shotReady, so a
// screenshot is deterministic and no audio starts.
import { STEP } from './config.js';
import { mulberry32 } from './random.js';
import {
  createWorld,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_SERVE,
  EVENT_MISS,
  EVENT_EXPIRE,
  EVENT_TRASH,
  EVENT_BURN,
  EVENT_TICK,
} from './world.js';
import { ACT, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 0xffffff) + 1);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = mulberry32(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const audio = createAudio(true);
let last = 0;
let acc = 0;

window.__game = { world, renderer, audio, state: world.state, seed,
  getScreen: () => world.state.screen };

function announce(message) {
  if (status) status.textContent = message;
}

function applyEvent(events) {
  if (events === 0) return;
  if (events & EVENT_SERVE) audio.ding();
  if (events & EVENT_MISS) audio.buzz();
  if (events & EVENT_PICKUP) audio.blip();
  if (events & EVENT_TRASH) audio.blip();
  if (events & EVENT_EXPIRE) audio.buzz();
  if (events & EVENT_BURN) audio.sizzleOff();
  if (events & EVENT_TICK) audio.tick();
  if (events & EVENT_OVER) audio.chime();
}

function startShift() {
  world.begin(SCREEN_PLAY);
  acc = 0;
  audio.unlock();
  announce('Shift started. Three lives.');
}

function applyAction(action) {
  if (action === null) return;
  const screen = world.state.screen;
  switch (action.type) {
    case ACT.START:
      if (screen === SCREEN_TITLE) startShift();
      break;
    case ACT.RESTART:
      startShift();
      break;
    case ACT.PAUSE:
      if (screen === SCREEN_PLAY) {
        world.state.screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        world.state.screen = SCREEN_PLAY;
        announce('Playing.');
      }
      break;
    case ACT.RESUME:
      if (screen === SCREEN_PAUSED) {
        world.state.screen = SCREEN_PLAY;
        announce('Playing.');
      }
      break;
    case ACT.MUTE: {
      const muted = !audio.isMuted();
      audio.setMuted(muted);
      world.state.muted = muted;
      break;
    }
    case ACT.BIN:
      applyEvent(world.clickBin(action.id));
      break;
    case ACT.TAKE_COOKED:
      if (typeof action.index === 'number') applyEvent(world.takeSlot(action.index));
      else applyEvent(world.takeCooked());
      break;
    case ACT.SERVE:
      applyEvent(world.serve());
      break;
    case ACT.TRASH:
      applyEvent(world.trashPlate());
      break;
    default:
      break;
  }
}

function resize() {
  renderer.resize();
}
window.addEventListener('resize', resize);

function loop(now) {
  const dt = last === 0 ? 0 : (now - last) / 1000;
  last = now;
  if (world.state.screen === SCREEN_PLAY) {
    acc += Math.min(0.25, dt);
    let guard = 0;
    while (acc >= STEP && guard < 60) {
      const events = world.step();
      if (events & EVENT_SERVE) announce('Served ' + world.state.served + ' dishes. Score ' + world.state.score + '.');
      if (events !== 0) applyEvent(events);
      acc -= STEP;
      guard += 1;
      if (world.state.screen === SCREEN_OVER) break;
    }
  } else {
    acc = 0;
  }

  // sizzle bed follows how many raw patties cook, and stops as soon as none do
  const raw = world.state.grill.filter((slot) => slot.phase === 'raw').length;
  if (world.state.screen === SCREEN_PLAY && raw > 0 && !world.state.muted) {
    audio.sizzleOn();
    audio.sizzleLevel(0.04 + raw * 0.03);
  } else {
    audio.sizzleOff();
  }

  renderer.draw(world.state, world.state.screen, now / 1000);
  requestAnimationFrame(loop);
}

function boot() {
  resize();
  createInput(canvas, () => renderer.getLayout(), () => world.state.screen, applyAction);
  world.reset();
  last = 0;
  requestAnimationFrame(loop);
}

function runShot(name) {
  resize();
  audio.setShotMode(true);
  const scene = stageShot(name, world);
  renderer.draw(world.state, scene.screen, scene.time);
  window.__shot = scene;
  window.__shotReady = true;
}

if (shotName) runShot(shotName);
else boot();
