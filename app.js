'use strict';

// ════════════════════════════════════════════════════════════════
//  Constants
// ════════════════════════════════════════════════════════════════
const GRID      = 20;   // pixels per grid cell
const UNIT_W    = 32;   // AC-unit icon width  (px)
const UNIT_H    = 22;   // AC-unit icon height (px)
const WALL_T    = 10;   // wall stroke thickness
const WALL_FACE = 2;    // black face width on each side of wall (px)
const PIPE_T    = 2.5;  // pipe stroke thickness
const HIT_R     = 10;   // hit-test radius (px)
const SNAP_R    = 8;    // snap-to-unit radius (px)
const WALL_SNAP_R    = 35; // max distance (px) to snap AC units / pipe points to a wall
const RESIZE_HANDLE_R = 8; // hit radius for room resize handles (px)

// Colours for up to 3 independent traces / indoor units
const PIPE_COLORS    = ['#E91E63', '#FF9800', '#9C27B0']; // magenta · orange · purple
const PIPE_DARK      = ['#880E4F', '#E65100', '#4A148C'];
const INDOOR_COLORS  = ['#1976D2', '#F57C00', '#7B1FA2'];
const INDOOR_DARK    = ['#0D47A1', '#BF360C', '#4A148C'];

// ════════════════════════════════════════════════════════════════
//  Pre-configured templates  (coordinates in grid cells)
// ════════════════════════════════════════════════════════════════
const TEMPLATES = {
  studio: {
    name: 'Monolocale',
    rooms: [
      { gx:2,  gy:2,  gw:20, gh:14, label:'Soggiorno / Camera', color:'#f5f5f0' },
      { gx:2,  gy:16, gw:8,  gh:7,  label:'Bagno',              color:'#ddeeff' },
      { gx:10, gy:16, gw:12, gh:7,  label:'Cucina',             color:'#fff8e1' },
    ]
  },
  bilocale: {
    name: 'Bilocale',
    rooms: [
      { gx:2,  gy:2,  gw:18, gh:14, label:'Soggiorno',  color:'#f5f5f0' },
      { gx:20, gy:2,  gw:10, gh:14, label:'Cucina',     color:'#fff8e1' },
      { gx:2,  gy:16, gw:16, gh:12, label:'Camera',     color:'#f0f0fa' },
      { gx:18, gy:16, gw:12, gh:7,  label:'Bagno',      color:'#ddeeff' },
      { gx:18, gy:23, gw:12, gh:5,  label:'Corridoio',  color:'#f0f0ea' },
    ]
  },
  trilocale: {
    name: 'Trilocale',
    rooms: [
      { gx:2,  gy:2,  gw:22, gh:14, label:'Soggiorno',  color:'#f5f5f0' },
      { gx:24, gy:2,  gw:12, gh:14, label:'Cucina',     color:'#fff8e1' },
      { gx:36, gy:2,  gw:6,  gh:14, label:'Corridoio',  color:'#f0f0ea' },
      { gx:2,  gy:16, gw:16, gh:12, label:'Camera 1',   color:'#f0f0fa' },
      { gx:18, gy:16, gw:12, gh:12, label:'Camera 2',   color:'#f0faf0' },
      { gx:30, gy:16, gw:6,  gh:7,  label:'Bagno',      color:'#ddeeff' },
      { gx:30, gy:23, gw:6,  gh:5,  label:'WC',         color:'#dde8ff' },
      { gx:36, gy:16, gw:6,  gh:12, label:'Antibagno',  color:'#f0f0ea' },
    ]
  },
  quadrilocale: {
    name: 'Quadrilocale',
    rooms: [
      { gx:2,  gy:2,  gw:20, gh:14, label:'Soggiorno',  color:'#f5f5f0' },
      { gx:22, gy:2,  gw:14, gh:14, label:'Cucina',     color:'#fff8e1' },
      { gx:36, gy:2,  gw:8,  gh:14, label:'Corridoio',  color:'#f0f0ea' },
      { gx:2,  gy:16, gw:16, gh:12, label:'Camera 1',   color:'#f0f0fa' },
      { gx:18, gy:16, gw:12, gh:12, label:'Camera 2',   color:'#f0faf0' },
      { gx:30, gy:16, gw:14, gh:12, label:'Camera 3',   color:'#faf0f0' },
      { gx:36, gy:16, gw:8,  gh:6,  label:'Bagno',      color:'#ddeeff' },
      { gx:36, gy:22, gw:8,  gh:6,  label:'WC',         color:'#dde8ff' },
    ]
  }
};

// ════════════════════════════════════════════════════════════════
//  Application state
// ════════════════════════════════════════════════════════════════
const app = {
  canvas: null,
  ctx:    null,

  // Floor-plan data
  rooms:       [],   // { x, y, w, h, label, color }  pixels
  manualWalls: [],   // { x1, y1, x2, y2 }             pixels

  // AC units
  indoorUnits: [null], // [{ x, y, angle }, ...]  one per split (up to 3)
  outdoorUnit: null,   // { x, y, angle }

  // Completed pipe paths (one array per split)
  pipes:   [[]],   // [[{ x, y }], ...]

  // Pipe being drawn (in-progress) – always for the active split
  pipeWIP: [],       // [{ x, y }]

  // Split / multi-trace state
  splitType:     1,  // 1=single, 2=dual, 3=trial
  activePipeIdx: 0,  // which pipe/indoor-unit slot is active (0-2)

  // Drawing state
  tool:       'select',
  drawStart:  null,  // for drawRoom  (snapped {x,y})
  wallStart:  null,  // for drawWall  (snapped {x,y})

  // Select / drag state
  dragTarget: null,  // { type, index?, ox, oy }
  dragging:   false,

  // Scale
  metersPerCell: 0.5,

  // Mouse position (raw pixels)
  mouse: { x: 0, y: 0 },

  // Undo history  (array of JSON snapshots)
  history: [],
};

// ════════════════════════════════════════════════════════════════
//  Initialisation
// ════════════════════════════════════════════════════════════════
function init() {
  app.canvas = document.getElementById('main-canvas');
  app.ctx    = app.canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Canvas events
  app.canvas.addEventListener('mousedown',   onMouseDown);
  app.canvas.addEventListener('mousemove',   onMouseMove);
  app.canvas.addEventListener('mouseup',     onMouseUp);
  app.canvas.addEventListener('dblclick',    onDblClick);
  app.canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', onKeyDown);

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn =>
    btn.addEventListener('click', () => selectTool(btn.dataset.tool))
  );

  // Template buttons
  document.querySelectorAll('.tpl-btn').forEach(btn =>
    btn.addEventListener('click', () => loadTemplate(btn.dataset.template))
  );

  // Action buttons
  document.getElementById('complete-pipe-btn')
    .addEventListener('click', completePipe);
  document.getElementById('undo-btn')
    .addEventListener('click', undo);
  document.getElementById('clear-pipe-btn')
    .addEventListener('click', clearPipe);
  document.getElementById('clear-all-btn')
    .addEventListener('click', clearAll);

  // Split-configuration buttons
  document.querySelectorAll('.split-btn').forEach(btn =>
    btn.addEventListener('click', () => setSplitType(parseInt(btn.dataset.split)))
  );

  // Scale input
  document.getElementById('scale-input')
    .addEventListener('change', e => {
      app.metersPerCell = Math.max(0.1, parseFloat(e.target.value) || 0.5);
      updateResults();
      render();
    });

  // Load default template
  loadTemplate('bilocale');
  updateSplitUI();
  updateHint();
}

// ════════════════════════════════════════════════════════════════
//  Canvas resize
// ════════════════════════════════════════════════════════════════
function resizeCanvas() {
  const wrapper = document.getElementById('canvas-wrapper');
  app.canvas.width  = wrapper.clientWidth;
  app.canvas.height = wrapper.clientHeight - 24; // minus status bar
  render();
}

// ════════════════════════════════════════════════════════════════
//  Coordinate helpers
// ════════════════════════════════════════════════════════════════
function getPos(e) {
  const r = app.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function snap(x, y) {
  return {
    x: Math.round(x / GRID) * GRID,
    y: Math.round(y / GRID) * GRID
  };
}

/** Force end to be horizontal or vertical relative to start (orthogonal walls). */
function orthogonalize(start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: end.x, y: start.y };
  }
  return { x: start.x, y: end.y };
}

// ════════════════════════════════════════════════════════════════
//  Template loading
// ════════════════════════════════════════════════════════════════
function loadTemplate(name) {
  const tpl = TEMPLATES[name];
  if (!tpl) return;
  saveHistory();

  app.rooms = tpl.rooms.map(r => ({
    x: r.gx * GRID,
    y: r.gy * GRID,
    w: r.gw * GRID,
    h: r.gh * GRID,
    label: r.label,
    color: r.color,
  }));
  app.manualWalls  = [];
  app.indoorUnits  = [null];
  app.outdoorUnit  = null;
  app.pipes        = [[]];
  app.pipeWIP      = [];
  app.splitType    = 1;
  app.activePipeIdx = 0;

  render();
  updateResults();
  updateSplitUI();
  setStatus(`Template "${tpl.name}" caricato. Posiziona split interno (❄) e unità esterna (🌡).`);
}

// ════════════════════════════════════════════════════════════════
//  Wall helpers
// ════════════════════════════════════════════════════════════════
function wallsEqual(a, b) {
  return (a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2) ||
         (a.x1 === b.x2 && a.y1 === b.y2 && a.x2 === b.x1 && a.y2 === b.y1);
}

/** Extract unique wall segments from room rectangles. */
function roomWalls(rooms) {
  const walls = [];
  for (const r of rooms) {
    const { x, y, w, h } = r;
    const edges = [
      { x1: x,   y1: y,   x2: x+w, y2: y   },
      { x1: x+w, y1: y,   x2: x+w, y2: y+h },
      { x1: x+w, y1: y+h, x2: x,   y2: y+h },
      { x1: x,   y1: y+h, x2: x,   y2: y   },
    ];
    for (const e of edges) {
      if (!walls.some(w2 => wallsEqual(w2, e))) walls.push(e);
    }
  }
  return walls;
}

function allWalls() {
  return [...roomWalls(app.rooms), ...app.manualWalls];
}

// ════════════════════════════════════════════════════════════════
//  Geometry
// ════════════════════════════════════════════════════════════════
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function ptNearSeg(px, py, x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return dist(px, py, x1, y1) <= r;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return dist(px, py, x1 + t * dx, y1 + t * dy) <= r;
}

/**
 * Returns true if segment A and segment B properly intersect
 * (endpoints touching are NOT counted as intersections).
 */
function segsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const dx1 = ax2 - ax1, dy1 = ay2 - ay1;
  const dx2 = bx2 - bx1, dy2 = by2 - by1;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return false; // parallel / collinear
  const ex = bx1 - ax1, ey = by1 - ay1;
  const t = (ex * dy2 - ey * dx2) / denom;
  const u = (ex * dy1 - ey * dx1) / denom;
  const EPS = 1e-9;
  return t >= EPS && t <= 1 - EPS && u >= EPS && u <= 1 - EPS;
}

/** Closest point on segment (x1,y1)-(x2,y2) to point (px,py). Returns {x,y,d}. */
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) {
    const d = dist(px, py, x1, y1);
    return { x: x1, y: y1, d };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return { x: cx, y: cy, d: dist(px, py, cx, cy) };
}

/** Find the nearest wall segment to a point. Returns {proj, wall, d} or null. */
function findNearestWall(pt) {
  const walls = allWalls();
  let best = null;
  for (const w of walls) {
    const res = closestPointOnSegment(pt.x, pt.y, w.x1, w.y1, w.x2, w.y2);
    if (!best || res.d < best.d) {
      best = { proj: { x: res.x, y: res.y }, wall: w, d: res.d };
    }
  }
  return best;
}

/**
 * Snap an AC unit position to the nearest wall within WALL_SNAP_R.
 * Returns {x, y, angle} or null if no wall is close enough.
 * - The along-wall coordinate is snapped to the grid for clean placement.
 * - The perpendicular coordinate is set to exactly UNIT_H/2 + WALL_T + 1 px
 *   from the wall centre, so the unit never overlaps the wall regardless of
 *   whether the wall sits on a grid line.
 * - angle is the wall direction angle; callers should rotate the unit box by
 *   this angle so its narrow dimension always faces the wall.
 */
function snapUnitToWall(rawPt) {
  const nearest = findNearestWall(rawPt);
  if (!nearest || nearest.d > WALL_SNAP_R) return null;

  const { wall } = nearest;
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1e-10) {
    return { ...snap(nearest.proj.x, nearest.proj.y), angle: 0 };
  }

  // Wall direction angle (for rotating the unit to align with the wall)
  const angle = Math.atan2(dy, dx);

  // Perpendicular unit normal (90° CCW from wall direction)
  const nx = -dy / len, ny = dx / len;

  // Which side of the wall is the cursor on?
  const side = (rawPt.x - wall.x1) * nx + (rawPt.y - wall.y1) * ny;
  const sign = side >= 0 ? 1 : -1;

  // Snap the projection along the wall to the grid first, then add the exact
  // perpendicular offset so the unit cannot overlap the wall after rounding.
  // UNIT_H is the unit's narrow ("depth") dimension when it is rotated to face the wall.
  const snappedProj = snap(nearest.proj.x, nearest.proj.y);
  const perpOffset  = UNIT_H / 2 + WALL_T / 2 + 2; // safe gap: half-depth + half-wall + 2 px

  return {
    x: snappedProj.x + sign * nx * perpOffset,
    y: snappedProj.y + sign * ny * perpOffset,
    angle,
  };
}

/**
 * Snap a pipe point to the face of the nearest wall within WALL_SNAP_R.
 * Returns {x, y} snapped to the wall surface nearest to rawPt, or null if
 * no wall is within range (allowing free placement unlike AC-unit snapping).
 */
function snapPipeToWall(rawPt) {
  const nearest = findNearestWall(rawPt);
  if (!nearest || nearest.d > WALL_SNAP_R) return null;

  const { wall } = nearest;
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1e-10) {
    return snap(nearest.proj.x, nearest.proj.y);
  }

  // Perpendicular unit normal (90° CCW from wall direction)
  const nx = -dy / len, ny = dx / len;

  // Which side of the wall is the cursor on?
  const sideDot = (rawPt.x - wall.x1) * nx + (rawPt.y - wall.y1) * ny;
  const sign = sideDot >= 0 ? 1 : -1;

  // Use the exact projection point (no grid snap along the wall) so the node
  // lands precisely where the cursor projects onto the wall face.
  const faceOffset = WALL_T / 2;

  return {
    x: nearest.proj.x + sign * nx * faceOffset,
    y: nearest.proj.y + sign * ny * faceOffset,
  };
}

// ════════════════════════════════════════════════════════════════
//  Calculations
// ════════════════════════════════════════════════════════════════
/** Returns an array of {meters, crossings} for each active split (null if no pipe). */
function calculateResults() {
  const results = [];
  const walls = allWalls();

  for (let i = 0; i < app.splitType; i++) {
    const pipe = app.pipes[i] || [];
    if (pipe.length < 2) { results.push(null); continue; }

    // Length
    let px = 0;
    for (let j = 1; j < pipe.length; j++)
      px += dist(pipe[j-1].x, pipe[j-1].y, pipe[j].x, pipe[j].y);
    const meters = (px / GRID) * app.metersPerCell;

    // Wall crossings
    let crossings = 0;
    for (let j = 1; j < pipe.length; j++) {
      const { x: ax1, y: ay1 } = pipe[j-1];
      const { x: ax2, y: ay2 } = pipe[j];
      for (const w of walls) {
        if (segsIntersect(ax1, ay1, ax2, ay2, w.x1, w.y1, w.x2, w.y2))
          crossings++;
      }
    }
    results.push({ meters, crossings });
  }
  return results;
}

function complexityLabel(crossingCount) {
  if (crossingCount === 0) return { text: 'Semplice (stessa parete)', cls: 'complexity-simple' };
  if (crossingCount === 1) return { text: 'Standard (1 foratura)',   cls: 'complexity-standard' };
  if (crossingCount <= 3)  return { text: 'Media complessità',       cls: 'complexity-medium' };
  return                          { text: 'Alta complessità',         cls: 'complexity-high' };
}

function updateResults() {
  const results = calculateResults();
  const container = document.getElementById('results-per-trace');
  if (!container) return;

  container.innerHTML = '';
  let totalCrossings = 0;
  let hasAny = false;

  for (let i = 0; i < app.splitType; i++) {
    const r = results[i];
    const color = PIPE_COLORS[i];
    const row = document.createElement('div');
    row.className = 'res-row';
    if (r) {
      hasAny = true;
      totalCrossings += r.crossings;
      row.innerHTML =
        `<span class="res-lbl" style="color:${color};font-weight:700">T${i+1}:</span>` +
        `<span class="res-val">${r.meters.toFixed(1)} m &nbsp;|&nbsp; ${r.crossings} par.</span>`;
    } else {
      row.innerHTML =
        `<span class="res-lbl" style="color:${color};font-weight:700">T${i+1}:</span>` +
        `<span class="res-val" style="color:#aaa">—</span>`;
    }
    container.appendChild(row);
  }

  const complexityEl = document.getElementById('res-complexity');
  if (hasAny) {
    const c = complexityLabel(totalCrossings);
    complexityEl.textContent = c.text;
    complexityEl.className   = 'res-val ' + c.cls;
  } else {
    complexityEl.textContent = '—';
    complexityEl.className   = 'res-val';
  }
}

// ════════════════════════════════════════════════════════════════
//  Rendering
// ════════════════════════════════════════════════════════════════
function render() {
  const { ctx, canvas } = app;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawRooms();
  drawRoomWallLabels();
  drawManualWalls();
  drawPipe();
  drawAcUnits();
  drawInProgress();
  drawRoomResizeHandles();
  updateMousePos();
}

/* ── Grid ── */
function drawGrid() {
  const { ctx, canvas } = app;
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 0.5;
  for (let x = 0; x <= canvas.width; x += GRID) {
    ctx.strokeStyle = x % (GRID * 5) === 0 ? '#d0d0d0' : '#ebebeb';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += GRID) {
    ctx.strokeStyle = y % (GRID * 5) === 0 ? '#d0d0d0' : '#ebebeb';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

/* ── Rooms ── */
function drawRooms() {
  const ctx = app.ctx;
  for (const room of app.rooms) {
    // Fill room interior
    ctx.fillStyle = room.color || '#f5f5f0';
    ctx.fillRect(room.x, room.y, room.w, room.h);
    // Outer black border (both faces)
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth   = WALL_T;
    ctx.strokeRect(room.x, room.y, room.w, room.h);
    // White interior of wall (leaves WALL_FACE px black on each face)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = WALL_T - WALL_FACE * 2;
    ctx.strokeRect(room.x, room.y, room.w, room.h);
    // Label
    ctx.fillStyle    = '#555';
    ctx.font         = '11px Segoe UI, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    drawWrappedText(ctx, room.label, room.x + room.w / 2, room.y + room.h / 2,
                    room.w - 10, 14);
  }
}

function drawWrappedText(ctx, text, cx, cy, maxW, lh) {
  const words = text.split(/[\s/]+/);
  if (words.length <= 1 || ctx.measureText(text).width <= maxW) {
    ctx.fillText(text, cx, cy, maxW);
    return;
  }
  const mid = Math.ceil(words.length / 2);
  ctx.fillText(words.slice(0, mid).join(' '), cx, cy - lh / 2, maxW);
  ctx.fillText(words.slice(mid).join(' '),    cx, cy + lh / 2, maxW);
}

/* ── Manual walls ── */
function drawManualWalls() {
  const ctx = app.ctx;
  ctx.lineCap     = 'round';
  ctx.setLineDash([]);
  for (const w of app.manualWalls) {
    // Outer black faces
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth   = WALL_T;
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
    // White interior
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = WALL_T - WALL_FACE * 2;
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
    // Length label at midpoint
    const d = dist(w.x1, w.y1, w.x2, w.y2);
    const m = (d / GRID) * app.metersPerCell;
    drawWallLenLabel(ctx, m.toFixed(1) + ' m', (w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2);
  }
}

/* ── AC units ── */
function drawAcUnits() {
  const ctx = app.ctx;
  const hw = UNIT_W / 2, hh = UNIT_H / 2;

  // Draw all indoor units (one per active split slot)
  for (let i = 0; i < app.splitType; i++) {
    const unit = app.indoorUnits[i];
    if (!unit) continue;
    const { x, y, angle = 0 } = unit;
    const fill   = INDOOR_COLORS[i];
    const stroke = INDOOR_DARK[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawUnitBox(ctx, -hw, -hh, UNIT_W, UNIT_H, fill, stroke);
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 7px Segoe UI, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`❄ INT.${i + 1}`, 0, 0);
    ctx.restore();
  }

  if (app.outdoorUnit) {
    const { x, y, angle = 0 } = app.outdoorUnit;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawUnitBox(ctx, -hw, -hh, UNIT_W, UNIT_H, '#388E3C', '#1B5E20');
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 8px Segoe UI, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌡 U.EST.', 0, 0);
    ctx.restore();
  }
}

function drawUnitBox(ctx, x, y, w, h, fill, stroke) {
  ctx.shadowColor  = 'rgba(0,0,0,.25)';
  ctx.shadowBlur   = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle    = fill;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.shadowColor  = 'transparent';
  ctx.shadowBlur   = 0;
  ctx.shadowOffsetY = 0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y,         x + r, y);
    ctx.closePath();
  }
}

/* ── Completed pipes (all active splits) ── */
function drawPipe() {
  const ctx = app.ctx;

  for (let i = 0; i < app.splitType; i++) {
    const pts = app.pipes[i] || [];
    if (pts.length === 0) continue;

    const color     = PIPE_COLORS[i];
    const darkColor = PIPE_DARK[i];

    ctx.strokeStyle = color;
    ctx.lineWidth   = PIPE_T;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash([]);

    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
      ctx.stroke();

      // Per-segment distance labels
      for (let j = 1; j < pts.length; j++) {
        const d = dist(pts[j-1].x, pts[j-1].y, pts[j].x, pts[j].y);
        const m = (d / GRID) * app.metersPerCell;
        if (m >= 0.1) {
          const mx = (pts[j-1].x + pts[j].x) / 2;
          const my = (pts[j-1].y + pts[j].y) / 2;
          drawDistLabel(ctx, m.toFixed(1) + ' m', mx, my, darkColor);
        }
      }
    }

    // Waypoint dots
    for (const pt of pts) pipeDot(ctx, pt.x, pt.y, color);

    // Trace label badge at first waypoint
    drawTraceLabel(ctx, `T${i + 1}`, pts[0].x, pts[0].y, color);
  }
}

function pipeDot(ctx, x, y, color) {
  ctx.fillStyle = color || PIPE_COLORS[0];
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Small coloured badge label (T1 / T2 / T3) above the first waypoint. */
function drawTraceLabel(ctx, text, x, y, color) {
  ctx.font = 'bold 9px Segoe UI, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = color;
  roundRect(ctx, x - tw / 2 - 3, y - 16, tw + 6, 13, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y - 10);
}

function drawDistLabel(ctx, text, x, y, fgColor) {
  fgColor = fgColor || '#880E4F';
  ctx.font         = 'bold 9px Segoe UI, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(x - tw / 2 - 2, y - 7, tw + 4, 14);
  ctx.fillStyle = fgColor;
  ctx.fillText(text, x, y);
}

/** Draw a wall-length label (dark text, white background). */
function drawWallLenLabel(ctx, text, x, y) {
  ctx.font         = 'bold 9px Segoe UI, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.fillRect(x - tw / 2 - 2, y - 7, tw + 4, 14);
  ctx.fillStyle = '#444';
  ctx.fillText(text, x, y);
}

/** Draw length labels for all 4 sides of every room, offset outside the room. */
function drawRoomWallLabels() {
  const ctx = app.ctx;
  for (const room of app.rooms) {
    const sides = [
      { len: room.w, mx: room.x + room.w / 2,      my: room.y - 11          }, // top
      { len: room.h, mx: room.x + room.w + 11,      my: room.y + room.h / 2  }, // right
      { len: room.w, mx: room.x + room.w / 2,      my: room.y + room.h + 11 }, // bottom
      { len: room.h, mx: room.x - 11,               my: room.y + room.h / 2  }, // left
    ];
    for (const side of sides) {
      const m = (side.len / GRID) * app.metersPerCell;
      drawWallLenLabel(ctx, m.toFixed(1) + ' m', side.mx, side.my);
    }
  }
}

/* ── In-progress drawing overlays ── */
function drawInProgress() {
  const ctx = app.ctx;
  const m   = snap(app.mouse.x, app.mouse.y);

  // Room drag preview
  if (app.tool === 'drawRoom' && app.drawStart) {
    const s  = app.drawStart;
    const rx = Math.min(s.x, m.x), ry = Math.min(s.y, m.y);
    const rw = Math.abs(m.x - s.x), rh = Math.abs(m.y - s.y);
    if (rw > 0 && rh > 0) {
      ctx.fillStyle = 'rgba(245,245,240,.55)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#333';
      ctx.lineWidth   = WALL_T;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      // Dimensions
      const mw = (rw / GRID) * app.metersPerCell;
      const mh = (rh / GRID) * app.metersPerCell;
      ctx.fillStyle    = '#333';
      ctx.font         = '10px Segoe UI, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(mw.toFixed(1) + ' m', rx + rw / 2, ry - 3);
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(mh.toFixed(1) + ' m', rx - 3, ry + rh / 2);
    }
  }

  // Wall draw preview
  if (app.tool === 'drawWall' && app.wallStart) {
    const orthoEnd = orthogonalize(app.wallStart, m);
    ctx.strokeStyle = '#333';
    ctx.lineWidth   = WALL_T;
    ctx.lineCap     = 'round';
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(app.wallStart.x, app.wallStart.y);
    ctx.lineTo(orthoEnd.x, orthoEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
    snapDot(ctx, app.wallStart.x, app.wallStart.y);
    snapDot(ctx, orthoEnd.x, orthoEnd.y);
  }

  // Pipe WIP
  if (app.pipeWIP.length > 0) {
    const pts = app.pipeWIP;
    const color = PIPE_COLORS[app.activePipeIdx];
    ctx.strokeStyle = color;
    ctx.lineWidth   = PIPE_T;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    for (const pt of pts) pipeDot(ctx, pt.x, pt.y, color);

    // Ghost line to snapped cursor (wall-face snap > unit snap > grid snap)
    const pipeCursor = snapPipeToWall(app.mouse) || snapToUnit(m) || m;
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.lineTo(pipeCursor.x, pipeCursor.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Snap cursor dot for drawing tools
  if (app.tool === 'drawRoom' || app.tool === 'drawWall') {
    snapDot(ctx, m.x, m.y);
  } else if (app.tool === 'drawPipe') {
    const pipeCursor = snapPipeToWall(app.mouse) || snapToUnit(m) || m;
    snapDot(ctx, pipeCursor.x, pipeCursor.y);
  }

  // Ghost unit preview while hovering with placement tools
  if (app.tool === 'placeIndoor' || app.tool === 'placeOutdoor') {
    const ghost = snapUnitToWall(app.mouse);
    if (ghost) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.translate(ghost.x, ghost.y);
      ctx.rotate(ghost.angle);
      let fill, stroke;
      if (app.tool === 'placeIndoor') {
        fill   = INDOOR_COLORS[app.activePipeIdx];
        stroke = INDOOR_DARK[app.activePipeIdx];
      } else {
        fill   = '#388E3C';
        stroke = '#1B5E20';
      }
      drawUnitBox(ctx, -UNIT_W / 2, -UNIT_H / 2, UNIT_W, UNIT_H, fill, stroke);
      ctx.restore();
    }
  }
}

function snapDot(ctx, x, y) {
  ctx.strokeStyle = 'rgba(33,150,243,.8)';
  ctx.fillStyle   = 'rgba(33,150,243,.2)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Returns the four resize handle descriptors for a room. */
function roomResizeHandles(r) {
  return [
    { side: 'top',    x: r.x + r.w / 2, y: r.y,           icon: '↕', cursor: 'ns-resize' },
    { side: 'right',  x: r.x + r.w,     y: r.y + r.h / 2, icon: '↔', cursor: 'ew-resize' },
    { side: 'bottom', x: r.x + r.w / 2, y: r.y + r.h,     icon: '↕', cursor: 'ns-resize' },
    { side: 'left',   x: r.x,           y: r.y + r.h / 2, icon: '↔', cursor: 'ew-resize' },
  ];
}

/** Draw resize handles at the midpoint of each room wall (only in select mode). */
function drawRoomResizeHandles() {
  if (app.tool !== 'select') return;
  const ctx = app.ctx;
  const hw = 14, hh = 14;

  for (const room of app.rooms) {
    for (const h of roomResizeHandles(room)) {
      // Background square
      ctx.fillStyle   = 'rgba(21,101,192,0.85)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      roundRect(ctx, h.x - hw / 2, h.y - hh / 2, hw, hh, 3);
      ctx.fill();
      ctx.stroke();
      // Arrow icon
      ctx.fillStyle    = '#fff';
      ctx.font         = 'bold 11px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.icon, h.x, h.y);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  Mouse events
// ════════════════════════════════════════════════════════════════
function onMouseDown(e) {
  if (e.button !== 0) return;
  const raw = getPos(e);
  const s   = snap(raw.x, raw.y);

  switch (app.tool) {

    case 'select':
      startDrag(raw);
      break;

    case 'drawRoom':
      app.drawStart = s;
      break;

    case 'drawWall':
      if (!app.wallStart) {
        app.wallStart = s;
      } else {
        const orthoEnd = orthogonalize(app.wallStart, s);
        if (orthoEnd.x !== app.wallStart.x || orthoEnd.y !== app.wallStart.y) {
          saveHistory();
          app.manualWalls.push({ x1: app.wallStart.x, y1: app.wallStart.y,
                                  x2: orthoEnd.x,       y2: orthoEnd.y });
          updateResults();
        }
        app.wallStart = null;
      }
      render();
      break;

    case 'placeIndoor': {
      const wallSnap = snapUnitToWall(raw);
      if (!wallSnap) {
        setStatus('⚠ Avvicinati a una parete per posizionare lo split interno (❄).');
        break;
      }
      saveHistory();
      app.indoorUnits[app.activePipeIdx] = wallSnap;
      setStatus(`Split interno ${app.activePipeIdx + 1} posizionato. Posiziona ora l\'unità esterna.`);
      render();
      break;
    }

    case 'placeOutdoor': {
      const wallSnap = snapUnitToWall(raw);
      if (!wallSnap) {
        setStatus('⚠ Avvicinati a una parete per posizionare l\'unità esterna (🌡).');
        break;
      }
      saveHistory();
      app.outdoorUnit = wallSnap;
      setStatus('Unità esterna posizionata. Seleziona "Traccia" per disegnare il percorso.');
      render();
      break;
    }

    case 'drawPipe': {
      // Snap priority: wall face > AC unit > grid
      const wallSnap  = snapPipeToWall(raw);
      const snappedPt = wallSnap || snapToUnit(s) || s;
      const now = Date.now();
      const last = app._lastPipeClick;

      // Detect double-click: same snapped position within 400 ms → complete pipe
      if (app.pipeWIP.length >= 1 &&
          last && last.x === snappedPt.x && last.y === snappedPt.y &&
          now - last.time < 400) {
        app._lastPipeClick = null;
        if (app.pipeWIP.length >= 2) completePipe();
      } else {
        app._lastPipeClick = { time: now, x: snappedPt.x, y: snappedPt.y };
        app.pipeWIP.push({ ...snappedPt });
        syncCompletePipeBtn();
        render();
      }
      break;
    }
  }
}

function onMouseMove(e) {
  app.mouse = getPos(e);

  if (app.dragTarget) moveDrag(app.mouse);

  render();
  updateMousePos();

  // Update cursor
  if (app.tool === 'select') {
    updateSelectCursor(app.mouse);
  } else {
    app.canvas.style.cursor = '';  // fall back to CSS crosshair
  }
}

/** Update the canvas cursor while the select tool is active. */
function updateSelectCursor(pos) {
  // Keep resize cursor while actively dragging a resize handle
  if (app.dragTarget && app.dragTarget.type === 'roomResize') {
    const map = { top: 'ns-resize', bottom: 'ns-resize', left: 'ew-resize', right: 'ew-resize' };
    app.canvas.style.cursor = map[app.dragTarget.side] || 'default';
    return;
  }
  // Hover over resize handle
  for (const room of app.rooms) {
    for (const h of roomResizeHandles(room)) {
      if (dist(pos.x, pos.y, h.x, h.y) <= RESIZE_HANDLE_R + 4) {
        app.canvas.style.cursor = h.cursor;
        return;
      }
    }
  }
  app.canvas.style.cursor = 'default';
}

function onMouseUp(e) {
  if (e.button !== 0) return;

  // Finish room draw on mouse-up
  if (app.tool === 'drawRoom' && app.drawStart) {
    const s  = snap(getPos(e).x, getPos(e).y);
    const rx = Math.min(app.drawStart.x, s.x);
    const ry = Math.min(app.drawStart.y, s.y);
    const rw = Math.abs(s.x - app.drawStart.x);
    const rh = Math.abs(s.y - app.drawStart.y);
    if (rw >= GRID * 2 && rh >= GRID * 2) {
      saveHistory();
      app.rooms.push({ x: rx, y: ry, w: rw, h: rh, label: 'Stanza', color: '#f5f5f0' });
      updateResults();
    }
    app.drawStart = null;
    render();
  }

  if (app.dragTarget) {
    app.dragTarget = null;
    app.dragging   = false;
    updateResults();
    render();
  }
}

function onDblClick(e) {
  // Primary completion path is the timestamp detection in onMouseDown.
  // This is a fallback for the edge case where the second mousedown did NOT
  // trigger completion (e.g. the snap position changed slightly between clicks).
  // By the time dblclick fires both mousedowns have already run, so pipeWIP
  // may contain a duplicate last point that needs to be removed first.
  if (app.tool === 'drawPipe' && app.pipeWIP.length >= 2) {
    app.pipeWIP.pop(); // remove duplicate added by second mousedown
    if (app.pipeWIP.length >= 2) completePipe();
    return;
  }

  if (app.tool === 'select') {
    const raw = getPos(e);

    // Check manual walls first
    const wallIdx = manualWallAt(raw.x, raw.y);
    if (wallIdx >= 0) {
      editManualWallLength(wallIdx);
      return;
    }

    // Check room sides (precise border click → edit one dimension)
    const roomSide = roomSideAt(raw.x, raw.y);
    if (roomSide) {
      editRoomSideLength(roomSide.roomIndex, roomSide.side);
      return;
    }

    // Check room interior (click inside room → edit both dimensions)
    const roomIdx = roomAt(raw.x, raw.y);
    if (roomIdx >= 0) {
      editRoomDimensions(roomIdx);
    }
  }
}

/** Returns index of the manual wall under (px,py), or -1 if none. */
function manualWallAt(px, py) {
  for (let i = 0; i < app.manualWalls.length; i++) {
    const w = app.manualWalls[i];
    if (ptNearSeg(px, py, w.x1, w.y1, w.x2, w.y2, HIT_R)) return i;
  }
  return -1;
}

/** Returns {roomIndex, side} for the room side under (px,py), or null. */
function roomSideAt(px, py) {
  for (let i = 0; i < app.rooms.length; i++) {
    const r = app.rooms[i];
    const sides = [
      { side: 'top',    x1: r.x,       y1: r.y,       x2: r.x + r.w, y2: r.y       },
      { side: 'right',  x1: r.x + r.w, y1: r.y,       x2: r.x + r.w, y2: r.y + r.h },
      { side: 'bottom', x1: r.x,       y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h },
      { side: 'left',   x1: r.x,       y1: r.y,       x2: r.x,       y2: r.y + r.h },
    ];
    for (const s of sides) {
      if (ptNearSeg(px, py, s.x1, s.y1, s.x2, s.y2, HIT_R)) {
        return { roomIndex: i, side: s.side };
      }
    }
  }
  return null;
}

/** Returns index of room whose interior contains (px,py), or -1 if none. */
function roomAt(px, py) {
  for (let i = app.rooms.length - 1; i >= 0; i--) {
    const r = app.rooms[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

/** Prompt user for new length of a manual wall, resize symmetrically around centre. */
function editManualWallLength(wallIdx) {
  const w = app.manualWalls[wallIdx];
  const d = dist(w.x1, w.y1, w.x2, w.y2);
  const currentM = (d / GRID) * app.metersPerCell;
  const input = prompt(
    `Nuova lunghezza della parete (m):\n(attuale: ${currentM.toFixed(2)} m)`,
    currentM.toFixed(2)
  );
  if (input === null) return;
  const newM = parseFloat(input);
  if (!isFinite(newM) || newM <= 0) {
    alert('Valore non valido. Inserisci una lunghezza positiva in metri.');
    return;
  }
  const newPx = Math.max(GRID, Math.round(newM / app.metersPerCell) * GRID);

  // Direction unit vector
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = len > 0 ? dx / len : 1, uy = len > 0 ? dy / len : 0;

  // Centre stays fixed; extend symmetrically
  const cx = (w.x1 + w.x2) / 2, cy = (w.y1 + w.y2) / 2;
  saveHistory();
  app.manualWalls[wallIdx] = {
    x1: Math.round(cx - ux * newPx / 2),
    y1: Math.round(cy - uy * newPx / 2),
    x2: Math.round(cx + ux * newPx / 2),
    y2: Math.round(cy + uy * newPx / 2),
  };
  updateResults();
  render();
  setStatus(`Parete modificata: ${(newPx / GRID * app.metersPerCell).toFixed(2)} m`);
}

/**
 * Prompt user for new length of a room side, resize symmetrically
 * (centre of the room stays fixed; opposite side moves by the same amount).
 */
function editRoomSideLength(roomIdx, side) {
  const r = app.rooms[roomIdx];
  const isHoriz = side === 'top' || side === 'bottom';
  const currentLen = isHoriz ? r.w : r.h;
  const currentM   = (currentLen / GRID) * app.metersPerCell;

  const input = prompt(
    `Nuova lunghezza del lato (m):\n(attuale: ${currentM.toFixed(2)} m)`,
    currentM.toFixed(2)
  );
  if (input === null) return;
  const newM = parseFloat(input);
  if (!isFinite(newM) || newM <= 0) {
    alert('Valore non valido. Inserisci una lunghezza positiva in metri.');
    return;
  }
  const newPx = Math.max(GRID * 2, Math.round(newM / app.metersPerCell) * GRID);

  saveHistory();
  if (isHoriz) {
    const cx = r.x + r.w / 2;
    app.rooms[roomIdx].w = newPx;
    app.rooms[roomIdx].x = Math.round((cx - newPx / 2) / GRID) * GRID;
  } else {
    const cy = r.y + r.h / 2;
    app.rooms[roomIdx].h = newPx;
    app.rooms[roomIdx].y = Math.round((cy - newPx / 2) / GRID) * GRID;
  }
  updateResults();
  render();
  setStatus(`Lato stanza modificato: ${(newPx / GRID * app.metersPerCell).toFixed(2)} m`);
}

/**
 * Prompt user for new width and height of a room (centre stays fixed).
 */
function editRoomDimensions(roomIdx) {
  const r = app.rooms[roomIdx];
  const currentW = (r.w / GRID) * app.metersPerCell;
  const currentH = (r.h / GRID) * app.metersPerCell;

  const wInput = prompt(
    `Larghezza stanza "${r.label}" (m):\n(attuale: ${currentW.toFixed(2)} m)`,
    currentW.toFixed(2)
  );
  if (wInput === null) return;
  const newW = parseFloat(wInput);
  if (!isFinite(newW) || newW <= 0) {
    alert('Valore non valido. Inserisci una larghezza positiva in metri.');
    return;
  }

  const hInput = prompt(
    `Profondità stanza "${r.label}" (m):\n(attuale: ${currentH.toFixed(2)} m)`,
    currentH.toFixed(2)
  );
  if (hInput === null) return;
  const newH = parseFloat(hInput);
  if (!isFinite(newH) || newH <= 0) {
    alert('Valore non valido. Inserisci una profondità positiva in metri.');
    return;
  }

  const newPxW = Math.max(GRID * 2, Math.round(newW / app.metersPerCell) * GRID);
  const newPxH = Math.max(GRID * 2, Math.round(newH / app.metersPerCell) * GRID);

  saveHistory();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  app.rooms[roomIdx].w = newPxW;
  app.rooms[roomIdx].h = newPxH;
  app.rooms[roomIdx].x = Math.round((cx - newPxW / 2) / GRID) * GRID;
  app.rooms[roomIdx].y = Math.round((cy - newPxH / 2) / GRID) * GRID;
  updateResults();
  render();
  setStatus(`Stanza ridimensionata: ${(newPxW / GRID * app.metersPerCell).toFixed(2)} m × ${(newPxH / GRID * app.metersPerCell).toFixed(2)} m`);
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    app.drawStart = null;
    app.wallStart = null;
    app.pipeWIP   = [];
    syncCompletePipeBtn();
    render();
    setStatus('Operazione annullata.');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
}

// ════════════════════════════════════════════════════════════════
//  Drag helpers (select tool)
// ════════════════════════════════════════════════════════════════
function startDrag(pos) {
  app.dragging   = false;
  app.dragTarget = null;

  // Indoor units (all slots)
  for (let i = 0; i < app.splitType; i++) {
    const unit = app.indoorUnits[i];
    if (unit && dist(pos.x, pos.y, unit.x, unit.y) <= UNIT_W / 2 + 4) {
      app.dragTarget = { type: 'indoor', index: i,
                          ox: pos.x - unit.x, oy: pos.y - unit.y };
      return;
    }
  }
  // Outdoor unit
  if (app.outdoorUnit &&
      dist(pos.x, pos.y, app.outdoorUnit.x, app.outdoorUnit.y) <= UNIT_W / 2 + 4) {
    app.dragTarget = { type: 'outdoor', ox: pos.x - app.outdoorUnit.x,
                                         oy: pos.y - app.outdoorUnit.y };
    return;
  }
  // Pipe waypoints (all splits)
  for (let pi = 0; pi < app.splitType; pi++) {
    const pipe = app.pipes[pi] || [];
    for (let i = 0; i < pipe.length; i++) {
      if (dist(pos.x, pos.y, pipe[i].x, pipe[i].y) <= HIT_R) {
        app.dragTarget = { type: 'pipe', pipeIdx: pi, index: i,
                            ox: pos.x - pipe[i].x, oy: pos.y - pipe[i].y };
        return;
      }
    }
  }
  // Room resize handles (must check before room interior so border handles work)
  for (let i = 0; i < app.rooms.length; i++) {
    const r = app.rooms[i];
    for (const h of roomResizeHandles(r)) {
      if (dist(pos.x, pos.y, h.x, h.y) <= RESIZE_HANDLE_R) {
        app.dragTarget = {
          type: 'roomResize',
          index: i,
          side: h.side,
          ox: pos.x - h.x,
          oy: pos.y - h.y,
          orig: { x: r.x, y: r.y, w: r.w, h: r.h },
        };
        return;
      }
    }
  }
  // Rooms (interior drag = move)
  for (let i = app.rooms.length - 1; i >= 0; i--) {
    const r = app.rooms[i];
    if (pos.x >= r.x && pos.x <= r.x + r.w &&
        pos.y >= r.y && pos.y <= r.y + r.h) {
      app.dragTarget = { type: 'room', index: i,
                          ox: pos.x - r.x, oy: pos.y - r.y };
      return;
    }
  }
}

function moveDrag(pos) {
  const dt = app.dragTarget;
  if (!dt) return;

  if (!app.dragging) {
    const orig = origPos(dt);
    if (orig && dist(pos.x, pos.y, orig.x + dt.ox, orig.y + dt.oy) > 4) {
      app.dragging = true;
      saveHistory();
    }
  }
  if (!app.dragging) return;

  const s = snap(pos.x - dt.ox, pos.y - dt.oy);
  switch (dt.type) {
    case 'indoor': {
      const rawTarget = { x: pos.x - dt.ox, y: pos.y - dt.oy };
      const wallSnap = snapUnitToWall(rawTarget);
      if (wallSnap) app.indoorUnits[dt.index] = wallSnap;
      break;
    }
    case 'outdoor': {
      const rawTarget = { x: pos.x - dt.ox, y: pos.y - dt.oy };
      const wallSnap = snapUnitToWall(rawTarget);
      if (wallSnap) app.outdoorUnit = wallSnap;
      break;
    }
    case 'pipe':    app.pipes[dt.pipeIdx][dt.index] = { x: s.x, y: s.y }; break;
    case 'room': {
      app.rooms[dt.index].x = s.x;
      app.rooms[dt.index].y = s.y;
      break;
    }
    case 'roomResize': {
      const orig = dt.orig;
      const MIN  = GRID * 2;
      switch (dt.side) {
        case 'top': {
          const newY = Math.min(s.y, orig.y + orig.h - MIN);
          app.rooms[dt.index].y = newY;
          app.rooms[dt.index].h = orig.y + orig.h - newY;
          break;
        }
        case 'bottom': {
          app.rooms[dt.index].h = Math.max(MIN, s.y - orig.y);
          break;
        }
        case 'left': {
          const newX = Math.min(s.x, orig.x + orig.w - MIN);
          app.rooms[dt.index].x = newX;
          app.rooms[dt.index].w = orig.x + orig.w - newX;
          break;
        }
        case 'right': {
          app.rooms[dt.index].w = Math.max(MIN, s.x - orig.x);
          break;
        }
      }
      break;
    }
  }
}

function origPos(dt) {
  switch (dt.type) {
    case 'indoor':  {
      const u = app.indoorUnits[dt.index];
      return u ? { ...u } : null;
    }
    case 'outdoor': return app.outdoorUnit ? { ...app.outdoorUnit } : null;
    case 'pipe':    {
      const pipe = app.pipes[dt.pipeIdx];
      return pipe && pipe[dt.index] ? { ...pipe[dt.index] } : null;
    }
    case 'room':    return app.rooms[dt.index]
                           ? { x: app.rooms[dt.index].x, y: app.rooms[dt.index].y }
                           : null;
    case 'roomResize': {
      const r = app.rooms[dt.index];
      if (!r) return null;
      switch (dt.side) {
        case 'top':    return { x: r.x + r.w / 2, y: r.y };
        case 'bottom': return { x: r.x + r.w / 2, y: r.y + r.h };
        case 'left':   return { x: r.x,            y: r.y + r.h / 2 };
        case 'right':  return { x: r.x + r.w,      y: r.y + r.h / 2 };
      }
      return null;
    }
  }
  return null;
}

// Snap point to indoor/outdoor unit position if within SNAP_R
function snapToUnit(pt) {
  for (let i = 0; i < app.splitType; i++) {
    const unit = app.indoorUnits[i];
    if (unit && dist(pt.x, pt.y, unit.x, unit.y) <= SNAP_R)
      return { ...unit };
  }
  if (app.outdoorUnit &&
      dist(pt.x, pt.y, app.outdoorUnit.x, app.outdoorUnit.y) <= SNAP_R)
    return { ...app.outdoorUnit };
  return null;
}

// ════════════════════════════════════════════════════════════════
//  Pipe completion
// ════════════════════════════════════════════════════════════════
function completePipe() {
  if (app.pipeWIP.length < 2) return;
  saveHistory();
  app.pipes[app.activePipeIdx] = [...app.pipeWIP];
  app.pipeWIP = [];
  syncCompletePipeBtn();
  render();
  updateResults();
  selectTool('select');
  const results = calculateResults();
  const r = results[app.activePipeIdx];
  if (r) {
    setStatus(`✅ Traccia ${app.activePipeIdx + 1} completata: ${r.meters.toFixed(1)} m — ${r.crossings} pareti attraversate.`);
  }
}

function syncCompletePipeBtn() {
  document.getElementById('complete-pipe-btn').disabled = app.pipeWIP.length < 2;
}

// ════════════════════════════════════════════════════════════════
//  Tool selection
// ════════════════════════════════════════════════════════════════
function selectTool(tool) {
  // Cancel any in-progress drawing (except pipe: keep WIP if switching back)
  if (tool !== app.tool) {
    app.drawStart = null;
    app.wallStart = null;
    if (tool !== 'drawPipe') {
      // Don't discard WIP pipe when user temporarily switches away
    }
  }
  app.tool = tool;
  document.querySelectorAll('.tool-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tool === tool)
  );
  updateHint();
  render();
}

function updateHint() {
  const t = app.activePipeIdx + 1;
  const hints = {
    select:      'Clicca e trascina per spostare; doppio-clic su parete/lato stanza per modificare lunghezza',
    drawRoom:    'Trascina per disegnare una stanza',
    drawWall:    'Clic punto iniziale, poi clic punto finale (solo ortogonale)',
    placeIndoor: `Clic vicino a una parete per posizionare Split Int. ${t} (❄)`,
    placeOutdoor:'Clic vicino a una parete per posizionare l\'unità esterna (🌡)',
    drawPipe:    `Traccia ${t}: clicca i punti del percorso — doppio-clic per completare`,
  };
  document.getElementById('tool-hint').textContent = hints[app.tool] || '';
}

// ════════════════════════════════════════════════════════════════
//  UI helpers
// ════════════════════════════════════════════════════════════════
function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

function updateMousePos() {
  const s  = snap(app.mouse.x, app.mouse.y);
  const mx = ((s.x / GRID) * app.metersPerCell).toFixed(1);
  const my = ((s.y / GRID) * app.metersPerCell).toFixed(1);
  document.getElementById('mouse-pos').textContent = `${mx} m, ${my} m`;
}

// ════════════════════════════════════════════════════════════════
//  History (undo)
// ════════════════════════════════════════════════════════════════
function saveHistory() {
  const snapshot = JSON.stringify({
    rooms:         app.rooms,
    manualWalls:   app.manualWalls,
    indoorUnits:   app.indoorUnits,
    outdoorUnit:   app.outdoorUnit,
    pipes:         app.pipes,
    splitType:     app.splitType,
    activePipeIdx: app.activePipeIdx,
  });
  app.history.push(snapshot);
  if (app.history.length > 40) app.history.shift();
}

function undo() {
  if (app.history.length === 0) return;
  const prev = JSON.parse(app.history.pop());
  app.rooms         = prev.rooms;
  app.manualWalls   = prev.manualWalls;
  app.indoorUnits   = prev.indoorUnits   || [null];
  app.outdoorUnit   = prev.outdoorUnit;
  app.pipes         = prev.pipes         || [[]];
  app.splitType     = prev.splitType     ?? 1;
  app.activePipeIdx = prev.activePipeIdx ?? 0;
  app.pipeWIP       = [];
  syncCompletePipeBtn();
  updateSplitUI();
  render();
  updateResults();
  setStatus('Azione annullata.');
}

// ════════════════════════════════════════════════════════════════
//  Clear actions
// ════════════════════════════════════════════════════════════════
function clearPipe() {
  saveHistory();
  app.pipes[app.activePipeIdx] = [];
  app.pipeWIP = [];
  syncCompletePipeBtn();
  render();
  updateResults();
  setStatus(`Traccia ${app.activePipeIdx + 1} cancellata.`);
}

function clearAll() {
  if (!confirm('Cancellare tutto? Anche la cronologia undo verrà eliminata e non sarà possibile recuperare nulla.')) return;
  app.rooms         = [];
  app.manualWalls   = [];
  app.indoorUnits   = [null];
  app.outdoorUnit   = null;
  app.pipes         = [[]];
  app.pipeWIP       = [];
  app.history       = [];
  app.drawStart     = null;
  app.wallStart     = null;
  app.splitType     = 1;
  app.activePipeIdx = 0;
  syncCompletePipeBtn();
  updateSplitUI();
  render();
  updateResults();
  setStatus('Canvas cancellato.');
}

// ════════════════════════════════════════════════════════════════
//  Split / multi-trace management
// ════════════════════════════════════════════════════════════════
function setSplitType(n) {
  if (n === app.splitType) return;
  saveHistory();
  app.splitType = n;
  // Ensure arrays have enough slots
  while (app.pipes.length < n)        app.pipes.push([]);
  while (app.indoorUnits.length < n)  app.indoorUnits.push(null);
  // Clamp active index
  if (app.activePipeIdx >= n) app.activePipeIdx = n - 1;
  updateSplitUI();
  render();
  updateResults();
  setStatus(`Configurazione: ${n === 1 ? 'Singolo split' : n === 2 ? 'Dual split' : 'Trial split'}.`);
}

function setActivePipe(idx) {
  if (idx < 0 || idx >= app.splitType) return;
  // Discard in-progress WIP silently when switching traces
  app.pipeWIP = [];
  syncCompletePipeBtn();
  app.activePipeIdx = idx;
  updateSplitUI();
  updateHint();
  render();
}

/** Refresh split-config buttons and trace-selector buttons to match current state. */
function updateSplitUI() {
  // Split-type buttons
  document.querySelectorAll('.split-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.split) === app.splitType);
  });

  // Trace selector buttons (dynamic)
  const container = document.getElementById('trace-btns');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < app.splitType; i++) {
    const btn = document.createElement('button');
    btn.className = 'trace-btn' + (i === app.activePipeIdx ? ' active' : '');
    btn.dataset.trace = i;
    btn.textContent   = `T${i + 1}`;
    btn.style.borderColor  = PIPE_COLORS[i];
    btn.style.color        = i === app.activePipeIdx ? '#fff' : PIPE_COLORS[i];
    btn.style.background   = i === app.activePipeIdx ? PIPE_COLORS[i] : '#fff';
    btn.addEventListener('click', () => setActivePipe(i));
    container.appendChild(btn);
  }
}

// ════════════════════════════════════════════════════════════════
//  Shorthand
// ════════════════════════════════════════════════════════════════
const id = s => document.getElementById(s);

// ════════════════════════════════════════════════════════════════
//  Boot
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
