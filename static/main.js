const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: true });

const modeNameEl = document.getElementById("modeName");

const MODES = ["point", "line", "ring"]; // drawing modes
let modeIndex = 0;

const state = {
  dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
  w: 0, h: 0,
  particles: [],
  lastMouse: null,
  mouse: { x: 0, y: 0, vx: 0, vy: 0, speed: 0 },
  hue: 210,
  spawnCarry: 0,
};

// Resize canvas to match window size
function resize() {
  state.w = Math.floor(window.innerWidth);
  state.h = Math.floor(window.innerHeight);
  canvas.width = Math.floor(state.w * state.dpr);
  canvas.height = Math.floor(state.h * state.dpr);
  canvas.style.width = state.w + "px";
  canvas.style.height = state.h + "px";
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// Change drawing mode
function setMode(i) {
  modeIndex = (i + MODES.length) % MODES.length;
  const m = MODES[modeIndex];
  modeNameEl.textContent = m === "point" ? "Point" : (m === "line" ? "Line" : "Ring");
}

// Keyboard controls
window.addEventListener("keydown", (e) => {
  if (e.key === "1") setMode(0);
  if (e.key === "2") setMode(1);
  if (e.key === "3") setMode(2);
  if (e.code === "Space") setMode(modeIndex + 1);
});

// Handle mouse movement
function onMove(clientX, clientY) {
  const x = clientX;
  const y = clientY;

  if (state.lastMouse) {
    const dx = x - state.lastMouse.x;
    const dy = y - state.lastMouse.y;
    state.mouse.vx = dx;
    state.mouse.vy = dy;
    state.mouse.speed = Math.hypot(dx, dy);
  }

  state.mouse.x = x;
  state.mouse.y = y;
  state.lastMouse = { x, y };

  // Slightly shift color based on speed
  state.hue = (state.hue + 0.35 + state.mouse.speed * 0.01) % 360;

  // Generate particles along the movement path
  spawnAlongPath();
}

// Interpolate particles along movement distance
function spawnAlongPath() {
  if (!state.lastMouse) return;

  const { vx, vy, speed } = state.mouse;
  const dist = Math.max(1, speed);

  const step = 6; // lower = denser particles
  const count = dist / step;

  state.spawnCarry += count;
  const spawnN = Math.floor(state.spawnCarry);
  state.spawnCarry -= spawnN;

  if (spawnN <= 0) return;

  const x1 = state.mouse.x - vx;
  const y1 = state.mouse.y - vy;
  const x2 = state.mouse.x;
  const y2 = state.mouse.y;

  for (let i = 0; i < spawnN; i++) {
    const t = spawnN === 1 ? 1 : i / (spawnN - 1);
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    spawnParticle(x, y, speed);
  }
}

// Create a single particle
function spawnParticle(x, y, speed) {
  const angle = Math.random() * Math.PI * 2;

  // Faster speed = bigger particles + shorter life
  const base = 0.6 + Math.min(2.2, speed / 25);
  const life = 30 + Math.random() * 30 - base * 6;
  const size = 1.2 + Math.random() * 2.8 + base * 0.9;

  const v = (0.25 + Math.random() * 0.9) * base;
  const vx = Math.cos(angle) * v + state.mouse.vx * 0.03;
  const vy = Math.sin(angle) * v + state.mouse.vy * 0.03;

  state.particles.push({
    x, y,
    px: x, py: y, // previous frame position (used for line mode)
    vx, vy,
    life,
    maxLife: life,
    size,
    hue: (state.hue + (Math.random() * 18 - 9) + 360) % 360,
  });

  // Limit total particle count
  if (state.particles.length > 1200) {
    state.particles.splice(0, state.particles.length - 1200);
  }
}

// Mouse + touch support
window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY), { passive: true });
window.addEventListener("touchmove", (e) => {
  const t = e.touches[0];
  if (t) onMove(t.clientX, t.clientY);
}, { passive: true });

// Fade background to create trail effect
function fadeBackground() {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(7,10,18,0.12)"; // lower value = longer trails
  ctx.fillRect(0, 0, state.w, state.h);
}

// Draw a single particle
function drawParticle(p) {
  const t = Math.max(0, p.life / p.maxLife);
  const alpha = t * t; // smoother fade curve
  const s = p.size * (0.6 + (1 - t) * 0.8);

  ctx.globalCompositeOperation = "lighter";

  // glow layer
  ctx.beginPath();
  ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${alpha * 0.22})`;
  ctx.arc(p.x, p.y, s * 4.2, 0, Math.PI * 2);
  ctx.fill();

  const mode = MODES[modeIndex];

  if (mode === "point") {
    ctx.beginPath();
    ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, ${alpha})`;
    ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
    ctx.fill();
  } else if (mode === "ring") {
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${p.hue}, 95%, 72%, ${alpha})`;
    ctx.lineWidth = Math.max(1, s * 0.55);
    ctx.arc(p.x, p.y, s * 1.8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mode === "line") {
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${p.hue}, 95%, 72%, ${alpha})`;
    ctx.lineWidth = Math.max(1, s * 0.7);
    ctx.lineCap = "round";
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
}

// Main animation loop
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(32, now - lastT);
  lastT = now;

  fadeBackground();

  const ps = state.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.px = p.x;
    p.py = p.y;

    const damp = 0.985;
    p.vx *= damp;
    p.vy *= damp;

    p.x += p.vx * (dt / 16.67);
    p.y += p.vy * (dt / 16.67);

    p.life -= (dt / 16.67);

    if (p.life <= 0) {
      ps.splice(i, 1);
      continue;
    }

    drawParticle(p);
  }

  requestAnimationFrame(tick);
}

// Initial background fill
ctx.fillStyle = "#070A12";
ctx.fillRect(0, 0, state.w, state.h);

setMode(0);
requestAnimationFrame(tick);