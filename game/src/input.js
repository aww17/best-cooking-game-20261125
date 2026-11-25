// Keyboard and pointer input, mapped to game actions. A mouse click is hit-tested against
// the rects and circles the renderer lays out (passed in from render.js), so it lands on
// exactly what is drawn. The keyboard maps digits 1-6 to the counter bins plus G, Space, T,
// R, P and M. Actions become plain objects the main loop applies to the world; this layer
// never touches the rules itself.
import { BINS } from './config.js';
import { FIELD } from './config.js';

export const ACT = {
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  RESTART: 'restart',
  SERVE: 'serve',
  TRASH: 'trash',
  BIN: 'bin',
  TAKE_COOKED: 'takeCooked',
  MUTE: 'mute',
};

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function pointInCircle(x, y, circle) {
  return Math.hypot(x - circle.x, y - circle.y) <= circle.r;
}

/**
 * Turn one canvas-local click (x, y in 1280x720 space) into an action for the current
 * screen, using the latest hit layout: modal overlays first, then the bell, trash, bins and
 * finally the grill slots.
 */
export function hitTest(x, y, layout, screen) {
  if (screen === 'title') return { type: ACT.START };
  if (screen === 'over') {
    if (pointInRect(x, y, layout.restartButton)) return { type: ACT.RESTART };
    return null;
  }
  if (screen === 'paused') {
    if (pointInRect(x, y, layout.resumeButton)) return { type: ACT.RESUME };
    return null;
  }
  if (layout.muteButton !== null && pointInRect(x, y, layout.muteButton)) return { type: ACT.MUTE };
  if (layout.trashBin !== null && pointInRect(x, y, layout.trashBin)) return { type: ACT.TRASH };
  if (layout.bell !== null && pointInRect(x, y, layout.bell)) return { type: ACT.SERVE };
  for (let index = 0; index < layout.bins.length; index += 1) {
    if (pointInRect(x, y, layout.bins[index].rect)) return { type: ACT.BIN, id: layout.bins[index].id };
  }
  for (let index = 0; index < layout.grill.length; index += 1) {
    if (pointInCircle(x, y, layout.grill[index])) return { type: ACT.TAKE_COOKED, index };
  }
  return null;
}

/** Map a keydown's event.code to an action, or null for keys the game ignores. */
export function keyToAction(code) {
  const digit = /^(?:Digit|Numpad)([1-6])$/.exec(code);
  if (digit !== null) return { type: ACT.BIN, id: BINS[Number(digit[1]) - 1].id };
  switch (code) {
    case 'Space':
    case 'Enter':
      return { type: ACT.SERVE };
    case 'KeyT':
    case 'Backspace':
      return { type: ACT.TRASH };
    case 'KeyG':
      return { type: ACT.TAKE_COOKED };
    case 'KeyR':
      return { type: ACT.RESTART };
    case 'KeyP':
    case 'Escape':
      return { type: ACT.PAUSE };
    case 'KeyM':
      return { type: ACT.MUTE };
    default:
      return null;
  }
}

/** Convert a window client point to 1280x720 field coordinates, or null when the canvas has no area. */
export function canvasToField(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD.width,
    y: ((clientY - rect.top) / rect.height) * FIELD.height,
  };
}

/**
 * Wire keyboard and pointer events to `onAction(action, at)`, where at is a click point or
 * null. `getLayout` returns the newest layout and `getScreen` the newest screen, so the
 * handlers always test against the frame that is on the page.
 */
export function createInput(canvas, getLayout, getScreen, onAction) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Tab' || event.code.startsWith('Arrow')) event.preventDefault();
    const action = keyToAction(event.code);
    if (action !== null) onAction(action, null);
  });
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (typeof canvas.focus === 'function') canvas.focus();
    const point = canvasToField(canvas, event.clientX, event.clientY);
    if (point === null) return;
    const action = hitTest(point.x, point.y, getLayout(), getScreen());
    if (action !== null) onAction(action, point);
  });
}
