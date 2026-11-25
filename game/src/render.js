// All canvas drawing for Simmer & Serve, and nothing else: it reads world state and a
// screen name, paints them at the fixed 1280x720 logical size, and exposes the hit layout
// (rects, circles, bin areas) that the input layer tests clicks against. Every
// ingredient and appliance is a small vector drawing function here; the HUD reads values
// straight from state, so painting a still frame has no side effects.
import { FIELD, FONT, FONT_SERIF, PALETTE, SHIFT, TITLE, BINS, PATTY, PLATE, SCORE } from './config.js';
import { GRILL_BURNED, GRILL_COOKED, GRILL_RAW, ORDER_DONE, ORDER_FAIL, ORDER_OPEN } from './world.js';
import { findMatch } from './recipes.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const W = FIELD.width;
const H = FIELD.height;
const TICKET = { w: 380, h: 96 };

export function ticketRects() {
  const out = [];
  const gap = 26;
  const total = 3 * TICKET.w + 2 * gap;
  const startX = (W - total) / 2;
  for (let index = 0; index < 3; index += 1) {
    out.push({ x: startX + index * (TICKET.w + gap), y: 70, w: TICKET.w, h: TICKET.h });
  }
  return out;
}

const binGap = 16;
function binRects() {
  const n = BINS.length;
  const size = 104;
  const total = n * size + (n - 1) * binGap;
  const startX = (W - total) / 2;
  const y = 592;
  return BINS.map((bin, index) => ({
    id: bin.id,
    name: bin.name,
    key: bin.key,
    isPatty: !!bin.isPatty,
    rect: { x: startX + index * (size + binGap), y, w: size, h: 96 },
  }));
}

const SLOT = [{ x: 150, y: 386 }, { x: 322, y: 386 }];
const PLATE_CENTER = { x: 668, y: 312 };
const BELL = { cx: 1128, cy: 320, r: 66 };
const BELL_BUTTON = { x: 1042, y: 246, w: 172, h: 160 };
const TRASH = { x: 1082, y: 434, w: 94, h: 80 };

function buildLayout() {
  return {
    bins: binRects(),
    grill: SLOT.map((c) => ({ x: c.x, y: c.y, r: 60 })),
    bell: BELL_BUTTON,
    trashBin: TRASH,
    muteButton: { x: 888, y: 10, w: 44, h: 40 },
    restartButton: { x: W / 2 - 124, y: 436, w: 248, h: 62 },
    resumeButton: { x: W / 2 - 124, y: 436, w: 248, h: 62 },
  };
}

export const HIT_LAYOUT = buildLayout();

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function circlePath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

// ---------------------------------------------------------------- ingredient art
// Each draws one ingredient centred at (cx, cy) about `size` px across. Reused on the plate,
// the counter bins and the tickets. `variant` shifts a whole slice slightly, so a stack reads
// as separate layers.

export function drawBun(ctx, cx, cy, size) {
  const w = size * 1.06;
  const h = size * 0.6;
  ctx.save();
  ctx.fillStyle = PALETTE.bunDeep;
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.28, w / 2, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.bun;
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.06, w / 2, h * 0.62, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e7b878';
  ctx.fillRect(cx - w / 2, cy - h * 0.1, w, h * 0.12);
  ctx.fillStyle = 'rgba(255, 249, 234, 0.9)';
  const seeds = [[-0.3, -0.28], [-0.1, -0.42], [0.14, -0.38], [0.3, -0.2], [0.0, -0.2], [-0.2, -0.06], [0.2, -0.02]];
  for (const [sx, sy] of seeds) {
    ctx.beginPath();
    ctx.ellipse(cx + sx * w, cy + sy * h, size * 0.035, size * 0.022, sx, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLettuce(ctx, cx, cy, size) {
  ctx.save();
  const lobes = 9;
  ctx.fillStyle = PALETTE.lettuceDeep;
  ctx.beginPath();
  for (let i = 0; i <= lobes; i += 1) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = size * 0.5 * (0.78 + (i % 2 === 0 ? 0.2 : 0.0));
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.62;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.lettuce;
  ctx.beginPath();
  for (let i = 0; i <= lobes; i += 1) {
    const a = (i / lobes) * Math.PI * 2 + 0.2;
    const rr = size * 0.46 * (i % 2 === 0 ? 1.04 : 0.74);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.6 - size * 0.02;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 140, 40, 0.55)';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.25, cy);
  ctx.quadraticCurveTo(cx - size * 0.06, cy - size * 0.05, cx + size * 0.2, cy + size * 0.01);
  ctx.stroke();
  ctx.restore();
}

export function drawTomato(ctx, cx, cy, size) {
  ctx.save();
  ctx.fillStyle = PALETTE.tomatoDeep;
  circlePath(ctx, cx, cy, size * 0.54);
  ctx.fill();
  ctx.fillStyle = PALETTE.tomato;
  circlePath(ctx, cx, cy, size * 0.46);
  ctx.fill();
  ctx.fillStyle = '#f28d7f';
  for (let i = 0; i < 4; i += 1) {
    const a = i * (Math.PI / 2) + 0.6;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * size * 0.2, cy + Math.sin(a) * size * 0.2, size * 0.13, size * 0.07, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.tomatoDeep;
  circlePath(ctx, cx, cy, size * 0.13);
  ctx.fill();
  ctx.restore();
}

export function drawCheese(ctx, cx, cy, size) {
  ctx.save();
  ctx.fillStyle = PALETTE.cheeseDeep;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.52, cy - size * 0.34);
  ctx.lineTo(cx + size * 0.52, cy - size * 0.2);
  ctx.lineTo(cx + size * 0.42, cy + size * 0.36);
  ctx.lineTo(cx - size * 0.44, cy + size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.cheese;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.44, cy - size * 0.4);
  ctx.lineTo(cx + size * 0.5, cy - size * 0.28);
  ctx.lineTo(cx + size * 0.36, cy + size * 0.22);
  ctx.lineTo(cx - size * 0.34, cy + size * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 150, 30, 0.55)';
  for (const [hx, hy] of [[-0.12, -0.04], [0.16, -0.08], [0.02, 0.06], [-0.22, 0.04]]) {
    ctx.beginPath();
    ctx.arc(cx + hx * size, cy + hy * size, size * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

}

export function drawOnion(ctx, cx, cy, size) {
  ctx.save();
  ctx.strokeStyle = PALETTE.onionDeep;
  ctx.lineWidth = size * 0.1;
  circlePath(ctx, cx, cy, size * 0.44);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.onion;
  ctx.lineWidth = size * 0.1;
  circlePath(ctx, cx, cy, size * 0.38);
  ctx.stroke();
  ctx.strokeStyle = '#e8d8f2';
  ctx.lineWidth = size * 0.04;
  circlePath(ctx, cx, cy, size * 0.28);
  ctx.stroke();
  ctx.restore();
}

/** A patty at one doneness: raw, cooked (done), burnt. It reads the same on grill, plate and bins. */
export function drawPatty(ctx, cx, cy, size, state) {
  ctx.save();
  let top = PALETTE.pattyCooked;
  let edge = PALETTE.pattyCookedDeep;
  if (state === 'raw') {
    top = PALETTE.pattyRaw;
    edge = PALETTE.pattyRawDeep;
  } else if (state === 'burnt') {
    top = PALETTE.pattyBurnt;
    edge = PALETTE.pattyBurntDeep;
  }
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.1, size * 0.55, size * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(cx, cy - size * 0.02, size * 0.53, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  if (state === 'cooked') {
    ctx.fillStyle = 'rgba(46, 26, 12, 0.55)';
    for (const [gx, gy] of [[-0.24, -0.06], [0.2, 0.08], [-0.02, 0.14], [0.26, -0.14], [-0.3, 0.12]]) {
      ctx.beginPath();
      ctx.ellipse(cx + gx * size, cy + gy * size, size * 0.07, size * 0.045, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.35)';
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.ellipse(cx - size * 0.1, cy - size * 0.12, size * 0.18, size * 0.07, -0.4, 0, Math.PI);
    ctx.stroke();
  } else if (state === 'raw') {
    ctx.fillStyle = 'rgba(255, 205, 205, 0.45)';
    for (const [gx, gy] of [[-0.2, 0.0], [0.16, 0.06], [0.0, -0.1]]) {
      ctx.beginPath();
      ctx.arc(cx + gx * size, cy + gy * size, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (state === 'burnt') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.2, cy - size * 0.1);
    ctx.lineTo(cx - size * 0.05, cy + size * 0.02);
    ctx.lineTo(cx - size * 0.16, cy + size * 0.12);
    ctx.moveTo(cx + size * 0.18, cy - size * 0.06);
    ctx.lineTo(cx + size * 0.06, cy + size * 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawIngredient(ctx, id, cx, cy, size, variant) {
  switch (id) {
    case 'bun':
      drawBun(ctx, cx, cy, size);
      break;
    case 'lettuce':
      drawLettuce(ctx, cx, cy, size);
      break;
    case 'tomato':
      drawTomato(ctx, cx, cy, size);
      break;
    case 'cheese':
      drawCheese(ctx, cx, cy - size * 0.05 * (variant ?? 0), size);
      break;
    case 'onion':
      drawOnion(ctx, cx, cy, size);
      break;
    case 'patty':
      drawPatty(ctx, cx, cy, size * 1.04, 'cooked');
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- the room

function drawBackdrop(ctx) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 64, 0, 560);
  grad.addColorStop(0, PALETTE.wall);
  grad.addColorStop(0.6, PALETTE.wallShade);
  grad.addColorStop(1, PALETTE.tile);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 64, W, 496);
  ctx.restore();
}

function drawTiles(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(199, 159, 109, 0.28)';
  ctx.lineWidth = 2;
  for (let y = 300; y < 560; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  let row = 0;
  for (let y = 300; y < 560; y += 60) {
    const offset = row % 2 === 0 ? 0 : 60;
    for (let x = offset; x < W; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 60);
      ctx.stroke();
    }
    row += 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the renderer

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let cssWidth = W;
  let cssHeight = H;

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    cssWidth = Math.max(1, Math.round(W * scale));
    cssHeight = Math.max(1, Math.round(H * scale));
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
  }

  function text(str, x, y, font, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  }

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds - 1e-8));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function shakeOffset(state) {
    if (state.shake <= 0) return { x: 0, y: 0 };
    const s = state.shake;
    return { x: Math.sin(state.tick * 1.7) * 9 * s, y: Math.cos(state.tick * 2.3) * 6 * s };
  }

  function drawHeart(x, y, r, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.7);
    ctx.bezierCurveTo(-r * 1.3, -r * 0.35, -r * 0.55, -r * 1.15, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.55, -r * 1.15, r * 1.3, -r * 0.35, 0, r * 0.7);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#e0453a';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.34, -r * 0.34, r * 0.2, r * 0.14, -0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(120, 95, 70, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 95, 70, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTopBar(ctx, state) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#fffaf0');
    grad.addColorStop(1, '#fbf0d9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 64);
    // red-checkered band under the bar
    for (let x = 0; x < W; x += 32) {
      ctx.fillStyle = (x / 32) % 2 === 0 ? PALETTE.red : PALETTE.cream;
      ctx.fillRect(x, 58, 32, 6);
    }

    // score + hearts
    text('SCORE', 24, 24, 'bold 13px ' + FONT, PALETTE.inkSoft);
    text(String(state.score), 24, 50, 'bold 30px ' + FONT, PALETTE.ink);
    for (let i = 0; i < SHIFT.lives; i += 1) {
      drawHeart(150 + i * 34, 40, 13, i < state.lives);
    }

    // centre title
    text(TITLE, W / 2, 30, 'bold 19px ' + FONT, PALETTE.ink, 'center', 'middle');
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.textAlign = 'center';
    ctx.fillText('a lunchtime rush', W / 2, 47);

    // shift timer + progress
    const bx = W - 334;
    const timeStr = fmtTime(state.shiftLeft);
    text(timeStr, W - 24, 33, 'bold 24px ' + FONT, PALETTE.ink, 'right', 'middle');
    ctx.fillStyle = 'rgba(58,42,28,0.18)';
    roundRect(ctx, bx, 46, 310, 8, 4);
    ctx.fill();
    const frac = Math.max(0, Math.min(1, state.shiftLeft / SHIFT.seconds));
    ctx.fillStyle = frac > 0.25 ? PALETTE.green : PALETTE.tomato;
    roundRect(ctx, bx, 46, Math.max(2, 310 * frac), 8, 4);
    ctx.fill();
    ctx.restore();
  }

  function drawOrderBoard(ctx, state, time) {
    ctx.save();
    // wooden order rail
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(0, 64, W, 106);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(0, 64, W, 8);
    ctx.fillRect(0, 164, W, 6);
    const rects = ticketRects();
    const open = state.orders.filter((o) => o.state === ORDER_OPEN);
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      const order = open[i];
      if (order === undefined) drawEmptyTicket(r);
      else drawTicket(r, order, state, time);
    }
    ctx.restore();
  }

  function drawEmptyTicket(r) {
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.strokeStyle = 'rgba(255, 247, 230, 0.55)';
    ctx.lineWidth = 2;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    text('waiting...', r.x + r.w / 2, r.y + r.h / 2, 'italic 17px ' + FONT, 'rgba(255, 247, 230, 0.6)', 'center', 'middle');
    ctx.restore();
  }

  function drawTicket(r, order, state, time) {
    const recipe = order.recipe;
    const frac = Math.max(0, Math.min(1, order.left / order.total));
    const urgent = order.left < SHIFT.urgent;
    const pressing = urgent || frac < 0.2;
    const flash = pressing ? 0.5 + 0.5 * Math.sin(time * 9) : 0;

    ctx.save();
    // paper with a slight warm shadow
    ctx.fillStyle = 'rgba(30, 18, 8, 0.28)';
    roundRect(ctx, r.x + 3, r.y + 4, r.w, r.h, 9);
    ctx.fill();
    ctx.fillStyle = PALETTE.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, 9);
    ctx.fill();
    // red header strip
    ctx.fillStyle = pressing ? (urgent ? '#c53a2c' : '#b5473a') : PALETTE.red;
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, 9);
    ctx.clip();
    ctx.fillRect(r.x, r.y, r.w, 28);
    ctx.restore();

    text(recipe.name, r.x + 14, r.y + 15, 'bold 16px ' + FONT, PALETTE.cream, 'left', 'middle');
    const reward = SCORE.base + Math.floor(order.left) * SCORE.perSecond + state.combo * SCORE.comboBonus;
    text('+' + reward, r.x + r.w - 14, r.y + 15, 'bold 15px ' + FONT, PALETTE.goldLight, 'right', 'middle');

    // four required ingredient icons, the recipe wants top to bottom
    const icons = recipe.want;
    const iconY = r.y + 54;
    const gap = (r.w - 28) / icons.length;
    for (let i = 0; i < icons.length; i += 1) {
      const cx = r.x + 14 + gap * (i + 0.5);
      drawIngredient(ctx, icons[i], cx, iconY, 30, 0);
    }

    // countdown bar green -> amber -> red
    const barY = r.y + r.h - 22;
    const barW = r.w - 28;
    ctx.fillStyle = 'rgba(58, 42, 28, 0.14)';
    roundRect(ctx, r.x + 14, barY, barW, 9, 4.5);
    ctx.fill();
    const hue = urgent || (frac < 0.35) ? PALETTE.tomato : frac < 0.62 ? PALETTE.amber : PALETTE.green;
    ctx.fillStyle = hue;
    roundRect(ctx, r.x + 14, barY, Math.max(6, barW * frac), 9, 4.5);
    ctx.fill();

    const secs = Math.ceil(order.left - 1e-8);
    const secColor = urgent ? PALETTE.red : PALETTE.ink;
    const secsText = secs + 's';
    text(pressing ? secsText + '!' : secsText, r.x + r.w - 14, r.y + 88, (urgent ? 'bold 16px ' : 'bold 14px ') + FONT, secColor, 'right', 'middle');

    if (pressing && flash > 0.5) {
      ctx.strokeStyle = urgent ? 'rgba(197, 58, 44, 0.85)' : 'rgba(184, 53, 44, 0.7)';
      ctx.lineWidth = 3;
      roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrill(ctx, state, time) {
    const ax = 34;
    const ay = 246;
    const aw = 404;
    const ah = 276;
    // steel body
    ctx.save();
    ctx.fillStyle = 'rgba(20, 14, 8, 0.25)';
    roundRect(ctx, ax + 4, ay + 8, aw, ah, 18);
    ctx.fill();
    const body = ctx.createLinearGradient(0, ay, 0, ay + ah);
    body.addColorStop(0, '#8b949c');
    body.addColorStop(0.12, '#6f787f');
    body.addColorStop(1, '#3d444a');
    ctx.fillStyle = body;
    roundRect(ctx, ax, ay, aw, ah, 18);
    ctx.fill();
    ctx.strokeStyle = '#2a2f34';
    ctx.lineWidth = 3;
    roundRect(ctx, ax, ay, aw, ah, 18);
    ctx.stroke();
    // back wall of the firebox
    ctx.fillStyle = '#1b1712';
    roundRect(ctx, ax + 14, ay + 22, aw - 28, 150, 10);
    ctx.fill();

    // glowing coals under the grate
    for (let i = 0; i < 17; i += 1) {
      const gx = ax + 30 + (i * 37) % (aw - 60);
      const gy = ay + 96 + ((i * 53) % 60);
      const flick = 0.5 + 0.5 * Math.sin(time * 5 + i * 1.7);
      const rad = 7 + flick * 7;
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
      glow.addColorStop(0, 'rgba(255, 180, 80, ' + (0.35 + flick * 0.4) + ')');
      glow.addColorStop(1, 'rgba(255, 90, 30, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gx, gy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // grate bars
    ctx.strokeStyle = '#1d2024';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i += 1) {
      const yy = ay + 54 + i * 14;
      ctx.beginPath();
      ctx.moveTo(ax + 18, yy);
      ctx.lineTo(ax + aw - 18, yy);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // the two slots
    for (let i = 0; i < 2; i += 1) {
      drawSlotCircle(ctx, SLOT[i], state, i, time);
    }

    // front lip with a label
    ctx.fillStyle = '#555d64';
    roundRect(ctx, ax + 14, ay + ah - 22, aw - 28, 14, 6);
    ctx.fill();
    text('GRILL   -   click a cooked patty to plate it', ax + aw / 2, ay + ah - 15, 'bold 11px ' + FONT, '#cfd5da', 'center', 'middle');
    ctx.restore();
  }

  function drawSlotCircle(ctx, center, state, index, time) {
    const slot = state.grill[index];
    const r = 60;
    ctx.save();
    ctx.fillStyle = '#0e0c0a';
    circlePath(ctx, center.x, center.y, r + 6);
    ctx.fill();
    ctx.strokeStyle = '#20252a';
    ctx.lineWidth = 4;
    circlePath(ctx, center.x, center.y, r + 3);
    ctx.stroke();

    const active = slot.phase === GRILL_RAW || slot.phase === GRILL_COOKED || slot.phase === GRILL_BURNED;
    if (active) {
      const ringR = r + 15;
      ctx.lineWidth = 9;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      circlePath(ctx, center.x, center.y, ringR);
      ctx.stroke();
      let frac = 0;
      let color = PALETTE.green;
      if (slot.phase === GRILL_RAW) {
        frac = slot.progress;
        color = slot.progress > 0.82 ? PALETTE.amber : PALETTE.green;
      } else if (slot.phase === GRILL_COOKED) {
        frac = slot.keepLeft / PATTY.keepSeconds;
        color = slot.keepLeft <= 1.5 ? PALETTE.tomato : PALETTE.gold;
      } else {
        frac = 0;
        color = PALETTE.pattyBurnt;
      }
      if (frac > 0) {
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(center.x, center.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }

    const s = slot.phase;
    if (s === 'empty') {
      text('FREE', center.x, center.y - 3, 'bold 13px ' + FONT, '#6e7478', 'center', 'middle');
      text('2  to grill', center.x, center.y + 17, '12px ' + FONT, '#777e82', 'center', 'middle');
    } else if (s === GRILL_RAW) {
      const t = Math.max(0, Math.min(1, slot.progress));
      drawRawPatty(ctx, center.x, center.y, 98, t, time);
      text(Math.ceil((1 - t) * PATTY.cookSeconds) + 's', center.x, center.y + 51, 'bold 12px ' + FONT, PALETTE.cream, 'center', 'middle');
    } else if (s === GRILL_COOKED) {
      drawPatty(ctx, center.x, center.y, 98, 'cooked');
      if (slot.keepLeft <= 1.5) {
        ctx.strokeStyle = 'rgba(230, 80, 40, 0.9)';
        ctx.lineWidth = 4;
        circlePath(ctx, center.x, center.y, r + 1 + Math.sin(time * 14) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, center.x - 26, center.y + 40, 52, 22, 8);
      ctx.fill();
      text('READY', center.x, center.y + 51, 'bold 12px ' + FONT, PALETTE.goldLight, 'center', 'middle');
    } else if (s === GRILL_BURNED) {
      drawPatty(ctx, center.x, center.y, 98, 'burnt');
      // smoke puffs
      for (let k = 0; k < 3; k += 1) {
        const pa = time * 1.4 + k * 2.1;
        const puffX = center.x + Math.sin(pa) * 18;
        const puffY = center.y - 44 - ((time * 40 + k * 20) % 60);
        const alpha = 0.4 * (1 - (((time * 0.6 + k * 0.3) % 1)));
        ctx.fillStyle = 'rgba(80, 80, 86, ' + alpha + ')';
        circlePath(ctx, puffX, puffY, 10 + k * 3);
        ctx.fill();
      }
    }
    ctx.restore();
  }

/** A patty on the fire, brown growing from raw pink to cooked as progress goes 0 to 1. */
function drawRawPatty(ctx, cx, cy, size, progress, time) {
  ctx.save();
  const t = Math.max(0, Math.min(1, progress));
  const r1 = 196, g1 = 106, b1 = 114;
  const r2 = 122, g2 = 74, b2 = 42;
  const rr = Math.round(r1 + (r2 - r1) * t);
  const gg = Math.round(g1 + (g2 - g1) * t);
  const bb = Math.round(b1 + (b2 - b1) * t);
  ctx.fillStyle = 'rgba(30, 16, 8, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.11, size * 0.56, size * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgb(' + rr + ',' + gg + ',' + bb + ')';
  ctx.beginPath();
  ctx.ellipse(cx, cy - size * 0.01, size * 0.54, size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // sizzle highlights, dimming as it cooks
  ctx.fillStyle = 'rgba(255, 230, 210, ' + (0.5 - t * 0.35) + ')';
  for (let i = 0; i < 5; i += 1) {
    const a = time * 3 + i * 1.7;
    const hx = cx + Math.cos(a) * size * (0.16 + (i % 3) * 0.09);
    const hy = cy + Math.sin(a * 1.3) * size * 0.12;
    ctx.beginPath();
    ctx.arc(hx, hy, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

  function drawPlateArea(ctx, state, time) {
    const pa = { x: 452, y: 236, w: 420, h: 302 };
    ctx.save();
    // shallow wooden tray with a red-checkered napkin
    ctx.fillStyle = 'rgba(30, 18, 8, 0.22)';
    roundRect(ctx, pa.x + 4, pa.y + 8, pa.w, pa.h, 16);
    ctx.fill();
    ctx.fillStyle = '#fbf1dc';
    roundRect(ctx, pa.x, pa.y, pa.w, pa.h, 16);
    ctx.fill();
    drawNapkin(ctx, pa);
    ctx.strokeStyle = PALETTE.counterDark;
    ctx.lineWidth = 3;
    roundRect(ctx, pa.x, pa.y, pa.w, pa.h, 16);
    ctx.stroke();

    ctx.fillStyle = '#fff8e9';
    roundRect(ctx, pa.x + 14, pa.y + 12, 122, 32, 10);
    ctx.fill();
    text('THE PASS', pa.x + 75, pa.y + 29, 'bold 14px ' + FONT, PALETTE.inkSoft, 'center', 'middle');

    drawPlate(ctx, state, time);
    ctx.restore();
  }

  function drawNapkin(ctx, pa) {
    ctx.save();
    roundRect(ctx, pa.x, pa.y, pa.w, pa.h, 16);
    ctx.clip();
    ctx.fillStyle = 'rgba(184, 53, 44, 0.9)';
    ctx.fillRect(pa.x, pa.y, pa.w, pa.h);
    ctx.fillStyle = 'rgba(255, 238, 220, 0.9)';
    const cell = 30;
    for (let y = pa.y; y < pa.y + pa.h; y += cell) {
      for (let x = pa.x; x < pa.x + pa.w; x += cell) {
        if (((x - pa.x) / cell + (y - pa.y) / cell) % 2 === 0) ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.restore();
  }

  // The plate in the middle: a white ceramic dish with the stacked ingredients centred on
  // it, tallest on top. Bun silhouette at top and bottom, layers of fill in between.
  function drawPlate(ctx, state, time) {
    const cx = PLATE_CENTER.x;
    const baseY = PLATE_CENTER.y + 96;
    ctx.save();
    // plate: outer ring then inner well
    ctx.fillStyle = 'rgba(30, 18, 8, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, baseY + 8, 178, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    const rim = ctx.createRadialGradient(cx - 40, baseY - 18, 20, cx, baseY, 188);
    rim.addColorStop(0, '#ffffff');
    rim.addColorStop(0.7, '#f3efe6');
    rim.addColorStop(1, '#d8d0c1');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 178, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ece6d9';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 150, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 148, 128, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 150, 35, 0, 0, Math.PI * 2);
    ctx.stroke();

    const items = state.plate;
    if (items.length === 0) {
      text('Build the dish here', cx, baseY - 50, 'italic 17px ' + FONT, 'rgba(107, 84, 64, 0.55)', 'center', 'middle');
      text('then serve', cx, baseY - 28, 'italic 15px ' + FONT, 'rgba(107, 84, 64, 0.45)', 'center', 'middle');
      ctx.restore();
      return;
    }

    // Assemble broad, overlapping food layers. A bun is one ingredient, drawn split.
    const buns = items.filter((id) => id === 'bun').length;
    let y = baseY - 17;
    if (buns > 0) {
      ctx.fillStyle = PALETTE.bunDeep;
      roundRect(ctx, cx - 96, y - 12, 192, 27, 13);
      ctx.fill();
      ctx.fillStyle = '#edbd7b';
      ctx.beginPath();
      ctx.ellipse(cx, y - 10, 94, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      y -= 21;
    }
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const id = items[i];
      if (id === 'bun') continue;
      if (id === 'patty') {
        drawPatty(ctx, cx, y - 2, 168, 'cooked');
        y -= 27;
      } else {
        ctx.save();
        ctx.translate(cx, y - 2);
        ctx.scale(1, id === 'lettuce' ? 0.32 : 0.22);
        drawIngredient(ctx, id, 0, 0, 186, i);
        ctx.restore();
        y -= id === 'onion' ? 14 : 20;
      }
    }
    for (let i = 0; i < buns; i += 1) {
      drawBunOnPlate(ctx, cx, y - 6, 122);
      y -= 29;
    }
    const ready = findMatch(state.orders.filter((o) => o.state === ORDER_OPEN), items);
    ctx.fillStyle = '#fff9ec';
    roundRect(ctx, cx - 105, baseY + 55, 210, 31, 10);
    ctx.fill();
    text(ready ? 'READY TO SERVE' : items.length + ' / ' + PLATE.maxItems + ' ingredients', cx, baseY + 71,
      'bold 13px ' + FONT, ready ? PALETTE.greenDeep : PALETTE.inkSoft, 'center', 'middle');
    ctx.restore();
  }

  function drawBunOnPlate(ctx, cx, cy, size) {
    const w = size * 1.6;
    const h = size * 0.7;
    ctx.save();
    ctx.fillStyle = PALETTE.bunDeep;
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.05, w / 2, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.bun;
    ctx.beginPath();
    ctx.ellipse(cx, cy - h * 0.12, w / 2, h * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 235, 0.92)';
    for (let i = 0; i < 9; i += 1) {
      const a = Math.PI + (i / 8) * Math.PI;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * w * 0.32, cy + Math.sin(a) * h * 0.24 - h * 0.1, size * 0.07, size * 0.045, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // The service bell on its red button, and the bin beside it. The plate sends to the bell,
  // so the bell brightens, grows and glows in gold when the plate can be served.
  function drawServiceStation(ctx, state, time) {
    ctx.save();
    // station backdrop: red-checkered accent panel
    const px = 1024, py = 214, pw = 222, ph = 320;
    ctx.fillStyle = 'rgba(30, 18, 8, 0.18)';
    roundRect(ctx, px + 4, py + 6, pw, ph, 14);
    ctx.fill();
    ctx.fillStyle = '#fff4de';
    roundRect(ctx, px, py, pw, ph, 14);
    ctx.fill();
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 14);
    ctx.clip();
    ctx.fillStyle = 'rgba(184, 53, 44, 0.10)';
    for (let y = py; y < py + ph; y += 24) {
      for (let x = px; x < px + pw; x += 24) {
        if (((x - px) / 24 + (y - py) / 24) % 2 === 0) ctx.fillRect(x, y, 24, 24);
      }
    }
    ctx.restore();
    ctx.strokeStyle = PALETTE.redDeep;
    ctx.lineWidth = 3;
    roundRect(ctx, px, py, pw, ph, 14);
    ctx.stroke();

    const canServe = findMatch(state.orders.filter((o) => o.state === ORDER_OPEN), state.plate) !== null;
    const cx = BELL.cx;
    const cy = BELL.cy - 28;
    const r = BELL.r;

    // glow + pulse when servable
    if (canServe) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 7);
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, r + 40);
      glow.addColorStop(0, 'rgba(255, 220, 120, ' + (0.45 + pulse * 0.35) + ')');
      glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // base plate
    const baseGrad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    baseGrad.addColorStop(0, '#a9771c');
    baseGrad.addColorStop(0.5, '#f0c552');
    baseGrad.addColorStop(1, '#8f6415');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 42, r * 0.92, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // the dome
    const dome = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.6, cy + 30);
    dome.addColorStop(0, '#fff6d8');
    dome.addColorStop(0.25, '#ffe999');
    dome.addColorStop(0.6, '#f4c04a');
    dome.addColorStop(1, '#a8751b');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.arc(cx, cy + 22, r, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    // shine on the dome
    ctx.fillStyle = 'rgba(255, 255, 240, 0.7)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.38, cy - r * 0.3, r * 0.18, r * 0.32, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // rim
    ctx.strokeStyle = '#8f6415';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + 22);
    ctx.lineTo(cx + r, cy + 22);
    ctx.stroke();
    // button on top
    ctx.fillStyle = PALETTE.red;
    ctx.beginPath();
    ctx.arc(cx, cy - r + 6, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f27a6a';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - r + 3, 3, 0, Math.PI * 2);
    ctx.fill();

    text('SERVE', cx, cy + 60, 'bold 13px ' + FONT, PALETTE.inkSoft, 'center', 'middle');
    text('click  /  Space', cx, cy + 78, '11px ' + FONT, 'rgba(107, 84, 64, 0.7)', 'center', 'middle');

    // trash bin
    drawTrash(ctx, state);
    ctx.restore();
  }

  function drawTrash(ctx, state) {
    const r = TRASH;
    const lidY = r.y;
    ctx.save();
    ctx.fillStyle = 'rgba(30, 18, 8, 0.2)';
    roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 12);
    ctx.fill();
    // body: steel can with vertical lines
    const body = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    body.addColorStop(0, '#7c848b');
    body.addColorStop(0.5, '#aeb6bd');
    body.addColorStop(1, '#6a7278');
    ctx.fillStyle = body;
    roundRect(ctx, r.x + 8, lidY + 16, r.w - 16, r.h - 18, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 66, 72, 0.6)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i += 1) {
      const lx = r.x + 8 + ((r.w - 16) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(lx, lidY + 24);
      ctx.lineTo(lx, r.y + r.h - 8);
      ctx.stroke();
    }
    // lid
    ctx.fillStyle = '#cdd3d8';
    roundRect(ctx, r.x, lidY, r.w, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#9aa2a8';
    roundRect(ctx, r.x + r.w / 2 - 16, lidY - 7, 32, 10, 4);
    ctx.fill();
    // a little swoosh
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r.x + 34, r.y + 46);
    ctx.quadraticCurveTo(r.x + 58, r.y + 96, r.x + 82, r.y + 46);
    ctx.stroke();
    ctx.lineCap = 'butt';
    text('BIN', r.x + r.w / 2, r.y + r.h + 16, 'bold 13px ' + FONT, PALETTE.inkSoft, 'center', 'middle');
    text('T', r.x + r.w / 2, r.y + r.h + 30, 'bold 12px ' + FONT, 'rgba(107, 84, 64, 0.7)', 'center', 'middle');
    ctx.restore();
  }

  // The counter: six ingredient bins on a wooden shelf, each an icon, a name and its hotkey.
  // The patty bin is the one you click to start a cook; it pulses when it is the move.
  function drawCounter(ctx, state, time) {
    const c = { x: 0, y: 556, w: W, h: 146 };
    ctx.save();
    // shelf board
    const board = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
    board.addColorStop(0, '#d8b07a');
    board.addColorStop(0.15, PALETTE.counter);
    board.addColorStop(1, '#a87c4c');
    ctx.fillStyle = board;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(94, 59, 31, 0.35)';
    ctx.fillRect(c.x, c.y, c.w, 4);
    // wood grain
    ctx.strokeStyle = 'rgba(120, 80, 44, 0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i += 1) {
      const gy = c.y + 10 + ((i * 37) % (c.h - 18));
      ctx.beginPath();
      ctx.moveTo(10, gy);
      for (let x = 10; x < W; x += 80) {
        ctx.quadraticCurveTo(x + 40, gy + Math.sin(i + x) * 2.4, x + 80, gy);
      }
      ctx.stroke();
    }
    const rects = layoutBins();
    for (const bin of rects) {
      drawBin(ctx, bin, state, time);
    }
    ctx.restore();
  }

  function layoutBins() {
    return HIT_LAYOUT.bins;
  }

  function drawBin(ctx, bin, state, time) {
    const r = bin.rect;
    const hover = 0;
    ctx.save();
    // shadow + body
    ctx.fillStyle = 'rgba(40, 24, 10, 0.25)';
    roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 12);
    ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#fffdf7');
    g.addColorStop(1, '#f0e5cf');
    ctx.fillStyle = g;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#c9b592';
    ctx.lineWidth = 2;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();

    // icon well
    ctx.fillStyle = 'rgba(184, 53, 44, 0.08)';
    roundRect(ctx, r.x + 8, r.y + 8, r.w - 16, 52, 8);
    ctx.fill();

    const cx = r.x + r.w / 2;
    if (bin.isPatty) {
      drawPatty(ctx, cx, r.y + 34, 40, 'raw');
      const slots = state.grill;
      const busy = slots.filter((s) => s.phase === GRILL_RAW || s.phase === GRILL_COOKED).length;
      if (busy === 0 && state.plate.length === 0) {
        ctx.strokeStyle = 'rgba(90, 168, 69, 0.8)';
        ctx.lineWidth = 3;
        roundRect(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 12);
        ctx.stroke();
      }
    } else {
      drawIngredient(ctx, bin.id, cx, r.y + 34, 44, 0);
    }

    text(bin.name, cx, r.y + 70, 'bold 14px ' + FONT, PALETTE.ink, 'center', 'middle');

    // key badge
    ctx.fillStyle = PALETTE.woodDark;
    circlePath(ctx, cx, r.y + 85, 10);
    ctx.fill();
    text(bin.key, cx, r.y + 86, 'bold 12px ' + FONT, PALETTE.cream, 'center', 'middle');
    ctx.restore();
  }

  const HELP = 'Click ingredients to build the dish  -  Space: serve  -  T: trash  -  R: restart  -  P: pause  -  M: mute';

  function drawHelp(ctx) {
    const h = { x: 0, y: 700, w: W, h: 20 };
    ctx.save();
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(h.x, h.y, h.w, h.h);
    text(HELP, W / 2, h.y + 11, '13px ' + FONT, 'rgba(255, 240, 210, 0.78)', 'center', 'middle');
    ctx.restore();
  }

  function drawMute(ctx, state) {
    const mb = HIT_LAYOUT.muteButton;
    ctx.save();
    ctx.fillStyle = 'rgba(58, 42, 28, 0.10)';
    roundRect(ctx, mb.x, mb.y, mb.w, mb.h, 10);
    ctx.fill();
    const cx = mb.x + 13;
    const cy = mb.y + mb.h / 2;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 4);
    ctx.lineTo(cx, cy - 4);
    ctx.lineTo(cx + 5, cy - 9);
    ctx.lineTo(cx + 5, cy + 9);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx - 5, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.inkSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (state.muted) {
      ctx.moveTo(cx + 10, cy - 6);
      ctx.lineTo(cx + 18, cy + 6);
      ctx.moveTo(cx + 18, cy - 6);
      ctx.lineTo(cx + 10, cy + 6);
    } else {
      ctx.arc(cx + 6, cy, 6, -0.7, 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 6, cy, 11, -0.6, 0.6);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawToast(ctx, state, time) {
    if (state.toast === null) return;
    const t = state.toast;
    const life = Math.max(0, Math.min(1, t.life / 0.35));
    ctx.save();
    ctx.globalAlpha = life;
    ctx.font = 'bold 18px ' + FONT;
    const w = ctx.measureText(t.text).width + 40;
    const x = PLATE_CENTER.x - w / 2;
    const y = 196;
    ctx.fillStyle = 'rgba(40, 24, 10, 0.88)';
    roundRect(ctx, x, y, w, 38, 19);
    ctx.fill();
    text(t.text, PLATE_CENTER.x, y + 20, 'bold 18px ' + FONT, PALETTE.cream, 'center', 'middle');
    ctx.restore();
  }

  function drawLastServe(ctx, state) {
    if (state.lastServe === null) return;
    const s = state.lastServe;
    const age = 2.2 - s.life;
    const rise = Math.min(18, age * 40);
    const alpha = Math.min(1, s.life / 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    const x = PLATE_CENTER.x;
    const y = 212 - rise;
    text('+' + s.reward, x, y, 'bold 34px ' + FONT_SERIF, PALETTE.greenDeep, 'center', 'middle');
    let sub = s.name;
    if (s.comboBonus > 0) sub += '   combo +' + s.comboBonus;
    text(sub, x, y + 24, 'bold 14px ' + FONT, PALETTE.inkSoft, 'center', 'middle');
    ctx.restore();
  }

  function drawCombo(ctx, state, time) {
    if (state.combo < 2) return;
    const pulse = 1 + 0.04 * Math.sin(time * 8);
    ctx.save();
    ctx.translate(668, 524);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = PALETTE.cream;
    roundRect(ctx, -72, -13, 144, 25, 9);
    ctx.fill();
    text('x' + state.combo + ' COMBO', 0, 0, 'bold 16px ' + FONT, PALETTE.goldDark, 'center', 'middle');
    ctx.restore();
  }

  function drawPlay(ctx, state, time) {
    const shake = shakeOffset(state);
    ctx.save();
    ctx.translate(shake.x, shake. y);
    drawBackdrop(ctx);
    drawTiles(ctx);
    drawGrill(ctx, state, time);
    drawPlateArea(ctx, state, time);
    drawServiceStation(ctx, state, time);
    drawToast(ctx, state, time);
    drawLastServe(ctx, state);
    ctx.restore();
    drawTopBar(ctx, state);
    drawOrderBoard(ctx, state, time);
    drawCounter(ctx, state, time);
    drawHelp(ctx);
    drawCombo(ctx, state, time);
    drawMute(ctx, state);
  }

  // ---------------------------------------------------------------- full-screen overlays

  function dimPage(ctx, alpha) {
    ctx.save();
    ctx.fillStyle = 'rgba(24, 14, 6, ' + alpha + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawButton(ctx, rect, label, fill, textColor) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, rect.x + 3, rect.y + 5, rect.w, rect.h, rect.h / 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    g.addColorStop(0, fill);
    g.addColorStop(1, shade(fill, -0.18));
    ctx.fillStyle = g;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
    ctx.fill();
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, 'bold 20px ' + FONT, textColor, 'center', 'middle');
    ctx.restore();
  }

  function shade(hex, amount) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = clamp8(((n >> 16) & 255) + amount * 255);
    const g = clamp8(((n >> 8) & 255) + amount * 255);
    const b = clamp8((n & 255) + amount * 255);
    return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  function clamp8(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  function panel(ctx, x, y, w, height, fill) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 12, 6, 0.45)';
    roundRect(ctx, x + 4, y + 8, w, height, 16);
    ctx.fill();
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, height, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.goldDark;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, height, 16);
    ctx.stroke();
    ctx.restore();
  }

  function drawTitle(ctx, state, time) {
    drawPlay(ctx, state, time);
    dimPage(ctx, 0.5);
    const pw = 820, ph = 386;
    const px = (W - pw) / 2, py = 168;
    panel(ctx, px, py, pw, ph, '#fffaf0');

    // little checkered band
    ctx.save();
    roundRect(ctx, px, py, pw, 12, 6);
    ctx.clip();
    for (let x = px; x < px + pw; x += 16) {
      ctx.fillStyle = ((x - px) / 16) % 2 === 0 ? PALETTE.red : PALETTE.cream;
      ctx.fillRect(x, py, 16, 12);
    }
    ctx.restore();

    text(TITLE, W / 2, py + 62, 'bold 44px ' + FONT_SERIF, PALETTE.redDeep, 'center', 'middle');
    text('a frantic little lunchtime kitchen', W / 2, py + 96, 'italic 18px ' + FONT_SERIF, PALETTE.inkSoft, 'center', 'middle');

    const lines = [
      'Read the tickets on the board. Stack each dish on the plate from the counter bins.',
      'Raw patties go on the grill - wait for them to cook, then click the patty to plate it.',
      'Serve at the bell for an exact match. Wrong plates and expired tickets cost a life.',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], W / 2, py + 136 + i * 26, '15px ' + FONT, PALETTE.ink, 'center', 'middle');
    }

    ctx.save();
    const bx = W / 2 - 115, by = py + 232, bw = 230, bh = 30;
    ctx.fillStyle = 'rgba(184, 53, 44, 0.08)';
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.restore();
    text('1-6 add  -  G grab  -  Space serve', W / 2, py + 247, 'bold 14px ' + FONT, PALETTE.inkSoft, 'center', 'middle');

    const pulse = 0.75 + 0.25 * Math.sin(time * 3);
    ctx.save();
    ctx.globalAlpha = pulse;
    text('click to start', W / 2, py + ph - 34, 'bold 24px ' + FONT_SERIF, PALETTE.red, 'center', 'middle');
    ctx.restore();
  }

  function drawPaused(ctx, state, time) {
    drawPlay(ctx, state, time);
    dimPage(ctx, 0.55);
    const pw = 460, ph = 246;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    panel(ctx, px, py, pw, ph, '#fffaf0');
    text('PAUSED', W / 2, py + 58, 'bold 40px ' + FONT_SERIF, PALETTE.ink, 'center', 'middle');
    text('Take a breath - the rush will wait.', W / 2, py + 96, 'italic 16px ' + FONT_SERIF, PALETTE.inkSoft, 'center', 'middle');
    const btn = { x: W / 2 - 120, y: py + 138, w: 240, h: 56 };
    drawButton(ctx, btn, 'resume  (P)', PALETTE.green, PALETTE.cream);
    HIT_LAYOUT.resumeButton = btn;
  }

  function drawOver(ctx, state, time) {
    drawPlay(ctx, state, time);
    dimPage(ctx, 0.6);
    const pw = 600, ph = 420;
    const px = (W - pw) / 2, py = 150;
    panel(ctx, px, py, pw, ph, '#fffaf0');

    const closed = state.lives <= 0;
    text(closed ? 'THE KITCHEN CLOSED' : 'SHIFT OVER', W / 2, py + 64, 'bold 38px ' + FONT_SERIF, PALETTE.redDeep, 'center', 'middle');
    text(closed ? 'too many plates went wrong' : 'you survived the lunch rush', W / 2, py + 100, 'italic 16px ' + FONT_SERIF, PALETTE.inkSoft, 'center', 'middle');

    ctx.save();
    const cx = W / 2;
    text('SCORE', cx, py + 146, 'bold 14px ' + FONT, PALETTE.inkSoft, 'center', 'middle');
    text(String(state.score), cx, py + 196, 'bold 60px ' + FONT_SERIF, PALETTE.goldDark, 'center', 'middle');

    const stats = [
      ['Dishes served', String(state.served)],
      ['Best combo', 'x' + state.bestCombo],
      ['Lives left', String(state.lives) + ' / ' + SHIFT.lives],
    ];
    for (let i = 0; i < stats.length; i += 1) {
      const sy = py + 250 + i * 28;
      text(stats[i][0], cx - 150, sy, '15px ' + FONT, PALETTE.inkSoft, 'left', 'middle');
      text(stats[i][1], cx + 150, sy, 'bold 17px ' + FONT, PALETTE.ink, 'right', 'middle');
    }
    ctx.restore();

    const btn = { x: W / 2 - 140, y: py + ph - 74, w: 280, h: 56 };
    drawButton(ctx, btn, 'Press R to play again', PALETTE.gold, '#6b4518');
    HIT_LAYOUT.restartButton = btn;

    if (time % 1 < 0.8) {
      const blink = 0.6 + 0.4 * Math.sin(time * 4);
      ctx.save();
      ctx.globalAlpha = blink;
      text('R play again   -   P pause', W / 2, py + ph + 22, '13px ' + FONT, 'rgba(255, 240, 210, 0.8)', 'center', 'middle');
      ctx.restore();
    }
  }

  return {
    resize,
    getLayout() {
      return HIT_LAYOUT;
    },
    draw(state, screen, time) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(canvas.width / W, canvas.height / H);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = PALETTE.page;
      ctx.fillRect(0, 0, W, H);
      if (screen === SCREEN_TITLE) drawTitle(ctx, state, time);
      else if (screen === SCREEN_PAUSED) drawPaused(ctx, state, time);
      else if (screen === SCREEN_OVER) drawOver(ctx, state, time);
      else drawPlay(ctx, state, time);
      ctx.restore();
    },
  };
}
