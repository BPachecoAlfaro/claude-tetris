'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

// ---- Skins ----
// Cada skin define su paleta (índices 1–7, 0 = null), colores de tablero/rejilla
// (null = usar las variables CSS del tema claro/oscuro) y su función de dibujo.
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlockRetro(context, px, py, s, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, s - 2, s - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, s - 2, Math.max(2, Math.round(s * 0.13)));
}

function drawBlockNeon(context, px, py, s, color) {
  const a = context.globalAlpha;
  context.save();
  context.shadowColor = color;
  context.shadowBlur = s * 0.45;
  context.fillStyle = color;
  context.globalAlpha = a * 0.25;
  context.fillRect(px + 2, py + 2, s - 4, s - 4);
  context.globalAlpha = a;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 2, py + 2, s - 4, s - 4);
  context.restore();
}

function drawBlockPastel(context, px, py, s, color) {
  const r = s * 0.28;
  roundRectPath(context, px + 1.5, py + 1.5, s - 3, s - 3, r);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(60,50,90,0.35)';
  context.lineWidth = 1.5;
  context.stroke();
  // brillo suave
  roundRectPath(context, px + s * 0.2, py + s * 0.16, s * 0.6, s * 0.18, s * 0.09);
  context.fillStyle = 'rgba(255,255,255,0.4)';
  context.fill();
}

function drawBlockPixel(context, px, py, s, color) {
  const n = 4;
  const inner = s - 2;
  const cell = inner / n;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, inner, inner);
  // textura: sub-cuadrados alternos claros/oscuros
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      context.fillStyle = (i + j) % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
      context.fillRect(px + 1 + j * cell, py + 1 + i * cell, cell, cell);
    }
  }
  // bisel: luz arriba/izquierda, sombra abajo/derecha
  const b = Math.max(2, Math.round(s * 0.1));
  context.fillStyle = 'rgba(255,255,255,0.55)';
  context.fillRect(px + 1, py + 1, inner, b);
  context.fillRect(px + 1, py + 1, b, inner);
  context.fillStyle = 'rgba(0,0,0,0.45)';
  context.fillRect(px + 1, py + 1 + inner - b, inner, b);
  context.fillRect(px + 1 + inner - b, py + 1, b, inner);
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    bg: null,
    grid: null,
    drawBlock: drawBlockRetro,
  },
  neon: {
    name: 'Neón',
    colors: [null, '#00f0ff', '#ffee00', '#d400ff', '#39ff14', '#ff1744', '#2979ff', '#ff9100'],
    bg: '#000000',
    grid: '#1b1b2b',
    drawBlock: drawBlockNeon,
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a8e6ef', '#fff1a8', '#d9b8f0', '#b5ead7', '#ffb3ba', '#b5c9f5', '#ffd3a5'],
    bg: null,
    grid: null,
    drawBlock: drawBlockPastel,
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#29b6f6', '#fbc02d', '#8e24aa', '#43a047', '#e53935', '#3949ab', '#fb8c00'],
    bg: null,
    grid: null,
    drawBlock: drawBlockPixel,
  },
};

let currentSkin = 'retro';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.globalAlpha = 1;
}

function clearCanvas(context, cv) {
  context.clearRect(0, 0, cv.width, cv.height);
  const bg = SKINS[currentSkin].bg;
  if (bg) {
    context.fillStyle = bg;
    context.fillRect(0, 0, cv.width, cv.height);
  }
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid || getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  clearCanvas(ctx, canvas);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  clearCanvas(nextCtx, nextCanvas);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

const themeBtn = document.getElementById('theme-toggle');

function themeLabel(theme) {
  return theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = themeLabel(theme);
  try { localStorage.setItem('theme', theme); } catch (e) {}
  // repintar el canvas (no se actualiza solo en pausa o game over)
  if (board && current) draw();
}

themeBtn.addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  applyTheme(isLight ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space active el botón durante el juego
});
themeBtn.textContent = themeLabel(document.documentElement.getAttribute('data-theme'));

// ---- Selector de skin ----
const skinSelect = document.getElementById('skin-select');

function applySkin(name) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, name)) name = 'retro';
  currentSkin = name;
  document.documentElement.setAttribute('data-skin', name);
  skinSelect.value = name;
  try { localStorage.setItem('skin', name); } catch (e) {}
  // repintar (no se actualiza solo en pausa o game over)
  if (board && current) draw();
  if (next) drawNext();
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // devuelve el control del teclado al juego
});
// evita que teclas del juego (flechas, Espacio, P, X) cambien el skin con el select enfocado
skinSelect.addEventListener('keydown', e => {
  if (e.key !== 'Tab' && e.key !== 'Enter' && e.key !== 'Escape') e.preventDefault();
});

(function () {
  let saved = null;
  try { saved = localStorage.getItem('skin'); } catch (e) {}
  currentSkin = Object.prototype.hasOwnProperty.call(SKINS, saved) ? saved : 'retro';
  document.documentElement.setAttribute('data-skin', currentSkin);
  skinSelect.value = currentSkin;
})();

init();
