const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let stars = [];
let comets = [];
let nextComet = 200;

let ships = [];
let nextShip = 60;
let rafId;
const TARGET_MS = 1000 / 30;
let lastTime = -1000;

const SHIP_W = 7;
// [col, row, colorType]  0=hull  1=cockpit  2=engine
const SHIP_SPRITE = [
  [3,0,0],
  [1,1,0],[2,1,0],[3,1,0],[4,1,0],[5,1,0],
  [0,2,2],[1,2,2],[2,2,0],[3,2,1],[4,2,0],[5,2,0],[6,2,0],
  [1,3,0],[2,3,0],[3,3,0],[4,3,0],[5,3,0],
  [3,4,0],
];
const SHIP_COLORS = [
  { hull: [130, 160, 200], cockpit: [100, 210, 255] },
  { hull: [140, 200, 140], cockpit: [100, 255, 130] },
  { hull: [200, 140, 160], cockpit: [255, 120, 180] },
  { hull: [200, 180, 120], cockpit: [255, 220, 60]  },
];

let starLayer = null;

function buildStarLayer() {
  starLayer = makeOffscreen(canvas.width, canvas.height);
  const slctx = starLayer.getContext('2d');
  for (const s of stars) {
    slctx.fillStyle = `rgba(255,255,255,${s.opacity.toFixed(2)})`;
    slctx.fillRect(s.x, s.y, s.size, s.size);
  }
}

const spriteCache = {};

function makeOffscreen(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function buildSpriteCache() {
  for (let cs = 0; cs < SHIP_COLORS.length; cs++) {
    const { hull, cockpit } = SHIP_COLORS[cs];
    for (const goRight of [true, false]) {
      for (const scale of [2, 3]) {
        const oc = makeOffscreen(SHIP_W * scale, 5 * scale);
        const octx = oc.getContext('2d');
        for (const [col, row, type] of SHIP_SPRITE) {
          const dc = goRight ? col : (SHIP_W - 1 - col);
          const [r, g, b] = type === 0 ? hull : type === 1 ? cockpit : [255, 140, 20];
          octx.fillStyle = `rgb(${r},${g},${b})`;
          octx.fillRect(dc * scale, row * scale, scale, scale);
        }
        spriteCache[`generic_${cs}_${goRight}_${scale}`] = oc;
      }
    }
  }

}

function initStars() {
  stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.floor(Math.random() * canvas.width),
      y: Math.floor(Math.random() * canvas.height),
      size: Math.random() < 0.85 ? 2 : 3,
      opacity: 0.4 + Math.random() * 0.6,
      blinkCooldown: Math.floor(Math.random() * 400),
      blinkFrame: -1,
      blinkLen: 25 + Math.floor(Math.random() * 35),
    });
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars();
  buildStarLayer();
}
window.addEventListener('resize', resize);
resize();

function spawnComet() {
  const fromTop = Math.random() < 0.6;
  const speed = 4 + Math.random() * 3;
  const angle = (Math.PI / 8) + Math.random() * (Math.PI / 5);
  let x, y, dx, dy;

  if (fromTop) {
    x = Math.random() * canvas.width * 0.8;
    y = -10;
    dx = Math.cos(angle) * speed;
    dy = Math.sin(angle) * speed;
  } else {
    x = -10;
    y = Math.random() * canvas.height * 0.5;
    dx = Math.cos(angle) * speed;
    dy = Math.sin(angle) * speed;
  }

  comets.push({
    x, y, dx, dy,
    trail: [],
    maxTrail: 18 + Math.floor(Math.random() * 14),
  });
}

function spawnShip() {
  const goRight = Math.random() < 0.5;
  const scale = Math.random() < 0.4 ? 2 : 3;
  const y = 20 + Math.random() * (canvas.height * 0.8 - 20);
  const colorScheme = Math.floor(Math.random() * SHIP_COLORS.length);
  ships.push({
    x: goRight ? -(SHIP_W * scale + 20) : canvas.width + 20,
    y,
    dx: goRight ? 1 + Math.random() * 1.5 : -(1 + Math.random() * 1.5),
    dy: (Math.random() - 0.5) * 0.3,
    goRight,
    scale,
    colorScheme,
    frame: 0,
  });
}

function drawShip(ship) {
  const { x, y, goRight, scale, colorScheme, frame } = ship;

  ctx.drawImage(spriteCache[`generic_${colorScheme}_${goRight}_${scale}`], Math.floor(x), Math.floor(y));

  const ex0 = goRight ? Math.floor(x) : Math.floor(x) + (SHIP_W - 1) * scale;
  const ey = Math.floor(y) + 2 * scale;
  const dir = goRight ? -1 : 1;
  const len = 5 + Math.floor(Math.abs(Math.sin(frame * 0.35)) * 4);

  for (let i = 0; i < len; i++) {
    const t = i / len;
    let g, b, a;
    if (t < 0.3)      { g = 240; b = 120; a = 1.0; }
    else if (t < 0.6) { g = 130; b = 20;  a = 0.85 - t; }
    else              { g = 50;  b = 10;  a = 0.4 - t * 0.4; }
    if (a <= 0.01) continue;
    const ex = ex0 + dir * (i + 1) * scale;
    ctx.fillStyle = `rgba(255,${g},${b},${a.toFixed(2)})`;
    ctx.fillRect(ex, ey, scale, scale);
    if (i < 3) {
      ctx.fillStyle = `rgba(255,${g},${b},${(a * 0.25).toFixed(2)})`;
      ctx.fillRect(ex - scale, ey - scale, scale * 3, scale * 3);
    }
  }
}


function drawFrame(now) {
  rafId = requestAnimationFrame(drawFrame);
  if (now - lastTime < TARGET_MS) return;
  lastTime = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Stars: blit pre-rendered layer, then overdraw only the blinking ones
  ctx.drawImage(starLayer, 0, 0);
  for (const s of stars) {
    if (s.blinkCooldown > 0) { s.blinkCooldown--; continue; }
    if (s.blinkFrame === -1) s.blinkFrame = 0;

    const half = s.blinkLen / 2;
    const op = s.blinkFrame < half
      ? s.opacity * (1 - s.blinkFrame / half)
      : s.opacity * ((s.blinkFrame - half) / half);

    s.blinkFrame++;
    if (s.blinkFrame >= s.blinkLen) {
      s.blinkFrame = -1;
      s.blinkCooldown = 200 + Math.floor(Math.random() * 400);
      continue;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(s.x, s.y, s.size, s.size);
    ctx.fillStyle = `rgba(255,255,255,${op.toFixed(2)})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }

  // Comet spawning
  if (--nextComet <= 0) {
    spawnComet();
    nextComet = 180 + Math.floor(Math.random() * 220);
  }

  // Comets
  for (let i = comets.length - 1; i >= 0; i--) {
    const c = comets[i];
    c.trail.unshift([Math.floor(c.x), Math.floor(c.y)]);
    if (c.trail.length > c.maxTrail) c.trail.pop();

    for (let j = 0; j < c.trail.length; j++) {
      const [tx, ty] = c.trail[j];
      const t = j / c.maxTrail;
      let r, g, b, a;

      if (j === 0) {
        r = 225; g = 240; b = 255; a = 1.0;
      } else if (t < 0.25) {
        r = 180; g = 210; b = 255; a = 1.0 - t * 1.5;
      } else if (t < 0.55) {
        const tt = (t - 0.25) / 0.3;
        r = 180 + Math.floor(75 * tt);
        g = Math.floor(180 * (1 - tt));
        b = Math.floor(255 * (1 - tt));
        a = 0.75 - t * 0.6;
      } else {
        const tt = (t - 0.55) / 0.45;
        r = 220; g = 40; b = 40;
        a = (1 - tt) * 0.35;
      }

      if (a <= 0.01) continue;
      ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(2)})`;
      const sz = j === 0 ? 4 : t < 0.4 ? 3 : 2;
      ctx.fillRect(tx, ty, sz, sz);
    }

    c.x += c.dx;
    c.y += c.dy;

    if (c.x > canvas.width + 60 || c.y > canvas.height + 60 || c.x < -60) {
      comets.splice(i, 1);
    }
  }

  // Ship spawning
  if (--nextShip <= 0) {
    spawnShip();
    nextShip = 400 + Math.floor(Math.random() * 600);
  }

  // Ships
  for (let i = ships.length - 1; i >= 0; i--) {
    const s = ships[i];
    drawShip(s);
    s.x += s.dx;
    s.y += s.dy;
    s.frame++;
    const margin = SHIP_W * s.scale * 2 + 30;
    if (s.x > canvas.width + margin || s.x < -margin) {
      ships.splice(i, 1);
    }
  }

}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
  } else {
    rafId = requestAnimationFrame(drawFrame);
  }
});

buildSpriteCache();
rafId = requestAnimationFrame(drawFrame);
