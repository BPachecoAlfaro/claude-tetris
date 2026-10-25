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
let started = false, combo = 0, maxCombo = 0;

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
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
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
  showGameOverRecords();
}

function togglePause() {
  if (gameOver || !started) return;
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
  started = true;
  combo = 0;
  maxCombo = 0;
  startScreen.classList.add('hidden');
  gameoverRecords.classList.add('hidden');
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
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  if (!started) return;
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

restartBtn.addEventListener('click', () => { restartBtn.blur(); init(); });

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

// ---- Tabla de records ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const startScreen = document.getElementById('start-screen');
const startRecords = document.getElementById('start-records');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverRecordsTable = document.getElementById('gameover-records-table');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const newRecordMsg = document.getElementById('new-record-msg');

function loadRecords() {
  const data = { records: [], bestCombo: 0, maxLines: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.records)) {
        data.records = raw.records
          .filter(r => r && typeof r === 'object' && Number.isFinite(r.score))
          .map(r => ({
            name: String(r.name ?? '').slice(0, 12),
            score: r.score,
            lines: Number.isFinite(r.lines) ? r.lines : 0,
            combo: Number.isFinite(r.combo) ? r.combo : 0,
            date: typeof r.date === 'string' ? r.date : '',
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_RECORDS);
      }
      if (Number.isFinite(raw.bestCombo)) data.bestCombo = raw.bestCombo;
      if (Number.isFinite(raw.maxLines)) data.maxLines = raw.maxLines;
    }
  } catch (e) {}
  return data;
}

function saveRecords(data) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(data)); } catch (e) {}
}

function qualifies(data, s) {
  if (s <= 0) return false;
  return data.records.length < MAX_RECORDS || s > data.records[data.records.length - 1].score;
}

function renderRecords(container, data, highlightEntry) {
  container.textContent = '';
  const title = document.createElement('p');
  title.className = 'records-title';
  title.textContent = 'MEJORES PUNTUACIONES';
  container.appendChild(title);

  if (!data.records.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Aún no hay records';
    container.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'records-table';
    const head = table.createTHead().insertRow();
    ['#', 'Nombre', 'Puntos', 'Líneas'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    });
    const body = table.createTBody();
    data.records.forEach((rec, i) => {
      const tr = body.insertRow();
      if (rec === highlightEntry) tr.className = 'highlight';
      [i + 1, rec.name || 'Anónimo', rec.score.toLocaleString(), rec.lines].forEach(v => {
        tr.insertCell().textContent = v;
      });
    });
    container.appendChild(table);
  }

  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${data.bestCombo} · Líneas máximas: ${data.maxLines}`;
  container.appendChild(stats);
}

function showStartScreen() {
  renderRecords(startRecords, loadRecords(), null);
  startScreen.classList.remove('hidden');
}

function showGameOverRecords() {
  const data = loadRecords();
  if (maxCombo > data.bestCombo) data.bestCombo = maxCombo;
  if (lines > data.maxLines) data.maxLines = lines;
  saveRecords(data);
  gameoverRecords.classList.remove('hidden');
  renderRecords(gameoverRecordsTable, data, null);
  if (qualifies(data, score)) {
    nameForm.classList.remove('hidden');
    newRecordMsg.textContent = '¡Nuevo record! Escribe tu nombre';
    nameInput.value = '';
    nameInput.focus();
  } else {
    nameForm.classList.add('hidden');
    newRecordMsg.textContent = '';
  }
}

function submitName() {
  if (!gameOver || nameForm.classList.contains('hidden')) return;
  const data = loadRecords();
  if (!qualifies(data, score)) { nameForm.classList.add('hidden'); return; }
  const entry = {
    name: nameInput.value.trim().slice(0, 12) || 'Anónimo',
    score, lines, combo: maxCombo,
    date: new Date().toISOString(),
  };
  // inserta después de los empates (el más antiguo queda arriba)
  let idx = data.records.findIndex(r => r.score < entry.score);
  if (idx === -1) idx = data.records.length;
  data.records.splice(idx, 0, entry);
  data.records = data.records.slice(0, MAX_RECORDS);
  saveRecords(data);
  nameForm.classList.add('hidden');
  newRecordMsg.textContent = '¡Record guardado!';
  renderRecords(gameoverRecordsTable, data, entry);
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  if (gameOver) showGameOverRecords();
  renderRecords(startRecords, loadRecords(), null);
  document.activeElement && document.activeElement.blur();
}

saveNameBtn.addEventListener('click', submitName);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); submitName(); }
});
document.getElementById('play-btn').addEventListener('click', e => { e.currentTarget.blur(); init(); });
document.getElementById('start-reset-btn').addEventListener('click', resetRecords);
document.getElementById('gameover-reset-btn').addEventListener('click', resetRecords);

showStartScreen();
