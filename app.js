'use strict';

// ════════════════════════════════════════════════════════════════
//  Constants
// ════════════════════════════════════════════════════════════════
const GRID      = 20;   // pixels per grid cell
const UNIT_W    = 37;   // AC-unit icon width  (px)
const UNIT_H    = 22;   // AC-unit icon height (px)
const WALL_T    = 12;   // wall stroke thickness
const WALL_FACE = 2;    // black face width on each side of wall (px)
const PIPE_T    = 4.5;  // pipe stroke thickness
const HIT_R     = 10;   // hit-test radius (px)
const SNAP_R    = 8;    // snap-to-unit radius (px)
const WALL_SNAP_R    = 35; // max distance (px) to snap AC units / pipe points to a wall
const RESIZE_HANDLE_R = 8; // hit radius for room resize handles (px)
const LABEL_HIT_MARGIN   = 4;   // extra margin beyond UNIT_W/2 for speech-bubble hit testing (px)
const DIST_LABEL_OFFSET  = 14;  // perpendicular offset (px) for per-segment distance labels
const DEFAULT_LABEL_OX   = 0;   // default horizontal offset of speech-bubble label from anchor (px)
const DEFAULT_LABEL_OY   = -50; // default vertical offset of speech-bubble label from anchor (px)
const MIN_CALIB_PX       = 5;   // minimum world-pixel length for a valid calibration line

// Colours for up to 3 independent traces / indoor units
const PIPE_COLORS    = ['#E91E63', '#FF9800', '#9C27B0']; // magenta · orange · purple
const PIPE_DARK      = ['#880E4F', '#E65100', '#4A148C'];
const INDOOR_COLORS  = ['#1976D2', '#F57C00', '#7B1FA2'];
const INDOOR_DARK    = ['#0D47A1', '#BF360C', '#4A148C'];

const POWER_COLOR    = '#FF5722';
const POWER_DARK     = '#BF360C';
const CONDENSA_COLOR = '#00BCD4';
const CONDENSA_DARK  = '#006064';

// Keys for the materials/works checklist (used in init, undo, clearAll)
const MATERIALS_KEYS = ['staffaUE', 'lavaggioImpianto', 'predisposizione'];

// Logo data-URL (preloaded at startup for embedding in print)
let LOGO_DATA_URL = null;

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
  rooms:       [],   // { x, y, w, h, label, color, type? }  pixels  (type: 'room'|'balcony')
  manualWalls: [],   // { x1, y1, x2, y2 }                   pixels
  stairs:      [],   // { x, y, w, h, label }                pixels

  // AC units
  indoorUnits: [null], // [{ x, y, angle }, ...]  one per split (up to 3)
  outdoorUnit: null,   // { x, y, angle }

  // Height from ground (metres)
  indoorHeights: [0],
  outdoorHeight:  0,

  // Completed pipe paths (one array per split)
  pipes:   [[]],   // [[{ x, y }], ...]

  // Pipe being drawn (in-progress) – always for the active split
  pipeWIP: [],       // [{ x, y }]

  // Power & condensate lines
  powerOutlet:       null,
  outletHeight:      0,
  condensateDrain:   null,
  powerPipe:         [],
  condensatePipe:    [],
  powerPipeWIP:      [],
  condensatePipeWIP: [],

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

  // Mouse position (world coordinates)
  mouse: { x: 0, y: 0 },

  // Zoom / pan
  zoom: 1, panX: 0, panY: 0, _panStart: null, _panStartMouse: null,

  // Materials / works checklist
  materials: { staffaUE: false, lavaggioImpianto: false, predisposizione: false },

  // Print notes (not drawn on canvas)
  indoorNotes: ['', '', ''],  // one note per indoor-unit slot (indices 0-2)
  outdoorNote: '',             // note for outdoor unit
  holesNote:   '',             // note shown next to total holes count
  generalNote: '',             // long general note at page bottom

  // Undo history  (array of JSON snapshots)
  history: [],

  // Background image (floor plan overlay)
  bgImage:        null,   // Image object (not serialised – loaded from file)
  bgImageX:       0,      // World X of image top-left corner
  bgImageY:       0,      // World Y of image top-left corner
  bgImageScale:   1.0,    // World pixels per source image pixel
  bgImageOpacity: 0.4,    // 0..1
  bgImageVisible: true,   // show / hide toggle

  // Calibration tool state
  calibPt1: null,         // { x, y } first calibration point (world coords)
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
  app.canvas.addEventListener('wheel', onWheel, { passive: false });
  app.canvas.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });

  document.addEventListener('keydown', onKeyDown);

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn =>
    btn.addEventListener('click', () => selectTool(btn.dataset.tool))
  );

  // Template buttons
  document.querySelectorAll('.tpl-btn').forEach(btn =>
    btn.addEventListener('click', () => loadTemplate(btn.dataset.template))
  );

  // Action buttons (complete & undo remain in the sidebar)
  document.getElementById('complete-pipe-btn')
    .addEventListener('click', completePipe);
  document.getElementById('undo-btn')
    .addEventListener('click', undo);

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

  // Zoom controls
  document.getElementById('zoom-reset-btn').addEventListener('click', () => {
    app.zoom = 1; app.panX = 0; app.panY = 0; render();
  });
  document.getElementById('zoom-in-btn').addEventListener('click', () => {
    app.zoom = Math.min(8, app.zoom * 1.15); render();
  });
  document.getElementById('zoom-out-btn').addEventListener('click', () => {
    app.zoom = Math.max(0.15, app.zoom / 1.15); render();
  });

  // Materials checkboxes
  MATERIALS_KEYS.forEach(key => {
    const el = document.getElementById('mat-' + key);
    if (el) el.addEventListener('change', e => { app.materials[key] = e.target.checked; });
  });

  // Background image controls
  document.getElementById('bg-image-input').addEventListener('change', onBgImageUpload);
  document.getElementById('bg-opacity-slider').addEventListener('input', e => {
    app.bgImageOpacity = parseInt(e.target.value, 10) / 100;
    render();
  });
  document.getElementById('bg-toggle-btn').addEventListener('click', toggleBgImage);
  document.getElementById('bg-remove-btn').addEventListener('click', removeBgImage);

  // ── Dropdown menus (Progetto / Help) ──────────────────────────
  _initDropdowns();

  // ── Modals ────────────────────────────────────────────────────
  document.querySelectorAll('.modal-close').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.modal))
  );
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    })
  );

  // ── Header buttons ────────────────────────────────────────────
  document.getElementById('settings-btn').addEventListener('click', () => {
    renderListiniModal();
    openModal('modal-settings');
  });
  document.getElementById('back-to-home-btn').addEventListener('click', showHomepage);

  // ── Homepage buttons ──────────────────────────────────────────
  document.getElementById('new-project-btn').addEventListener('click', startNewProject);
  document.getElementById('hp-search-input').addEventListener('input', e =>
    renderHomepageProjects(e.target.value.trim())
  );

  updateHeightUI();

  // Preload logo for print
  preloadLogo();

  // Start on homepage
  showHomepage();
}

// ════════════════════════════════════════════════════════════════
//  Screen switching
// ════════════════════════════════════════════════════════════════
function showHomepage() {
  document.getElementById('homepage').style.display      = 'flex';
  document.getElementById('design-screen').style.display = 'none';
  document.getElementById('design-menubar').style.display = 'none';
  document.getElementById('back-to-home-btn').style.display = 'none';
  renderHomepageProjects('');
}

function showDesignScreen() {
  document.getElementById('homepage').style.display      = 'none';
  document.getElementById('design-screen').style.display = 'flex';
  document.getElementById('design-menubar').style.display = 'flex';
  document.getElementById('back-to-home-btn').style.display = '';
  // Re-size canvas now that the wrapper is visible
  requestAnimationFrame(() => {
    resizeCanvas();
    updateHint();
    render();
    updateResults();
  });
}

/** Create a blank project and switch to the design screen. */
function startNewProject() {
  // Reset state to a clean bilocale template
  app.rooms         = [];
  app.manualWalls   = [];
  app.stairs        = [];
  app.indoorUnits   = [null];
  app.outdoorUnit   = null;
  app.indoorHeights = [0];
  app.outdoorHeight = 0;
  app.pipes         = [[]];
  app.pipeWIP           = [];
  app.powerOutlet       = null;
  app.outletHeight      = 0;
  app.condensateDrain   = null;
  app.powerPipe         = [];
  app.condensatePipe    = [];
  app.powerPipeWIP      = [];
  app.condensatePipeWIP = [];
  app.history           = [];
  app.drawStart     = null;
  app.wallStart     = null;
  app.splitType     = 1;
  app.activePipeIdx = 0;
  app.bgImage       = null;
  app.calibPt1      = null;
  app.metersPerCell = 0.5;
  app.materials = { staffaUE: false, lavaggioImpianto: false, predisposizione: false };
  MATERIALS_KEYS.forEach(key => {
    const el = document.getElementById('mat-' + key);
    if (el) el.checked = false;
  });
  app.indoorNotes = ['', '', ''];
  app.outdoorNote = '';
  app.holesNote   = '';
  app.generalNote = '';

  const scaleInput = document.getElementById('scale-input');
  if (scaleInput) scaleInput.value = 0.5;

  _syncBgImageUI();
  loadTemplate('bilocale');
  updateSplitUI();
  updateHeightUI();
  showDesignScreen();
  setStatus('Nuovo progetto creato.');
}

// ════════════════════════════════════════════════════════════════
//  Dropdown menu setup
// ════════════════════════════════════════════════════════════════
function _initDropdowns() {
  // Toggle open/close on button click; close others
  document.querySelectorAll('.menu-btn').forEach(btn => {
    const item = btn.closest('.menu-item');
    const drop = item.querySelector('.menu-dropdown');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = drop.classList.contains('open');
      _closeAllDropdowns();
      if (!isOpen) {
        drop.classList.add('open');
        btn.classList.add('open');
      }
    });
  });

  // Close when clicking outside
  document.addEventListener('click', _closeAllDropdowns);

  // Prevent dropdown clicks from closing it immediately
  document.querySelectorAll('.menu-dropdown').forEach(drop =>
    drop.addEventListener('click', e => e.stopPropagation())
  );

  // ── Progetto dropdown items ───────────────────────────────────
  document.getElementById('dd-save').addEventListener('click', () => {
    _closeAllDropdowns(); saveProject();
  });
  document.getElementById('dd-import-bg').addEventListener('click', () => {
    _closeAllDropdowns(); document.getElementById('bg-image-input').click();
  });
  document.getElementById('dd-clear-trace').addEventListener('click', () => {
    _closeAllDropdowns(); clearActivePipeTrace();
  });
  document.getElementById('dd-clear-power').addEventListener('click', () => {
    _closeAllDropdowns(); clearPowerPipeTrace();
  });
  document.getElementById('dd-clear-condensa').addEventListener('click', () => {
    _closeAllDropdowns(); clearCondensatePipeTrace();
  });
  document.getElementById('dd-clear-all').addEventListener('click', () => {
    _closeAllDropdowns(); clearAll();
  });
  document.getElementById('dd-print').addEventListener('click', () => {
    _closeAllDropdowns(); printReport();
  });

  // ── Help dropdown items ───────────────────────────────────────
  document.getElementById('dd-guide').addEventListener('click', () => {
    _closeAllDropdowns(); openModal('modal-guide');
  });
  document.getElementById('dd-legend').addEventListener('click', () => {
    _closeAllDropdowns(); openModal('modal-legend');
  });
}

function _closeAllDropdowns() {
  document.querySelectorAll('.menu-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.menu-btn.open').forEach(b => b.classList.remove('open'));
}

// ════════════════════════════════════════════════════════════════
//  Modal helpers
// ════════════════════════════════════════════════════════════════
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ════════════════════════════════════════════════════════════════
//  Logo preload (for embedding in print)
// ════════════════════════════════════════════════════════════════
function preloadLogo() {
  // Fetch the SVG text and embed it as a data-URL so the original
  // aspect ratio is always preserved (no canvas rasterisation).
  fetch('logo.svg')
    .then(r => r.text())
    .then(svg => {
      LOGO_DATA_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    })
    .catch(e => { console.warn('Logo preload failed:', e); });
}

// ════════════════════════════════════════════════════════════════
//  Background image (floor plan overlay)
// ════════════════════════════════════════════════════════════════
function onBgImageUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Seleziona un file immagine (JPEG, PNG, ecc.).');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      app.bgImage       = img;
      app.bgImageX      = 0;
      app.bgImageY      = 0;
      // Scale so the image width fills the canvas width in world-space at zoom 1:1
      app.bgImageScale  = app.canvas.width / img.naturalWidth;
      app.bgImageVisible = true;
      // Sync UI
      _syncBgImageUI();
      selectTool('calibrate');
      setStatus('Planimetria caricata. Usa lo strumento Calibra per allinearla alla griglia.');
      render();
    };
    img.onerror = function() {
      alert('Errore nel caricamento dell\'immagine.');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  // Reset input so the same file can be re-uploaded
  e.target.value = '';
}

function toggleBgImage() {
  if (!app.bgImage) return;
  app.bgImageVisible = !app.bgImageVisible;
  document.getElementById('bg-toggle-btn').textContent =
    app.bgImageVisible ? '👁 Nascondi' : '👁 Mostra';
  render();
}

function removeBgImage() {
  if (!app.bgImage) return;
  if (!confirm('Rimuovere la planimetria di sfondo?')) return;
  app.bgImage    = null;
  app.calibPt1   = null;
  _syncBgImageUI();
  if (app.tool === 'calibrate') selectTool('select');
  render();
  setStatus('Planimetria rimossa.');
}

/** Enable/disable background image controls based on whether an image is loaded. */
function _syncBgImageUI() {
  const hasImg = !!app.bgImage;
  document.getElementById('bg-toggle-btn').disabled  = !hasImg;
  document.getElementById('bg-remove-btn').disabled  = !hasImg;
  document.getElementById('calib-tool-btn').disabled = !hasImg;
  if (hasImg) {
    document.getElementById('bg-toggle-btn').textContent =
      app.bgImageVisible ? '👁 Nascondi' : '👁 Mostra';
  }
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
  const rawX = e.clientX - r.left;
  const rawY = e.clientY - r.top;
  return { x: (rawX - app.panX) / app.zoom, y: (rawY - app.panY) / app.zoom };
}

function getRawPos(e) {
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
    type: r.type || 'room',
  }));
  app.manualWalls  = [];
  app.stairs       = [];
  app.indoorUnits  = [null];
  app.outdoorUnit  = null;
  app.indoorHeights = [0];
  app.outdoorHeight = 0;
  app.pipes             = [[]];
  app.pipeWIP           = [];
  app.powerOutlet       = null;
  app.outletHeight      = 0;
  app.condensateDrain   = null;
  app.powerPipe         = [];
  app.condensatePipe    = [];
  app.powerPipeWIP      = [];
  app.condensatePipeWIP = [];
  app.splitType         = 1;
  app.activePipeIdx     = 0;
  app.indoorNotes       = ['', '', ''];
  app.outdoorNote       = '';
  app.holesNote         = '';
  app.generalNote       = '';

  render();
  updateResults();
  updateSplitUI();
  updateHeightUI();
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

/**
 * Returns the exact intersection point {x, y} of two segments.
 * Pre-condition: segsIntersect() returned true for these segments.
 */
function segIntersectionPoint(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const dx1 = ax2 - ax1, dy1 = ay2 - ay1;
  const dx2 = bx2 - bx1, dy2 = by2 - by1;
  const denom = dx1 * dy2 - dy1 * dx2;
  const ex = bx1 - ax1, ey = by1 - ay1;
  const t = (ex * dy2 - ey * dx2) / denom;
  return { x: ax1 + t * dx1, y: ay1 + t * dy1 };
}

/**
 * Append crossing points from a single pipe into an existing `pts` array,
 * deduplicating within GRID/2 px. Shared by counting and drawing helpers.
 */
function _addPipeCrossings(pipe, walls, pts) {
  if (!pipe || pipe.length < 2) return;
  for (let j = 1; j < pipe.length; j++) {
    const { x: ax1, y: ay1 } = pipe[j - 1];
    const { x: ax2, y: ay2 } = pipe[j];
    for (const w of walls) {
      if (segsIntersect(ax1, ay1, ax2, ay2, w.x1, w.y1, w.x2, w.y2)) {
        const pt = segIntersectionPoint(ax1, ay1, ax2, ay2, w.x1, w.y1, w.x2, w.y2);
        if (!pts.some(p => dist(p.x, p.y, pt.x, pt.y) < GRID / 2))
          pts.push(pt);
      }
    }
  }
}

/**
 * Count unique wall crossings for a single pipe path.
 * Two intersections within GRID/2 px are merged into one hole,
 * preventing overlapping collinear room-wall segments from being
 * counted as multiple holes at the same physical location.
 */
function countUniqueCrossings(pipe, walls) {
  const pts = [];
  _addPipeCrossings(pipe, walls, pts);
  return pts.length;
}

/**
 * Count unique wall crossings across multiple pipe paths (for multi-split).
 * Crossing points from different pipes that are within GRID/2 px of each
 * other are merged into one hole (same physical location in the wall).
 */
function countUnifiedCrossings(pipes, walls) {
  const pts = [];
  for (const pipe of pipes) _addPipeCrossings(pipe, walls, pts);
  return pts.length;
}

/**
 * Collect all unique wall-drilling points from every active pipe
 * (refrigerant traces T1-T3, power line, condensate line).
 * Points closer than GRID/2 px to an existing entry are merged into one.
 * Returns [{x, y}, ...].
 */
function collectDrillingPoints(mainOnly = false) {
  const walls = allWalls();
  const pts = [];
  for (let i = 0; i < app.splitType; i++) _addPipeCrossings(app.pipes[i], walls, pts);
  if (!mainOnly) {
    _addPipeCrossings(app.powerPipe,      walls, pts);
    _addPipeCrossings(app.condensatePipe, walls, pts);
  }
  return pts;
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
/** Returns an array of {meters, totalMeters, heightDiff, crossings} for each active split (null if no pipe). */
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

    // Wall crossings (deduplicated: overlapping walls at the same location count as one hole)
    const crossings = countUniqueCrossings(pipe, walls);

    const iH = (app.indoorHeights && app.indoorHeights[i]) ? app.indoorHeights[i] : 0;
    const oH = app.outdoorHeight || 0;
    const heightDiff = Math.abs(iH - oH);
    const totalMeters = meters + heightDiff;

    results.push({ meters, totalMeters, heightDiff, crossings });
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
  const walls = allWalls();
  const container = document.getElementById('results-per-trace');
  if (!container) return;

  container.innerHTML = '';
  let hasAny = false;
  const isMulti = app.splitType > 1;

  for (let i = 0; i < app.splitType; i++) {
    const r = results[i];
    const color = PIPE_COLORS[i];
    const row = document.createElement('div');
    row.className = 'res-row';
    if (r) {
      hasAny = true;
      let val = r.totalMeters.toFixed(1) + ' m';
      if (r.heightDiff > 0) val += ` (Δh ${r.heightDiff.toFixed(1)} m)`;
      // For multi-split: per-trace hole counts are not shown (unified count shown below)
      if (!isMulti) val += ` | ${r.crossings} par.`;
      row.innerHTML =
        `<span class="res-lbl" style="color:${color};font-weight:700">T${i+1}:</span>` +
        `<span class="res-val">${val}</span>`;
    } else {
      row.innerHTML =
        `<span class="res-lbl" style="color:${color};font-weight:700">T${i+1}:</span>` +
        `<span class="res-val" style="color:#aaa">—</span>`;
    }
    container.appendChild(row);
  }

  // Unified hole count for multi-split: collect crossing points across ALL active pipes
  // and deduplicate so that pipes passing through the same wall location count as one hole.
  let totalCrossings = 0;
  if (isMulti && hasAny) {
    const activePipes = [];
    for (let i = 0; i < app.splitType; i++) {
      if (results[i]) activePipes.push(app.pipes[i] || []);
    }
    totalCrossings = countUnifiedCrossings(activePipes, walls);
    const row = document.createElement('div');
    row.className = 'res-row';
    row.innerHTML = `<span class="res-lbl" style="font-weight:700">🔩 Fori:</span>` +
      `<span class="res-val">${totalCrossings} par.</span>`;
    container.appendChild(row);
  } else if (!isMulti && results[0]) {
    totalCrossings = results[0].crossings;
  }

  const pcResults = calculatePowerCondensaResults();
  if (pcResults.power) {
    const row = document.createElement('div');
    row.className = 'res-row';
    let powerVal = (pcResults.power.totalMeters ?? pcResults.power.meters).toFixed(1) + ' m';
    if (pcResults.power.heightDiff > 0) powerVal += ` (Δh ${pcResults.power.heightDiff.toFixed(1)} m)`;
    powerVal += ` | ${pcResults.power.crossings} par.`;
    row.innerHTML = `<span class="res-lbl" style="color:${POWER_COLOR};font-weight:700">⚡ Corr.:</span>` +
      `<span class="res-val">${powerVal}</span>`;
    container.appendChild(row);
    hasAny = true;
    totalCrossings += pcResults.power.crossings;
  }
  if (pcResults.condensa) {
    const row = document.createElement('div');
    row.className = 'res-row';
    row.innerHTML = `<span class="res-lbl" style="color:${CONDENSA_COLOR};font-weight:700">💧 Cond.:</span>` +
      `<span class="res-val">${pcResults.condensa.meters.toFixed(1)} m | ${pcResults.condensa.crossings} par.</span>`;
    container.appendChild(row);
    hasAny = true;
    totalCrossings += pcResults.condensa.crossings;
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

  ctx.save();
  ctx.translate(app.panX, app.panY);
  ctx.scale(app.zoom, app.zoom);

  // Layer 3 – background: floor plan, walls, AC units, stairs
  drawGrid();
  drawBackground();
  drawRooms();
  drawRoomWallLabels();
  drawManualWalls();
  drawStairsLayer();
  drawAcUnits();
  drawSpecialUnits();
  // Layer 2 – pipes (above floor plan)
  drawPipe();
  drawPowerCondensaPipes();
  drawInProgress();
  // Layer 1 – foreground: drilling points always on top of everything
  drawDrillingPoints();
  // UI overlays
  drawRoomResizeHandles();

  ctx.restore();

  updateMousePos();
  const zoomEl = document.getElementById('zoom-level');
  if (zoomEl) zoomEl.textContent = Math.round(app.zoom * 100) + '%';
}

/* ── Grid ── */
function drawGrid() {
  const { ctx, canvas } = app;
  const x0 = -app.panX / app.zoom;
  const y0 = -app.panY / app.zoom;
  const x1 = (canvas.width  - app.panX) / app.zoom;
  const y1 = (canvas.height - app.panY) / app.zoom;

  ctx.fillStyle = '#fafafa';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  ctx.lineWidth = 0.5 / app.zoom;
  const gx0 = Math.floor(x0 / GRID) * GRID;
  const gy0 = Math.floor(y0 / GRID) * GRID;

  for (let x = gx0; x <= x1 + GRID; x += GRID) {
    const idx = Math.round(x / GRID);
    ctx.strokeStyle = idx % 5 === 0 ? '#d0d0d0' : '#ebebeb';
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  }
  for (let y = gy0; y <= y1 + GRID; y += GRID) {
    const idx = Math.round(y / GRID);
    ctx.strokeStyle = idx % 5 === 0 ? '#d0d0d0' : '#ebebeb';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }
}

/* ── Background image (floor plan) ── */
function drawBackground() {
  if (!app.bgImage || !app.bgImageVisible) return;
  const ctx = app.ctx;
  ctx.save();
  ctx.globalAlpha = app.bgImageOpacity;
  ctx.drawImage(
    app.bgImage,
    app.bgImageX, app.bgImageY,
    app.bgImage.naturalWidth  * app.bgImageScale,
    app.bgImage.naturalHeight * app.bgImageScale
  );
  ctx.restore();
}

/* ── Rooms ── */
function drawRooms() {
  const ctx = app.ctx;
  for (const room of app.rooms) {
    const isBalcony = room.type === 'balcony';

    // Fill room interior
    ctx.fillStyle = room.color || (isBalcony ? '#e8f5e9' : '#f5f5f0');
    ctx.fillRect(room.x, room.y, room.w, room.h);

    if (isBalcony) {
      // Diagonal hatch pattern inside balcony
      ctx.save();
      ctx.beginPath();
      ctx.rect(room.x, room.y, room.w, room.h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(76,175,80,0.3)';
      ctx.lineWidth = 1;
      const step = GRID;
      for (let d = -room.h; d < room.w + room.h; d += step) {
        ctx.beginPath();
        ctx.moveTo(room.x + d, room.y);
        ctx.lineTo(room.x + d + room.h, room.y + room.h);
        ctx.stroke();
      }
      ctx.restore();

      // Green dashed border (outer + white stripe)
      ctx.strokeStyle = '#388E3C';
      ctx.lineWidth   = WALL_T;
      ctx.setLineDash([12, 5]);
      ctx.strokeRect(room.x, room.y, room.w, room.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = WALL_T - WALL_FACE * 2;
      ctx.strokeRect(room.x, room.y, room.w, room.h);
      ctx.setLineDash([]);
    } else {
      // Normal solid wall
      ctx.strokeStyle = '#2c2c2c';
      ctx.lineWidth   = WALL_T;
      ctx.strokeRect(room.x, room.y, room.w, room.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = WALL_T - WALL_FACE * 2;
      ctx.strokeRect(room.x, room.y, room.w, room.h);
    }

    // Label
    ctx.fillStyle    = isBalcony ? '#2E7D32' : '#555';
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
    const h = app.indoorHeights ? (app.indoorHeights[i] || 0) : 0;
    if (h > 0) {
      ctx.fillStyle    = INDOOR_COLORS[i];
      ctx.font         = '6px Segoe UI, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(h.toFixed(1) + 'm↑', 0, UNIT_H / 2 + 2);
    }
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
    const oh = app.outdoorHeight || 0;
    if (oh > 0) {
      ctx.fillStyle    = '#388E3C';
      ctx.font         = '6px Segoe UI, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(oh.toFixed(1) + 'm↑', 0, UNIT_H / 2 + 2);
    }
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

/* ── Drilling-point markers (red circles on walls) ── */
function drawDrillingPoints() {
  const ctx = app.ctx;
  const pts = collectDrillingPoints();
  if (pts.length === 0) return;

  const R      = 7;    // outer circle radius (px) → 14 px diameter
  const R_FILL = 5.5;  // inner fill radius (px)

  pts.forEach((pt, idx) => {
    // Outer white halo (improves visibility on dark walls)
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, R + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // Red fill
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, R_FILL, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,30,30,0.25)';
    ctx.fill();

    // Red stroke circle
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#CC0000';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Cross-hair lines inside circle
    ctx.strokeStyle = '#CC0000';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(pt.x - (R - 1), pt.y);
    ctx.lineTo(pt.x + (R - 1), pt.y);
    ctx.moveTo(pt.x, pt.y - (R - 1));
    ctx.lineTo(pt.x, pt.y + (R - 1));
    ctx.stroke();

    // Hole number badge (1-indexed)
    const label = String(idx + 1);
    ctx.font         = 'bold 8px Segoe UI, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    const bx = pt.x + R + 1;
    const by = pt.y - R - 1;
    ctx.fillStyle = '#CC0000';
    roundRect(ctx, bx - tw / 2 - 2, by - 4, tw + 4, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, bx, by);
  });
}

/**
 * For each segment of each active refrigerant trace, compute a scalar lateral
 * offset (px) so that geometrically overlapping segments from different traces
 * are rendered side-by-side rather than directly on top of each other.
 *
 * Two segments from different traces are considered "overlapping" when they are:
 *  - nearly parallel (|sin angle| ≤ ANGLE_TOL)
 *  - nearly collinear (perpendicular distance ≤ DIST_TOL)
 *  - overlapping in projection by at least OVERLAP_MIN px
 *
 * Overlapping segments are grouped with union-find; within each group they are
 * spread evenly centred on their original path.
 *
 * Returns offsets[traceIdx][segIdx]  (0 when no overlap).
 */
function computePipeRenderOffsets() {
  const ANGLE_TOL  = 0.08;        // |sin angle| threshold (≈ 4.6°)
  const DIST_TOL   = GRID / 2;    // max perpendicular distance (px)
  const OVERLAP_MIN = GRID;       // min projection overlap (px)
  const SIDE_GAP   = PIPE_T; // center-to-center lateral spacing between parallel traces (px)
                             // = pipe width (4.5) so adjacent traces touch with no gap

  // ── build flat segment list ───────────────────────────────────────
  const segs = [];
  for (let i = 0; i < app.splitType; i++) {
    const pts = app.pipes[i] || [];
    for (let j = 1; j < pts.length; j++) {
      const ax = pts[j-1].x, ay = pts[j-1].y;
      const bx = pts[j].x,   by = pts[j].y;
      const ddx = bx - ax,   ddy = by - ay;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      if (len < 1) continue;
      segs.push({ ti: i, si: j - 1, ax, ay, bx, by,
                  ux: ddx / len, uy: ddy / len, len });
    }
  }

  // ── union-find helpers ────────────────────────────────────────────
  const parent = segs.map((_, k) => k);
  function find(k) {
    while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; }
    return k;
  }
  function union(a, b) {
    a = find(a); b = find(b);
    if (a !== b) parent[b] = a;
  }

  // ── detect overlapping segment pairs ─────────────────────────────
  for (let a = 0; a < segs.length; a++) {
    for (let b = a + 1; b < segs.length; b++) {
      const sa = segs[a], sb = segs[b];
      if (sa.ti === sb.ti) continue;           // same trace – skip

      // parallel?
      const cross = Math.abs(sa.ux * sb.uy - sa.uy * sb.ux);
      if (cross > ANGLE_TOL) continue;

      // collinear?  perp-distance from sb.start to the line of sa
      const perpDist = Math.abs((sb.ax - sa.ax) * (-sa.uy) +
                                (sb.ay - sa.ay) * ( sa.ux));
      if (perpDist > DIST_TOL) continue;

      // overlapping projection onto sa's direction?
      const dot = (x, y) => x * sa.ux + y * sa.uy;
      const pa0 = dot(sa.ax, sa.ay), pa1 = dot(sa.bx, sa.by);
      const pb0 = dot(sb.ax, sb.ay), pb1 = dot(sb.bx, sb.by);
      const oStart = Math.max(Math.min(pa0, pa1), Math.min(pb0, pb1));
      const oEnd   = Math.min(Math.max(pa0, pa1), Math.max(pb0, pb1));
      if (oEnd - oStart < OVERLAP_MIN) continue;

      union(a, b);
    }
  }

  // One entry per segment (segments = points − 1); empty pipes get zero-length arrays.
  const offsets = [];
  for (let i = 0; i < app.splitType; i++) {
    offsets.push(new Array(Math.max(0, (app.pipes[i] || []).length - 1)).fill(0));
  }

  const groups = new Map();
  for (let k = 0; k < segs.length; k++) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(k);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => segs[a].ti - segs[b].ti); // stable ordering by trace index
    const n = members.length;
    members.forEach((k, idx) => {
      const { ti, si } = segs[k];
      offsets[ti][si] = (idx - (n - 1) / 2) * SIDE_GAP;
    });
  }
  return offsets;
}

/* ── Completed pipes (all active splits) ── */
function drawPipe() {
  const ctx = app.ctx;
  const segOffsets = computePipeRenderOffsets();

  for (let i = 0; i < app.splitType; i++) {
    const pts = app.pipes[i] || [];
    if (pts.length === 0) continue;

    const color     = PIPE_COLORS[i];
    const darkColor = PIPE_DARK[i];
    const segsOff   = segOffsets[i] || [];

    ctx.strokeStyle = color;
    ctx.lineWidth   = PIPE_T;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash([]);

    if (pts.length >= 2) {
      // Draw each segment individually so per-segment lateral offsets can be applied
      for (let j = 1; j < pts.length; j++) {
        const lat = segsOff[j - 1] || 0;
        const ax = pts[j-1].x, ay = pts[j-1].y;
        const bx = pts[j].x,   by = pts[j].y;
        let ox = 0, oy = 0;
        if (lat !== 0) {
          const dx = bx - ax, dy = by - ay;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            // Perpendicular CCW offset
            ox = (-dy / len) * lat;
            oy = ( dx / len) * lat;
          }
        }
        ctx.beginPath();
        ctx.moveTo(ax + ox, ay + oy);
        ctx.lineTo(bx + ox, by + oy);
        ctx.stroke();
      }

      // Per-segment distance labels (at original midpoint, offset perpendicular)
      for (let j = 1; j < pts.length; j++) {
        const d = dist(pts[j-1].x, pts[j-1].y, pts[j].x, pts[j].y);
        const m = (d / GRID) * app.metersPerCell;
        if (m >= 1) {
          const mx = (pts[j-1].x + pts[j].x) / 2;
          const my = (pts[j-1].y + pts[j].y) / 2;
          const sdx = pts[j].x - pts[j-1].x;
          const sdy = pts[j].y - pts[j-1].y;
          drawDistLabel(ctx, m.toFixed(1) + ' m', mx, my, darkColor, sdx, sdy);
        }
      }
    }

    // Waypoint dots (at original un-offset positions)
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

function drawDistLabel(ctx, text, x, y, fgColor, segDx, segDy) {
  fgColor = fgColor || '#880E4F';
  // Offset the label perpendicular to the segment so it doesn't overlap the line
  let ox = 0, oy = 0;
  if (segDx !== undefined && segDy !== undefined) {
    const len = Math.sqrt(segDx * segDx + segDy * segDy);
    if (len > 0) {
      // Perpendicular CCW: (-segDy, segDx) normalised × DIST_LABEL_OFFSET px
      ox = (-segDy / len) * DIST_LABEL_OFFSET;
      oy = ( segDx / len) * DIST_LABEL_OFFSET;
    }
  }
  const lx = x + ox, ly = y + oy;
  ctx.font         = 'bold 9px Segoe UI, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fgColor;
  ctx.fillText(text, lx, ly);
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

  // Balcony drag preview
  if (app.tool === 'drawBalcony' && app.drawStart) {
    const s  = app.drawStart;
    const rx = Math.min(s.x, m.x), ry = Math.min(s.y, m.y);
    const rw = Math.abs(m.x - s.x), rh = Math.abs(m.y - s.y);
    if (rw > 0 && rh > 0) {
      ctx.fillStyle = 'rgba(232,245,233,.65)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#388E3C';
      ctx.lineWidth   = WALL_T;
      ctx.setLineDash([12, 5]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      const mw = (rw / GRID) * app.metersPerCell;
      const mh = (rh / GRID) * app.metersPerCell;
      ctx.fillStyle    = '#388E3C';
      ctx.font         = '10px Segoe UI, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(mw.toFixed(1) + ' m', rx + rw / 2, ry - 3);
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(mh.toFixed(1) + ' m', rx - 3, ry + rh / 2);
    }
  }

  // Stairs drag preview
  if (app.tool === 'drawStairs' && app.drawStart) {
    const s  = app.drawStart;
    const rx = Math.min(s.x, m.x), ry = Math.min(s.y, m.y);
    const rw = Math.abs(m.x - s.x), rh = Math.abs(m.y - s.y);
    if (rw > 0 && rh > 0) {
      ctx.fillStyle = 'rgba(245,240,232,.75)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      const mw = (rw / GRID) * app.metersPerCell;
      const mh = (rh / GRID) * app.metersPerCell;
      ctx.fillStyle    = '#5d4037';
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

  // Power pipe WIP
  if (app.powerPipeWIP.length > 0) {
    const pts = app.powerPipeWIP;
    ctx.strokeStyle = POWER_COLOR; ctx.lineWidth = PIPE_T; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([12, 6]);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke(); ctx.setLineDash([]);
    for (const pt of pts) pipeDot(ctx, pt.x, pt.y, POWER_COLOR);
    const pipeCursor = snapPipeToWall(app.mouse) || snapToUnit(snap(app.mouse.x, app.mouse.y)) || snap(app.mouse.x, app.mouse.y);
    ctx.globalAlpha = 0.4; ctx.strokeStyle = POWER_COLOR; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pts[pts.length-1].x, pts[pts.length-1].y); ctx.lineTo(pipeCursor.x, pipeCursor.y);
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // Condensate pipe WIP
  if (app.condensatePipeWIP.length > 0) {
    const pts = app.condensatePipeWIP;
    ctx.strokeStyle = CONDENSA_COLOR; ctx.lineWidth = PIPE_T; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([12, 6]);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke(); ctx.setLineDash([]);
    for (const pt of pts) pipeDot(ctx, pt.x, pt.y, CONDENSA_COLOR);
    const pipeCursor = snapPipeToWall(app.mouse) || snapToUnit(snap(app.mouse.x, app.mouse.y)) || snap(app.mouse.x, app.mouse.y);
    ctx.globalAlpha = 0.4; ctx.strokeStyle = CONDENSA_COLOR; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pts[pts.length-1].x, pts[pts.length-1].y); ctx.lineTo(pipeCursor.x, pipeCursor.y);
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // Snap cursor dot for drawing tools
  if (app.tool === 'drawRoom' || app.tool === 'drawWall' ||
      app.tool === 'drawBalcony' || app.tool === 'drawStairs') {
    snapDot(ctx, m.x, m.y);
  } else if (app.tool === 'drawPipe') {
    const pipeCursor = snapPipeToWall(app.mouse) || snapToUnit(m) || m;
    snapDot(ctx, pipeCursor.x, pipeCursor.y);
  } else if (app.tool === 'drawPowerPipe' || app.tool === 'drawCondensaPipe') {
    const pipeCursor = snapPipeToWall(app.mouse) || snapToUnit(snap(app.mouse.x, app.mouse.y)) || snap(app.mouse.x, app.mouse.y);
    snapDot(ctx, pipeCursor.x, pipeCursor.y);
  }

  // Ghost unit preview while hovering with placement tools
  if (app.tool === 'placeIndoor' || app.tool === 'placeOutdoor' ||
      app.tool === 'placeOutlet' || app.tool === 'placeDrain') {
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
      } else if (app.tool === 'placeOutdoor') {
        fill   = '#388E3C';
        stroke = '#1B5E20';
      } else if (app.tool === 'placeOutlet') {
        fill   = POWER_COLOR;
        stroke = POWER_DARK;
      } else {
        fill   = CONDENSA_COLOR;
        stroke = CONDENSA_DARK;
      }
      drawUnitBox(ctx, -UNIT_W / 2, -UNIT_H / 2, UNIT_W, UNIT_H, fill, stroke);
      ctx.restore();
    }
  }

  // Calibration tool preview
  if (app.tool === 'calibrate') {
    if (app.calibPt1) {
      const mx = app.mouse.x, my = app.mouse.y;
      const dx = mx - app.calibPt1.x, dy = my - app.calibPt1.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      const distM  = (distPx / GRID) * app.metersPerCell;

      // Calibration line
      ctx.strokeStyle = '#FF5722';
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 3]);
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(app.calibPt1.x, app.calibPt1.y);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.setLineDash([]);

      // Endpoint markers
      ctx.strokeStyle = '#FF5722';
      ctx.fillStyle   = 'rgba(255,87,34,.25)';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(app.calibPt1.x, app.calibPt1.y, 6, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Distance label at midpoint
      if (distPx > 10) {
        const lx = (app.calibPt1.x + mx) / 2;
        const ly = (app.calibPt1.y + my) / 2;
        ctx.save();
        ctx.font         = 'bold 11px Segoe UI, sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle    = '#BF360C';
        ctx.fillText(`${distM.toFixed(2)} m`, lx, ly - 4);
        ctx.restore();
      }
    } else {
      // Show cursor dot waiting for first point
      ctx.strokeStyle = '#FF5722';
      ctx.fillStyle   = 'rgba(255,87,34,.25)';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(app.mouse.x, app.mouse.y, 6, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
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

/* ── Stairs ── */
function drawStairsLayer() {
  const ctx = app.ctx;
  for (const s of app.stairs) {
    // Background fill
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(s.x, s.y, s.w, s.h);

    // Tread lines (one per GRID row)
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    for (let y = s.y + GRID; y < s.y + s.h; y += GRID) {
      ctx.beginPath();
      ctx.moveTo(s.x, y);
      ctx.lineTo(s.x + s.w, y);
      ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth   = 2;
    ctx.strokeRect(s.x, s.y, s.w, s.h);

    // Ascent arrow (bottom centre → top centre)
    const cx  = s.x + s.w / 2;
    const ay1 = s.y + s.h - GRID * 0.5;
    const ay2 = s.y + GRID * 0.5;
    ctx.strokeStyle = '#5d4037';
    ctx.fillStyle   = '#5d4037';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, ay1);
    ctx.lineTo(cx, ay2);
    ctx.stroke();
    // Arrowhead
    const aSize = 5;
    ctx.beginPath();
    ctx.moveTo(cx, ay2);
    ctx.lineTo(cx - aSize, ay2 + aSize * 1.5);
    ctx.lineTo(cx + aSize, ay2 + aSize * 1.5);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.fillStyle    = '#5d4037';
    ctx.font         = 'bold 9px Segoe UI, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label || 'Scale', cx, s.y + s.h / 2);
  }
}
function onMouseDown(e) {
  if (e.button === 1) {
    e.preventDefault();
    app._panStart      = { panX: app.panX, panY: app.panY };
    app._panStartMouse = getRawPos(e);
    return;
  }
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

    case 'drawBalcony':
      app.drawStart = s;
      break;

    case 'drawStairs':
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

    case 'placeOutlet': {
      const wallSnap = snapUnitToWall(raw);
      if (!wallSnap) { setStatus('⚠ Avvicinati a una parete per posizionare la presa di corrente.'); break; }
      saveHistory();
      app.powerOutlet = { ...wallSnap, labelOx: DEFAULT_LABEL_OX, labelOy: DEFAULT_LABEL_OY };
      setStatus('🔌 Presa di corrente posizionata.');
      render();
      break;
    }

    case 'placeDrain': {
      const wallSnap = snapUnitToWall(raw);
      if (!wallSnap) { setStatus('⚠ Avvicinati a una parete per posizionare lo scarico condensa.'); break; }
      saveHistory();
      app.condensateDrain = { ...wallSnap, labelOx: DEFAULT_LABEL_OX, labelOy: DEFAULT_LABEL_OY };
      setStatus('💧 Scarico condensa posizionato.');
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

    case 'drawPowerPipe': {
      const wallSnap  = snapPipeToWall(raw);
      const snappedPt = wallSnap || snapToUnit(s) || s;
      const now = Date.now(); const last = app._lastPipeClick;
      if (app.powerPipeWIP.length >= 1 && last && last.x === snappedPt.x && last.y === snappedPt.y && now - last.time < 400) {
        app._lastPipeClick = null;
        if (app.powerPipeWIP.length >= 2) completePipe();
      } else {
        app._lastPipeClick = { time: now, x: snappedPt.x, y: snappedPt.y };
        app.powerPipeWIP.push({ ...snappedPt });
        syncCompletePipeBtn();
        render();
      }
      break;
    }

    case 'drawCondensaPipe': {
      const wallSnap  = snapPipeToWall(raw);
      const snappedPt = wallSnap || snapToUnit(s) || s;
      const now = Date.now(); const last = app._lastPipeClick;
      if (app.condensatePipeWIP.length >= 1 && last && last.x === snappedPt.x && last.y === snappedPt.y && now - last.time < 400) {
        app._lastPipeClick = null;
        if (app.condensatePipeWIP.length >= 2) completePipe();
      } else {
        app._lastPipeClick = { time: now, x: snappedPt.x, y: snappedPt.y };
        app.condensatePipeWIP.push({ ...snappedPt });
        syncCompletePipeBtn();
        render();
      }
      break;
    }

    case 'calibrate': {
      if (!app.bgImage) {
        setStatus('⚠ Carica prima una planimetria dal pannello "Planimetria".');
        break;
      }
      if (!app.calibPt1) {
        // First point: use exact (unsnapped) mouse position for precision
        app.calibPt1 = { x: raw.x, y: raw.y };
        setStatus('Calibrazione: clicca il secondo punto della misura nota.');
        updateHint();
        render();
      } else {
        const pt2 = { x: raw.x, y: raw.y };
        const dx  = pt2.x - app.calibPt1.x;
        const dy  = pt2.y - app.calibPt1.y;
        const linePx = Math.sqrt(dx * dx + dy * dy);
        if (linePx < MIN_CALIB_PX) {
          setStatus('⚠ I due punti sono troppo vicini. Clicca il primo punto e riprova.');
          app.calibPt1 = null;
          render();
          break;
        }
        const input = prompt(
          'Inserisci la distanza reale in metri tra i due punti selezionati:\n' +
          '(es. 3.5 per 3 metri e 50 cm)'
        );
        if (input === null) { app.calibPt1 = null; render(); break; } // cancelled
        const realMeters = parseFloat(input.replace(',', '.'));
        if (!isFinite(realMeters) || realMeters <= 0) {
          alert('Distanza non valida. Inserisci un numero positivo in metri (es. 3.5).');
          app.calibPt1 = null;
          render();
          break;
        }
        // Scale so that linePx maps to (realMeters / metersPerCell) * GRID world pixels
        const expectedPx  = (realMeters / app.metersPerCell) * GRID;
        const scaleFactor = expectedPx / linePx;
        // Keep calibPt1 fixed in world space while scaling the image
        app.bgImageX     = app.calibPt1.x - (app.calibPt1.x - app.bgImageX) * scaleFactor;
        app.bgImageY     = app.calibPt1.y - (app.calibPt1.y - app.bgImageY) * scaleFactor;
        app.bgImageScale *= scaleFactor;
        app.calibPt1     = null;
        setStatus(`✅ Planimetria calibrata: ${realMeters} m. Ora ricalca le stanze sopra l'immagine.`);
        render();
      }
      break;
    }
  }
}

function onMouseMove(e) {
  const rawPos  = getRawPos(e);
  app.mouse = getPos(e);

  if (app._panStart) {
    app.panX = app._panStart.panX + (rawPos.x - app._panStartMouse.x);
    app.panY = app._panStart.panY + (rawPos.y - app._panStartMouse.y);
    render();
    return;
  }

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
  // Hover over outlet/drain label boxes
  if (app.powerOutlet) {
    const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.powerOutlet;
    if (dist(pos.x, pos.y, x + labelOx, y + labelOy) <= UNIT_W / 2 + LABEL_HIT_MARGIN) {
      app.canvas.style.cursor = 'move';
      return;
    }
  }
  if (app.condensateDrain) {
    const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.condensateDrain;
    if (dist(pos.x, pos.y, x + labelOx, y + labelOy) <= UNIT_W / 2 + LABEL_HIT_MARGIN) {
      app.canvas.style.cursor = 'move';
      return;
    }
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
  if (e.button === 1) {
    app._panStart = null;
    return;
  }
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
      app.rooms.push({ x: rx, y: ry, w: rw, h: rh, label: 'Stanza', color: '#f5f5f0', type: 'room' });
      updateResults();
    }
    app.drawStart = null;
    render();
  }

  // Finish balcony draw on mouse-up
  if (app.tool === 'drawBalcony' && app.drawStart) {
    const s  = snap(getPos(e).x, getPos(e).y);
    const rx = Math.min(app.drawStart.x, s.x);
    const ry = Math.min(app.drawStart.y, s.y);
    const rw = Math.abs(s.x - app.drawStart.x);
    const rh = Math.abs(s.y - app.drawStart.y);
    if (rw >= GRID * 2 && rh >= GRID * 2) {
      saveHistory();
      app.rooms.push({ x: rx, y: ry, w: rw, h: rh, label: 'Balcone', color: '#e8f5e9', type: 'balcony' });
      updateResults();
    }
    app.drawStart = null;
    render();
  }

  // Finish stairs draw on mouse-up
  if (app.tool === 'drawStairs' && app.drawStart) {
    const s  = snap(getPos(e).x, getPos(e).y);
    const rx = Math.min(app.drawStart.x, s.x);
    const ry = Math.min(app.drawStart.y, s.y);
    const rw = Math.abs(s.x - app.drawStart.x);
    const rh = Math.abs(s.y - app.drawStart.y);
    if (rw >= GRID * 2 && rh >= GRID * 2) {
      saveHistory();
      app.stairs.push({ x: rx, y: ry, w: rw, h: rh, label: 'Scale' });
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
  if (app.tool === 'drawPowerPipe' && app.powerPipeWIP.length >= 2) {
    app.powerPipeWIP.pop();
    if (app.powerPipeWIP.length >= 2) completePipe();
    return;
  }
  if (app.tool === 'drawCondensaPipe' && app.condensatePipeWIP.length >= 2) {
    app.condensatePipeWIP.pop();
    if (app.condensatePipeWIP.length >= 2) completePipe();
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

    // Check stair elements
    const stairIdx = stairAt(raw.x, raw.y);
    if (stairIdx >= 0) {
      editStairLabel(stairIdx);
      return;
    }

    // Check room sides (precise border click → edit one dimension)
    const roomSide = roomSideAt(raw.x, raw.y);
    if (roomSide) {
      editRoomSideLength(roomSide.roomIndex, roomSide.side);
      return;
    }

    // Check room interior (click inside room → rename then edit dimensions)
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

/** Returns index of stair whose interior contains (px,py), or -1 if none. */
function stairAt(px, py) {
  for (let i = app.stairs.length - 1; i >= 0; i--) {
    const s = app.stairs[i];
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return i;
  }
  return -1;
}

/** Prompt user to rename a stair element. */
function editStairLabel(stairIdx) {
  const s = app.stairs[stairIdx];
  const input = prompt('Etichetta scala:', s.label || 'Scale');
  if (input === null) return;
  saveHistory();
  app.stairs[stairIdx].label = input.trim() || 'Scale';
  render();
  setStatus(`Scale rinominata: "${app.stairs[stairIdx].label}"`);
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
 * Prompt user to rename and/or resize a room (centre stays fixed).
 * First asks for the label, then for width and height.
 */
function editRoomDimensions(roomIdx) {
  const r = app.rooms[roomIdx];

  // Step 0: rename
  const labelInput = prompt('Nome stanza:', r.label);
  if (labelInput === null) return;  // cancelled
  const newLabel = labelInput.trim() || r.label;

  const currentW = (r.w / GRID) * app.metersPerCell;
  const currentH = (r.h / GRID) * app.metersPerCell;

  const wInput = prompt(
    `Larghezza "${newLabel}" (m):\n(attuale: ${currentW.toFixed(2)} m)`,
    currentW.toFixed(2)
  );
  if (wInput === null) return;
  const newW = parseFloat(wInput);
  if (!isFinite(newW) || newW <= 0) {
    alert('Valore non valido. Inserisci una larghezza positiva in metri.');
    return;
  }

  const hInput = prompt(
    `Profondità "${newLabel}" (m):\n(attuale: ${currentH.toFixed(2)} m)`,
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
  app.rooms[roomIdx].label = newLabel;
  app.rooms[roomIdx].w = newPxW;
  app.rooms[roomIdx].h = newPxH;
  app.rooms[roomIdx].x = Math.round((cx - newPxW / 2) / GRID) * GRID;
  app.rooms[roomIdx].y = Math.round((cy - newPxH / 2) / GRID) * GRID;
  updateResults();
  render();
  setStatus(`Stanza "${newLabel}" aggiornata: ${(newPxW / GRID * app.metersPerCell).toFixed(2)} m × ${(newPxH / GRID * app.metersPerCell).toFixed(2)} m`);
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    app.drawStart = null;
    app.wallStart = null;
    app.calibPt1  = null;
    app.pipeWIP   = [];
    app.powerPipeWIP = [];
    app.condensatePipeWIP = [];
    syncCompletePipeBtn();
    updateHint();
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
    if (unit && dist(pos.x, pos.y, unit.x, unit.y) <= UNIT_W / 2 + LABEL_HIT_MARGIN) {
      app.dragTarget = { type: 'indoor', index: i,
                          ox: pos.x - unit.x, oy: pos.y - unit.y };
      return;
    }
  }
  // Outdoor unit
  if (app.outdoorUnit &&
      dist(pos.x, pos.y, app.outdoorUnit.x, app.outdoorUnit.y) <= UNIT_W / 2 + LABEL_HIT_MARGIN) {
    app.dragTarget = { type: 'outdoor', ox: pos.x - app.outdoorUnit.x,
                                         oy: pos.y - app.outdoorUnit.y };
    return;
  }
  // Power outlet label box
  if (app.powerOutlet) {
    const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.powerOutlet;
    const lx = x + labelOx, ly = y + labelOy;
    if (dist(pos.x, pos.y, lx, ly) <= UNIT_W / 2 + LABEL_HIT_MARGIN) {
      app.dragTarget = { type: 'outletLabel', ox: pos.x - lx, oy: pos.y - ly };
      return;
    }
  }
  // Condensate drain label box
  if (app.condensateDrain) {
    const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.condensateDrain;
    const lx = x + labelOx, ly = y + labelOy;
    if (dist(pos.x, pos.y, lx, ly) <= UNIT_W / 2 + LABEL_HIT_MARGIN) {
      app.dragTarget = { type: 'drainLabel', ox: pos.x - lx, oy: pos.y - ly };
      return;
    }
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
  // Stairs (interior drag = move)
  for (let i = app.stairs.length - 1; i >= 0; i--) {
    const st = app.stairs[i];
    if (pos.x >= st.x && pos.x <= st.x + st.w &&
        pos.y >= st.y && pos.y <= st.y + st.h) {
      app.dragTarget = { type: 'stair', index: i,
                          ox: pos.x - st.x, oy: pos.y - st.y };
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
    case 'outletLabel': {
      if (app.powerOutlet) {
        app.powerOutlet.labelOx = pos.x - dt.ox - app.powerOutlet.x;
        app.powerOutlet.labelOy = pos.y - dt.oy - app.powerOutlet.y;
      }
      break;
    }
    case 'drainLabel': {
      if (app.condensateDrain) {
        app.condensateDrain.labelOx = pos.x - dt.ox - app.condensateDrain.x;
        app.condensateDrain.labelOy = pos.y - dt.oy - app.condensateDrain.y;
      }
      break;
    }
    case 'room': {
      app.rooms[dt.index].x = s.x;
      app.rooms[dt.index].y = s.y;
      break;
    }
    case 'stair': {
      app.stairs[dt.index].x = s.x;
      app.stairs[dt.index].y = s.y;
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
    case 'outletLabel': {
      if (!app.powerOutlet) return null;
      const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.powerOutlet;
      return { x: x + labelOx, y: y + labelOy };
    }
    case 'drainLabel': {
      if (!app.condensateDrain) return null;
      const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.condensateDrain;
      return { x: x + labelOx, y: y + labelOy };
    }
    case 'room':    return app.rooms[dt.index]
                           ? { x: app.rooms[dt.index].x, y: app.rooms[dt.index].y }
                           : null;
    case 'stair':   return app.stairs[dt.index]
                           ? { x: app.stairs[dt.index].x, y: app.stairs[dt.index].y }
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
  const tool = app.tool;
  if (tool === 'drawPowerPipe') {
    if (app.powerPipeWIP.length < 2) return;
    saveHistory();
    app.powerPipe = [...app.powerPipeWIP];
    app.powerPipeWIP = [];
    syncCompletePipeBtn(); render(); updateResults();
    selectTool('select');
    const r = calculatePowerCondensaResults();
    setStatus(`✅ Traccia corrente completata: ${r.power ? (r.power.totalMeters ?? r.power.meters).toFixed(1) + ' m — ' + r.power.crossings + ' pareti' : '—'}`);
    return;
  }
  if (tool === 'drawCondensaPipe') {
    if (app.condensatePipeWIP.length < 2) return;
    saveHistory();
    app.condensatePipe = [...app.condensatePipeWIP];
    app.condensatePipeWIP = [];
    syncCompletePipeBtn(); render(); updateResults();
    selectTool('select');
    const r = calculatePowerCondensaResults();
    setStatus(`✅ Traccia condensa completata: ${r.condensa ? r.condensa.meters.toFixed(1) + ' m — ' + r.condensa.crossings + ' pareti' : '—'}`);
    return;
  }
  // Original refrigerant pipe logic
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
    setStatus(`✅ Traccia ${app.activePipeIdx + 1} completata: ${r.totalMeters.toFixed(1)} m — ${r.crossings} pareti attraversate.`);
  }
}

function syncCompletePipeBtn() {
  const tool = app.tool;
  let hasWIP = false;
  if (tool === 'drawPipe')             hasWIP = app.pipeWIP.length >= 2;
  else if (tool === 'drawPowerPipe')   hasWIP = app.powerPipeWIP.length >= 2;
  else if (tool === 'drawCondensaPipe') hasWIP = app.condensatePipeWIP.length >= 2;
  document.getElementById('complete-pipe-btn').disabled = !hasWIP;
}

// ════════════════════════════════════════════════════════════════
//  Tool selection
// ════════════════════════════════════════════════════════════════
function selectTool(tool) {
  // Cancel any in-progress drawing (except pipe: keep WIP if switching back)
  if (tool !== app.tool) {
    app.drawStart = null;
    app.wallStart = null;
    app.calibPt1  = null;
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
    select:          'Clicca e trascina per spostare; doppio-clic su stanza per rinominare/ridimensionare',
    drawRoom:        'Trascina per disegnare una stanza',
    drawBalcony:     'Trascina per disegnare un balcone (bordo verde tratteggiato)',
    drawStairs:      'Trascina per disegnare una scala',
    drawWall:        'Clic punto iniziale, poi clic punto finale (solo ortogonale)',
    placeIndoor:     `Clic vicino a una parete per posizionare Split Int. ${t} (❄)`,
    placeOutdoor:    'Clic vicino a una parete per posizionare l\'unità esterna (🌡)',
    drawPipe:        `Traccia ${t}: clicca i punti del percorso — doppio-clic per completare`,
    placeOutlet:     'Clic vicino a una parete per posizionare la presa di corrente (🔌)',
    placeDrain:      'Clic vicino a una parete per posizionare lo scarico condensa (💧)',
    drawPowerPipe:   'Clicca i punti del percorso elettrico — doppio-clic per completare',
    drawCondensaPipe:'Clicca i punti del percorso condensa — doppio-clic per completare',
    calibrate:       app.calibPt1
      ? 'Calibrazione: clicca il 2° punto, poi inserisci la distanza reale in metri'
      : 'Calibrazione: clicca il 1° punto sulla planimetria',
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
    rooms:          app.rooms,
    manualWalls:    app.manualWalls,
    stairs:         app.stairs,
    indoorUnits:    app.indoorUnits,
    outdoorUnit:    app.outdoorUnit,
    indoorHeights:  app.indoorHeights,
    outdoorHeight:  app.outdoorHeight,
    pipes:          app.pipes,
    splitType:      app.splitType,
    activePipeIdx:  app.activePipeIdx,
    materials:      app.materials,
    powerOutlet:    app.powerOutlet,
    outletHeight:   app.outletHeight,
    condensateDrain: app.condensateDrain,
    powerPipe:      app.powerPipe,
    condensatePipe: app.condensatePipe,
    indoorNotes:    app.indoorNotes,
    outdoorNote:    app.outdoorNote,
    holesNote:      app.holesNote,
    generalNote:    app.generalNote,
  });
  app.history.push(snapshot);
  if (app.history.length > 40) app.history.shift();
}

function undo() {
  if (app.history.length === 0) return;
  const prev = JSON.parse(app.history.pop());
  app.rooms         = prev.rooms;
  app.manualWalls   = prev.manualWalls;
  app.stairs        = prev.stairs        ?? [];
  app.indoorUnits   = prev.indoorUnits   ?? [null];
  app.outdoorUnit   = prev.outdoorUnit   ?? null;
  app.indoorHeights = prev.indoorHeights ?? [0];
  app.outdoorHeight = prev.outdoorHeight ?? 0;
  app.pipes         = prev.pipes         ?? [[]];
  app.splitType     = prev.splitType     ?? 1;
  app.activePipeIdx = prev.activePipeIdx ?? 0;
  app.pipeWIP       = [];
  app.powerPipeWIP  = [];
  app.condensatePipeWIP = [];
  app.powerOutlet    = prev.powerOutlet    ?? null;
  app.outletHeight   = prev.outletHeight   ?? 0;
  app.condensateDrain  = prev.condensateDrain ?? null;
  app.powerPipe      = prev.powerPipe      ?? [];
  app.condensatePipe = prev.condensatePipe ?? [];
  if (prev.materials) {
    app.materials = prev.materials;
    MATERIALS_KEYS.forEach(key => {
      const el = document.getElementById('mat-' + key);
      if (el) el.checked = app.materials[key] || false;
    });
  }
  app.indoorNotes = prev.indoorNotes ?? ['', '', ''];
  app.outdoorNote = prev.outdoorNote ?? '';
  app.holesNote   = prev.holesNote   ?? '';
  app.generalNote = prev.generalNote ?? '';
  syncCompletePipeBtn();
  updateSplitUI();
  updateHeightUI();
  render();
  updateResults();
  setStatus('Azione annullata.');
}

// ════════════════════════════════════════════════════════════════
//  Clear actions
// ════════════════════════════════════════════════════════════════

/** Clear the active pipe trace (always the current split trace, ignoring tool). */
function clearActivePipeTrace() {
  saveHistory();
  app.pipes[app.activePipeIdx] = [];
  app.pipeWIP = [];
  setStatus(`Traccia ${app.activePipeIdx + 1} cancellata.`);
  syncCompletePipeBtn();
  render();
  updateResults();
}

/** Clear the power (outlets) pipe trace. */
function clearPowerPipeTrace() {
  saveHistory();
  app.powerPipe = []; app.powerPipeWIP = [];
  setStatus('Traccia prese cancellata.');
  syncCompletePipeBtn();
  render();
  updateResults();
}

/** Clear the condensate pipe trace. */
function clearCondensatePipeTrace() {
  saveHistory();
  app.condensatePipe = []; app.condensatePipeWIP = [];
  setStatus('Traccia condensa cancellata.');
  syncCompletePipeBtn();
  render();
  updateResults();
}

function clearAll() {
  if (!confirm('Cancellare tutto? Anche la cronologia undo verrà eliminata e non sarà possibile recuperare nulla.')) return;
  app.rooms         = [];
  app.manualWalls   = [];
  app.stairs        = [];
  app.indoorUnits   = [null];
  app.outdoorUnit   = null;
  app.indoorHeights = [0];
  app.outdoorHeight = 0;
  app.pipes         = [[]];
  app.pipeWIP           = [];
  app.powerOutlet       = null;
  app.outletHeight      = 0;
  app.condensateDrain   = null;
  app.powerPipe         = [];
  app.condensatePipe    = [];
  app.powerPipeWIP      = [];
  app.condensatePipeWIP = [];
  app.history           = [];
  app.drawStart     = null;
  app.wallStart     = null;
  app.splitType     = 1;
  app.activePipeIdx = 0;
  app.materials = { staffaUE: false, lavaggioImpianto: false, predisposizione: false };
  MATERIALS_KEYS.forEach(key => {
    const el = document.getElementById('mat-' + key);
    if (el) el.checked = false;
  });
  app.indoorNotes = ['', '', ''];
  app.outdoorNote = '';
  app.holesNote   = '';
  app.generalNote = '';
  syncCompletePipeBtn();
  updateSplitUI();
  updateHeightUI();
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
  while (app.pipes.length < n)         app.pipes.push([]);
  while (app.indoorUnits.length < n)   app.indoorUnits.push(null);
  while (app.indoorHeights.length < n) app.indoorHeights.push(0);
  while (app.indoorNotes.length < n)   app.indoorNotes.push('');
  // Clamp active index
  if (app.activePipeIdx >= n) app.activePipeIdx = n - 1;
  updateSplitUI();
  updateHeightUI();
  render();
  updateResults();
  setStatus(`Configurazione: ${n === 1 ? 'Singolo split' : n === 2 ? 'Dual split' : 'Trial split'}.`);
}

function setActivePipe(idx) {
  if (idx < 0 || idx >= app.splitType) return;
  // Discard WIP silently when switching traces
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

  updateHeightUI();
}

// ════════════════════════════════════════════════════════════════
//  Shorthand
// ════════════════════════════════════════════════════════════════
const id = s => document.getElementById(s);

// ════════════════════════════════════════════════════════════════
//  Zoom / pan
// ════════════════════════════════════════════════════════════════
function onWheel(e) {
  e.preventDefault();
  const raw    = getRawPos(e);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const newZoom = Math.max(0.15, Math.min(8, app.zoom * factor));
  app.panX = raw.x - (raw.x - app.panX) * (newZoom / app.zoom);
  app.panY = raw.y - (raw.y - app.panY) * (newZoom / app.zoom);
  app.zoom = newZoom;
  render();
}

// ════════════════════════════════════════════════════════════════
//  Height from ground UI
// ════════════════════════════════════════════════════════════════
function updateHeightUI() {
  const container = document.getElementById('heights-inputs');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < app.splitType; i++) {
    const label = document.createElement('label');
    label.className = 'height-item';
    const val = (app.indoorHeights && app.indoorHeights[i] != null) ? app.indoorHeights[i] : 0;
    const inputId = `height-indoor-${i}`;
    label.htmlFor = inputId;
    label.innerHTML = `INT.${i+1}: <input id="${inputId}" type="number" min="0" max="10" step="0.1" value="${val}"> m`;
    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      if (!app.indoorHeights) app.indoorHeights = [];
      app.indoorHeights[i] = parseFloat(input.value) || 0;
      updateResults();
      render();
    });
    container.appendChild(label);
  }

  const labelOut = document.createElement('label');
  labelOut.className = 'height-item';
  const outVal = app.outdoorHeight || 0;
  labelOut.htmlFor = 'height-outdoor';
  labelOut.innerHTML = `U.EST.: <input id="height-outdoor" type="number" min="0" max="10" step="0.1" value="${outVal}"> m`;
  const outInput = labelOut.querySelector('input');
  outInput.addEventListener('change', () => {
    app.outdoorHeight = parseFloat(outInput.value) || 0;
    updateResults();
    render();
  });
  container.appendChild(labelOut);

  const labelPres = document.createElement('label');
  labelPres.className = 'height-item';
  const presVal = app.outletHeight || 0;
  labelPres.htmlFor = 'height-outlet';
  labelPres.innerHTML = `PRESA: <input id="height-outlet" type="number" min="0" max="10" step="0.1" value="${presVal}"> m`;
  const presInput = labelPres.querySelector('input');
  presInput.addEventListener('change', () => {
    app.outletHeight = parseFloat(presInput.value) || 0;
    updateResults();
    render();
  });
  container.appendChild(labelPres);
  updateNotesUI();
}

// ════════════════════════════════════════════════════════════════
//  Print notes UI
// ════════════════════════════════════════════════════════════════
function updateNotesUI() {
  const container = document.getElementById('notes-inputs');
  if (!container) return;
  container.innerHTML = '';

  // Per-split indoor notes
  for (let i = 0; i < app.splitType; i++) {
    const wrap = document.createElement('label');
    wrap.className = 'note-item';
    const val = (app.indoorNotes && app.indoorNotes[i]) || '';
    const inputId = `note-indoor-${i}`;
    wrap.htmlFor = inputId;
    wrap.innerHTML =
      `<span class="note-lbl">Split INT.${i + 1}:</span>` +
      `<input id="${inputId}" class="note-input" type="text" maxlength="50" value="${_escHtml(val)}" placeholder="Nota split interno ${i + 1}…">`;
    const input = wrap.querySelector('input');
    input.addEventListener('input', () => {
      if (!app.indoorNotes) app.indoorNotes = [];
      app.indoorNotes[i] = input.value;
    });
    container.appendChild(wrap);
  }

  // Outdoor unit note
  const wrapOut = document.createElement('label');
  wrapOut.className = 'note-item';
  wrapOut.htmlFor = 'note-outdoor';
  wrapOut.innerHTML =
    `<span class="note-lbl">U. Esterna:</span>` +
    `<input id="note-outdoor" class="note-input" type="text" maxlength="50" value="${_escHtml(app.outdoorNote || '')}" placeholder="Nota unità esterna…">`;
  const outInput = wrapOut.querySelector('input');
  outInput.addEventListener('input', () => { app.outdoorNote = outInput.value; });
  container.appendChild(wrapOut);

  // Holes note
  const wrapHoles = document.createElement('label');
  wrapHoles.className = 'note-item';
  wrapHoles.htmlFor = 'note-holes';
  wrapHoles.innerHTML =
    `<span class="note-lbl">Fori totali:</span>` +
    `<input id="note-holes" class="note-input" type="text" maxlength="50" value="${_escHtml(app.holesNote || '')}" placeholder="Nota fori totali…">`;
  const holesInput = wrapHoles.querySelector('input');
  holesInput.addEventListener('input', () => { app.holesNote = holesInput.value; });
  container.appendChild(wrapHoles);

  // General note (textarea)
  const wrapGen = document.createElement('label');
  wrapGen.className = 'note-item';
  wrapGen.htmlFor = 'note-general';
  wrapGen.innerHTML =
    `<span class="note-lbl">Note generali:</span>` +
    `<textarea id="note-general" class="note-textarea" maxlength="500" rows="3" placeholder="Note da aggiungere in fondo alla stampa…">${_escHtml(app.generalNote || '')}</textarea>`;
  const genTextarea = wrapGen.querySelector('textarea');
  genTextarea.addEventListener('input', () => { app.generalNote = genTextarea.value; });
  container.appendChild(wrapGen);
}
function drawSpecialUnits() {
  const ctx = app.ctx;
  const hw = UNIT_W / 2, hh = UNIT_H / 2;

  if (app.powerOutlet) {
    const { x, y, angle = 0, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.powerOutlet;
    const lx = x + labelOx, ly = y + labelOy;

    // Anchor marker at wall position
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = POWER_COLOR;
    ctx.strokeStyle = POWER_DARK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Connecting line from anchor to label
    ctx.strokeStyle = POWER_DARK;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label box (speech bubble)
    ctx.save();
    ctx.translate(lx, ly);
    drawUnitBox(ctx, -hw, -hh, UNIT_W, UNIT_H, POWER_COLOR, POWER_DARK);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 7px Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔌 PRESA', 0, 0);
    ctx.restore();
  }

  if (app.condensateDrain) {
    const { x, y, angle = 0, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.condensateDrain;
    const lx = x + labelOx, ly = y + labelOy;

    // Anchor marker at wall position
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = CONDENSA_COLOR;
    ctx.strokeStyle = CONDENSA_DARK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Connecting line from anchor to label
    ctx.strokeStyle = CONDENSA_DARK;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label box (speech bubble)
    ctx.save();
    ctx.translate(lx, ly);
    drawUnitBox(ctx, -hw, -hh, UNIT_W, UNIT_H, CONDENSA_COLOR, CONDENSA_DARK);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 7px Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💧 SCAR.', 0, 0);
    ctx.restore();
  }
}

function drawPowerCondensaPipes() {
  const ctx = app.ctx;

  const drawTrace = (pts, wip, color, dark, label) => {
    const toDraw = pts.length >= 2 ? pts : (wip.length >= 2 ? wip : []);
    if (toDraw.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = PIPE_T;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([12, 6]);
    ctx.beginPath(); ctx.moveTo(toDraw[0].x, toDraw[0].y);
    for (let j = 1; j < toDraw.length; j++) ctx.lineTo(toDraw[j].x, toDraw[j].y);
    ctx.stroke(); ctx.setLineDash([]);
    for (let j = 1; j < toDraw.length; j++) {
      const d = dist(toDraw[j-1].x, toDraw[j-1].y, toDraw[j].x, toDraw[j].y);
      const m = (d / GRID) * app.metersPerCell;
      if (m >= 0.1) {
        const mx = (toDraw[j-1].x + toDraw[j].x) / 2;
        const my = (toDraw[j-1].y + toDraw[j].y) / 2;
        const sdx = toDraw[j].x - toDraw[j-1].x;
        const sdy = toDraw[j].y - toDraw[j-1].y;
        drawDistLabel(ctx, m.toFixed(1) + ' m', mx, my, dark, sdx, sdy);
      }
    }
    for (const pt of toDraw) pipeDot(ctx, pt.x, pt.y, color);
    drawTraceLabel(ctx, label, toDraw[0].x, toDraw[0].y, color);
  };

  drawTrace(app.powerPipe, app.powerPipeWIP, POWER_COLOR, POWER_DARK, '⚡');
  drawTrace(app.condensatePipe, app.condensatePipeWIP, CONDENSA_COLOR, CONDENSA_DARK, '💧');
}

function calculatePowerCondensaResults() {
  const walls = allWalls();
  const calc = (pipe) => {
    if (pipe.length < 2) return null;
    let px = 0;
    for (let j = 1; j < pipe.length; j++)
      px += dist(pipe[j-1].x, pipe[j-1].y, pipe[j].x, pipe[j].y);
    const meters = (px / GRID) * app.metersPerCell;
    const crossings = countUniqueCrossings(pipe, walls);
    return { meters, crossings };
  };

  const powerResult = calc(app.powerPipe);
  if (powerResult) {
    const conn = detectPowerPipeConnection();
    const outletH = app.outletHeight || 0;
    let heightDiff = 0;
    if (conn) {
      if (conn.type === 'outdoor') {
        heightDiff = Math.abs(outletH - (app.outdoorHeight || 0));
      } else if (conn.type === 'indoor') {
        const iH = (app.indoorHeights && app.indoorHeights[conn.index] != null)
          ? app.indoorHeights[conn.index] : 0;
        heightDiff = Math.abs(outletH - iH);
      }
    }
    powerResult.heightDiff = heightDiff;
    powerResult.totalMeters = powerResult.meters + heightDiff;
  }

  return { power: powerResult, condensa: calc(app.condensatePipe) };
}

/**
 * Detect whether the power pipe's endpoints are close to an AC unit.
 * Returns { type: 'outdoor' } if near the outdoor unit,
 *         { type: 'indoor', index: i } if near indoor unit i,
 *         null if no recognized connection.
 */
function detectPowerPipeConnection() {
  const pipe = app.powerPipe.length >= 2 ? app.powerPipe : app.powerPipeWIP;
  if (pipe.length < 2) return null;
  // Use a generous radius so snapped pipe endpoints reliably hit nearby units
  const CONNECT_R = UNIT_W * 2; // 64 px
  const pts = [pipe[0], pipe[pipe.length - 1]];
  for (const pt of pts) {
    if (app.outdoorUnit && dist(pt.x, pt.y, app.outdoorUnit.x, app.outdoorUnit.y) <= CONNECT_R)
      return { type: 'outdoor' };
    for (let i = 0; i < app.splitType; i++) {
      const unit = app.indoorUnits[i];
      if (unit && dist(pt.x, pt.y, unit.x, unit.y) <= CONNECT_R)
        return { type: 'indoor', index: i };
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
//  Print utility
// ════════════════════════════════════════════════════════════════

/** Minimal HTML-escape for safe injection into the print template. */
function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compute the bounding box (canvas pixels, world-space) of all drawn content.
 * Returns { x, y, w, h } or null if nothing is drawn yet.
 */
function getContentBoundingBox() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const exp = (x, y) => {
    if (x < minX) minX = x;  if (y < minY) minY = y;
    if (x > maxX) maxX = x;  if (y > maxY) maxY = y;
  };
  const halfW = WALL_T / 2;
  for (const r of app.rooms) {
    exp(r.x - halfW, r.y - halfW);
    exp(r.x + r.w + halfW, r.y + r.h + halfW);
  }
  for (const w of app.manualWalls) { exp(w.x1, w.y1); exp(w.x2, w.y2); }
  for (const s of app.stairs)      { exp(s.x, s.y); exp(s.x + s.w, s.y + s.h); }
  for (const u of app.indoorUnits) {
    if (u) { exp(u.x - UNIT_W, u.y - UNIT_H); exp(u.x + UNIT_W, u.y + UNIT_H); }
  }
  if (app.outdoorUnit) {
    const { x, y } = app.outdoorUnit;
    exp(x - UNIT_W, y - UNIT_H); exp(x + UNIT_W, y + UNIT_H);
  }
  if (app.powerOutlet) {
    const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.powerOutlet;
    exp(x, y); exp(x + labelOx, y + labelOy);
  }
  if (app.condensateDrain) {
    const { x, y, labelOx = DEFAULT_LABEL_OX, labelOy = DEFAULT_LABEL_OY } = app.condensateDrain;
    exp(x, y); exp(x + labelOx, y + labelOy);
  }
  for (let i = 0; i < app.splitType; i++)
    for (const p of (app.pipes[i] || [])) exp(p.x, p.y);
  for (const p of app.powerPipe)      exp(p.x, p.y);
  for (const p of app.condensatePipe) exp(p.x, p.y);

  return isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

/**
 * Render the complete floor plan (without in-progress lines or UI handles) to
 * an offscreen canvas scaled so the content fits TARGET_W pixels wide.
 * Returns a PNG data-URL, or null when nothing has been drawn yet.
 */
function renderPrintCanvas() {
  const bbox = getContentBoundingBox();
  if (!bbox || bbox.w < 1 || bbox.h < 1) return null;

  const PAD      = GRID * 1;    // padding around content (px world-space)
  const TARGET_W = 1400;        // output canvas pixel width (high-res for quality)

  const cw    = bbox.w + PAD * 2;
  const ch    = bbox.h + PAD * 2;
  const scale = TARGET_W / cw;

  const offCanvas    = document.createElement('canvas');
  offCanvas.width    = TARGET_W;
  offCanvas.height   = Math.ceil(ch * scale);

  // Save current render state
  const savedCtx    = app.ctx;
  const savedCanvas = app.canvas;
  const savedZoom   = app.zoom;
  const savedPanX   = app.panX;
  const savedPanY   = app.panY;

  // Override render state to target the offscreen canvas
  app.ctx    = offCanvas.getContext('2d');
  app.canvas = offCanvas;
  app.zoom   = scale;
  app.panX   = -(bbox.x - PAD) * scale;
  app.panY   = -(bbox.y - PAD) * scale;

  app.ctx.save();
  app.ctx.translate(app.panX, app.panY);
  app.ctx.scale(app.zoom, app.zoom);

  // Draw all permanent layers (same order as render(), minus in-progress / handles)
  drawGrid();
  drawBackground();
  drawRooms();
  drawRoomWallLabels();
  drawManualWalls();
  drawStairsLayer();
  drawAcUnits();
  drawSpecialUnits();
  drawPipe();
  drawPowerCondensaPipes();
  drawDrillingPoints();

  app.ctx.restore();

  const dataURL = offCanvas.toDataURL('image/png');

  // Restore render state
  app.ctx    = savedCtx;
  app.canvas = savedCanvas;
  app.zoom   = savedZoom;
  app.panX   = savedPanX;
  app.panY   = savedPanY;

  return dataURL;
}

/**
 * Build the full HTML string for the A4 print window.
 * @param {string} customerName
 * @param {string} dateStr       Formatted date string
 * @param {string|null} dataURL  PNG data-URL of the floor plan (or null)
 */
function buildPrintHTML(customerName, dateStr, dataURL) {
  const results   = calculateResults();
  const pcResults = calculatePowerCondensaResults();

  // ── Trace summary table ────────────────────────────────────────
  const hasAnyTrace = results.some(r => r !== null) || pcResults.power || pcResults.condensa;
  const showDelta   = results.some(r => r && r.heightDiff > 0) ||
                      (pcResults.power && (pcResults.power.heightDiff || 0) > 0);
  // Show a "Note" column in the trace table only when at least one indoor note is filled
  const showNoteCol = (app.indoorNotes || []).slice(0, app.splitType).some(n => n && n.trim());

  let traceRows = '';
  for (let i = 0; i < app.splitType; i++) {
    const r     = results[i];
    const color = PIPE_COLORS[i];
    const note  = _escHtml((app.indoorNotes && app.indoorNotes[i]) || '');
    if (r) {
      traceRows += `<tr>
        <td style="color:${color};font-weight:700">T${i + 1}</td>
        <td>${r.meters.toFixed(1)} m</td>
        ${showDelta ? `<td>${r.heightDiff > 0 ? r.heightDiff.toFixed(1) + ' m' : '—'}</td>` : ''}
        <td>${r.crossings}</td>
        ${showNoteCol ? `<td class="note-cell">${note}</td>` : ''}
      </tr>`;
    } else {
      traceRows += `<tr>
        <td style="color:${color};font-weight:700">T${i + 1}</td>
        <td colspan="${showDelta ? 3 : 2}" style="color:#aaa">—</td>
        ${showNoteCol ? `<td class="note-cell">${note}</td>` : ''}
      </tr>`;
    }
  }
  if (pcResults.power) {
    const pm = pcResults.power;
    traceRows += `<tr>
      <td style="color:${POWER_COLOR};font-weight:700">⚡ Corrente</td>
      <td>${(pm.totalMeters != null ? pm.totalMeters : pm.meters).toFixed(1)} m</td>
      ${showDelta ? `<td>${(pm.heightDiff || 0) > 0 ? pm.heightDiff.toFixed(1) + ' m' : '—'}</td>` : ''}
      <td>${pm.crossings}</td>
      ${showNoteCol ? '<td></td>' : ''}
    </tr>`;
  }
  if (pcResults.condensa) {
    const cm = pcResults.condensa;
    traceRows += `<tr>
      <td style="color:${CONDENSA_COLOR};font-weight:700">💧 Condensa</td>
      <td>${cm.meters.toFixed(1)} m</td>
      ${showDelta ? '<td>—</td>' : ''}
      <td>${cm.crossings}</td>
      ${showNoteCol ? '<td></td>' : ''}
    </tr>`;
  }

  const traceTableHTML = hasAnyTrace ? `
    <h2 class="sec-title">📐 Lunghezze tracce</h2>
    <table>
      <thead><tr>
        <th>Traccia</th>
        <th>Lunghezza tracciato</th>
        ${showDelta ? '<th>Δh altezze</th>' : ''}
        <th>Fori parete</th>
        ${showNoteCol ? '<th>Note</th>' : ''}
      </tr></thead>
      <tbody>${traceRows}</tbody>
    </table>` : '';

  // ── Drilling-point summary ─────────────────────────────────────
  const drillingPts  = collectDrillingPoints(true);  // only main refrigerant holes for total count
  const totalHoles   = drillingPts.length;
  const complexity   = complexityLabel(totalHoles);
  const holesNote    = (app.holesNote && app.holesNote.trim())
    ? ` <span class="inline-note">— ${_escHtml(app.holesNote)}</span>` : '';
  const holesHTML    = totalHoles > 0
    ? `<p class="info-row">🔩 <strong>Fori totali nelle pareti: ${totalHoles}</strong> — ${complexity.text}${holesNote}</p>`
    : '';

  // ── Outdoor unit note ──────────────────────────────────────────
  const outdoorNoteHTML = (app.outdoorNote && app.outdoorNote.trim())
    ? `<p class="info-row">🌡 <strong>Nota u. esterna:</strong> <span class="inline-note">${_escHtml(app.outdoorNote)}</span></p>`
    : '';

  // ── Materials / works ──────────────────────────────────────────
  const MAT_LABELS = {
    staffaUE:         'Staffa unità esterna',
    lavaggioImpianto: 'Lavaggio impianto',
    predisposizione:  'Predisposizione'
  };
  const checkedMats = MATERIALS_KEYS.filter(k => app.materials[k]);
  const materialsHTML = checkedMats.length > 0 ? `
    <h2 class="sec-title">🔧 Materiali / Lavorazioni</h2>
    <ul class="mat-list">
      ${checkedMats.map(k => `<li>${MAT_LABELS[k]}</li>`).join('')}
    </ul>` : '';

  // ── General note ───────────────────────────────────────────────
  const generalNoteHTML = (app.generalNote && app.generalNote.trim())
    ? `<div class="general-note-wrap">
        <h2 class="sec-title">📝 Note</h2>
        <p class="general-note">${_escHtml(app.generalNote).replace(/\n/g, '<br>')}</p>
      </div>` : '';

  // ── Floor plan image ───────────────────────────────────────────
  const imgHTML = dataURL
    ? `<img src="${dataURL}" alt="Planimetria" class="floor-img" />`
    : `<p style="color:#aaa;text-align:center">(nessuna planimetria disegnata)</p>`;

  const safeCustomer = _escHtml(customerName || '—');
  const safeDate     = _escHtml(dateStr);

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Preventivo${customerName ? ' \u2014 ' + _escHtml(customerName) : ''}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10.5pt;
      color: #202124;
      background: #fff;
    }
    /* Header */
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 3px solid #1565C0;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .app-name { font-size: 13pt; font-weight: 700; color: #1565C0; }
    .meta     { text-align: right; font-size: 10pt; line-height: 1.6; }
    .meta .customer { font-weight: 700; font-size: 11.5pt; }
    /* Floor plan */
    .floor-wrap { text-align: center; margin-bottom: 10px; }
    .floor-img  { max-width: 100%; border: 1px solid #dadce0; display: block; margin: 0 auto; }
    /* Summary */
    .sec-title {
      font-size: 11pt; font-weight: 700; color: #1565C0;
      margin: 10px 0 5px; border-bottom: 1px solid #dadce0; padding-bottom: 3px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 6px; }
    th { background: #1565C0; color: #fff; padding: 5px 8px; text-align: left; }
    td { border: 1px solid #dadce0; padding: 4px 8px; }
    tr:nth-child(even) td { background: #f8f9fa; }
    .note-cell { font-style: italic; color: #5f6368; }
    .info-row  { margin: 6px 0; font-size: 10.5pt; }
    .inline-note { font-style: italic; color: #5f6368; }
    .mat-list  { padding-left: 18px; font-size: 10pt; line-height: 1.9; }
    /* General note */
    .general-note-wrap { margin-top: 10px; }
    .general-note { font-size: 10.5pt; line-height: 1.6; white-space: pre-wrap; }
    /* Footer */
    .print-footer {
      margin-top: 14px; text-align: center;
      font-size: 8.5pt; color: #80868b;
      border-top: 1px solid #dadce0; padding-top: 4px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="app-name">${LOGO_DATA_URL ? `<img src="${LOGO_DATA_URL}" alt="Logo" style="height:56px;width:auto;display:block;margin-bottom:2px" />` : ''}</div>
    <div class="meta">
      <div class="customer">Cliente: ${safeCustomer}</div>
      <div>Data: ${safeDate}</div>
    </div>
  </div>

  <div class="floor-wrap">${imgHTML}</div>

  <div class="summary">
    ${traceTableHTML}
    ${holesHTML}
    ${outdoorNoteHTML}
    ${materialsHTML}
    ${generalNoteHTML}
  </div>

  <div class="print-footer">
    Documento generato automaticamente — ${safeDate}
  </div>

  <script>
    // Auto-open print dialog once the image has loaded
    (function () {
      var img = document.querySelector('.floor-img');
      if (img) {
        img.addEventListener('load', function () { setTimeout(window.print, 300); });
      } else {
        setTimeout(window.print, 300);
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * Ask for customer name, render floor plan, build HTML and open print dialog.
 * Triggered by the 🖨 Stampa A4 button.
 */
function printReport() {
  const customerName = prompt('Nome del cliente (Invio per lasciare vuoto):', '');
  if (customerName === null) return; // user pressed Cancel

  const dateStr = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const dataURL = renderPrintCanvas();
  const html    = buildPrintHTML(customerName.trim(), dateStr, dataURL);

  const pw = window.open('', '_blank', 'width=960,height=820,menubar=yes,toolbar=yes');
  if (!pw) {
    alert('Il browser ha bloccato il popup.\nAbilita i popup per questo sito e riprova.');
    return;
  }
  pw.document.open();
  pw.document.write(html);
  pw.document.close();
}

// ════════════════════════════════════════════════════════════════
//  Saved Projects  (localStorage)
// ════════════════════════════════════════════════════════════════
const PROJECTS_KEY = 'climaProjects';

function getStoredProjects() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'); }
  catch (e) { return []; }
}

function _saveStoredProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

/** Snapshot the current app state (same fields as saveHistory). */
function _projectSnapshot() {
  return JSON.stringify({
    rooms:           app.rooms,
    manualWalls:     app.manualWalls,
    stairs:          app.stairs,
    indoorUnits:     app.indoorUnits,
    outdoorUnit:     app.outdoorUnit,
    indoorHeights:   app.indoorHeights,
    outdoorHeight:   app.outdoorHeight,
    pipes:           app.pipes,
    splitType:       app.splitType,
    activePipeIdx:   app.activePipeIdx,
    materials:       app.materials,
    powerOutlet:     app.powerOutlet,
    outletHeight:    app.outletHeight,
    condensateDrain: app.condensateDrain,
    powerPipe:       app.powerPipe,
    condensatePipe:  app.condensatePipe,
    metersPerCell:   app.metersPerCell,
    indoorNotes:     app.indoorNotes,
    outdoorNote:     app.outdoorNote,
    holesNote:       app.holesNote,
    generalNote:     app.generalNote,
  });
}

function saveProject() {
  const name = prompt('Nome del progetto:', '');
  if (name === null) return; // cancelled
  const projectName = name.trim() || 'Progetto senza nome';

  const project = {
    id:      (typeof crypto !== 'undefined' && crypto.randomUUID)
               ? crypto.randomUUID()
               : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name:    projectName,
    savedAt: Date.now(),
    state:   _projectSnapshot(),
  };

  const projects = getStoredProjects();
  projects.unshift(project); // newest first
  _saveStoredProjects(projects);
  renderHomepageProjects('');
  setStatus(`Progetto "${projectName}" salvato.`);
}

function loadProject(id) {
  const projects = getStoredProjects();
  const project  = projects.find(p => p.id === id);
  if (!project) return;

  if (!confirm(`Caricare il progetto "${project.name}"?\nLe modifiche non salvate andranno perse.`)) return;

  saveHistory(); // allow undo back to current state

  try {
    const s = JSON.parse(project.state);
    app.rooms            = s.rooms            ?? [];
    app.manualWalls      = s.manualWalls      ?? [];
    app.stairs           = s.stairs           ?? [];
    app.indoorUnits      = s.indoorUnits      ?? [null];
    app.outdoorUnit      = s.outdoorUnit      ?? null;
    app.indoorHeights    = s.indoorHeights    ?? [0];
    app.outdoorHeight    = s.outdoorHeight    ?? 0;
    app.pipes            = s.pipes            ?? [[]];
    app.splitType        = s.splitType        ?? 1;
    app.activePipeIdx    = s.activePipeIdx    ?? 0;
    app.materials        = s.materials        ?? { staffaUE: false, lavaggioImpianto: false, predisposizione: false };
    app.powerOutlet      = s.powerOutlet      ?? null;
    app.outletHeight     = s.outletHeight     ?? 0;
    app.condensateDrain  = s.condensateDrain  ?? null;
    app.powerPipe        = s.powerPipe        ?? [];
    app.condensatePipe   = s.condensatePipe   ?? [];
    app.metersPerCell    = s.metersPerCell     ?? 0.5;
    app.indoorNotes      = s.indoorNotes      ?? ['', '', ''];
    app.outdoorNote      = s.outdoorNote      ?? '';
    app.holesNote        = s.holesNote        ?? '';
    app.generalNote      = s.generalNote      ?? '';
    app.pipeWIP          = [];
    app.powerPipeWIP     = [];
    app.condensatePipeWIP = [];

    // Sync materials checkboxes
    MATERIALS_KEYS.forEach(key => {
      const el = document.getElementById('mat-' + key);
      if (el) el.checked = app.materials[key] || false;
    });

    // Sync scale input
    const scaleInput = document.getElementById('scale-input');
    if (scaleInput) scaleInput.value = app.metersPerCell;

    syncCompletePipeBtn();
    updateSplitUI();
    updateHeightUI();
    showDesignScreen();
    setStatus(`Progetto "${project.name}" caricato.`);
  } catch (e) {
    console.error('loadProject error:', e);
    setStatus('Errore nel caricamento del progetto.');
  }
}

function renameProject(id) {
  const projects = getStoredProjects();
  const project  = projects.find(p => p.id === id);
  if (!project) return;
  const newName = prompt('Rinomina il progetto:', project.name);
  if (newName === null) return; // cancelled
  const trimmed = newName.trim();
  if (!trimmed) return;
  project.name = trimmed;
  _saveStoredProjects(projects);
  renderHomepageProjects(document.getElementById('hp-search-input').value.trim());
  setStatus(`Progetto rinominato in "${trimmed}".`);
}

function deleteProject(id) {
  const projects = getStoredProjects();
  const project  = projects.find(p => p.id === id);
  if (!project) return;
  if (!confirm(`Eliminare il progetto "${project.name}"?`)) return;
  _saveStoredProjects(projects.filter(p => p.id !== id));
  renderHomepageProjects(document.getElementById('hp-search-input').value.trim());
  setStatus(`Progetto "${project.name}" eliminato.`);
}

/** Render the projects list on the homepage, optionally filtered by name. */
function renderHomepageProjects(filter) {
  const container = document.getElementById('hp-projects-list');
  if (!container) return;
  const all      = getStoredProjects();
  const q        = (filter || '').toLowerCase();
  const projects = q ? all.filter(p => p.name.toLowerCase().includes(q)) : all;
  container.innerHTML = '';
  if (projects.length === 0) {
    container.innerHTML = `<p class="hp-no-projects">${q ? 'Nessun progetto trovato.' : 'Nessun progetto salvato. Crea un nuovo progetto per iniziare!'}</p>`;
    return;
  }
  for (const p of projects) {
    const item = document.createElement('div');
    item.className = 'hp-project-item';
    item.innerHTML =
      `<span class="hp-proj-icon">📁</span>` +
      `<div class="hp-proj-info">` +
        `<div class="hp-proj-name">${_escHtml(p.name)}</div>` +
        `<div class="hp-proj-date">${_escHtml(new Date(p.savedAt).toLocaleString('it-IT'))}</div>` +
      `</div>` +
      `<div class="hp-proj-actions">` +
        `<button class="hp-proj-btn" data-action="load"   title="Apri progetto">📂 Apri</button>` +
        `<button class="hp-proj-btn rename" data-action="rename" title="Rinomina progetto">✏ Rinomina</button>` +
        `<button class="hp-proj-btn del"    data-action="delete" title="Elimina progetto">🗑 Elimina</button>` +
      `</div>`;
    item.querySelector('[data-action="load"]')  .addEventListener('click', () => loadProject(p.id));
    item.querySelector('[data-action="rename"]').addEventListener('click', () => renameProject(p.id));
    item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProject(p.id));
    container.appendChild(item);
  }
}

/** Legacy – kept so any internal calls still work. */
function renderProjectsList() {
  renderHomepageProjects(
    (document.getElementById('hp-search-input') || {}).value || ''
  );
}

// ════════════════════════════════════════════════════════════════
//  Gestione Listini  (price-list management)
// ════════════════════════════════════════════════════════════════
const LISTINI_KEY = 'climaListini';

/** Fixed row definitions – do NOT change keys once in production (they are used as storage keys). */
const LISTINI_ROWS = [
  { key: 'mono_pred',    label: 'Installazione mono – predisposizione/sostituzione' },
  { key: 'mono_new',     label: 'Installazione mono – nuovo impianto parete/parete' },
  { key: 'dual_pred',    label: 'Installazione dual – predisposizione/sostituzione' },
  { key: 'dual_new',     label: 'Installazione dual – nuovo impianto 3m linea' },
  { key: 'trial_pred',   label: 'Installazione trial – predisposizione/sostituzione' },
  { key: 'trial_new',    label: 'Installazione trial – nuovo impianto 3m linea' },
  { key: 'staffa_mono',  label: 'Staffa mono' },
  { key: 'staffa_multi', label: 'Staffa multi' },
  { key: 'linea_mt',     label: 'Costo linea al metro (oltre 3 m)' },
  { key: 'condensa_mt',  label: 'Costo linea condensa al metro (oltre 2 m)' },
  { key: 'corrente_mt',  label: 'Costo linea corrente al metro (oltre 2 m)' },
  { key: 'ponteggio',    label: 'Ponteggio' },
];

const LISTINI_MAX_COLS = 4;

function getStoredListini() {
  try {
    const raw = localStorage.getItem(LISTINI_KEY);
    if (!raw) return { installers: [], prices: {} };
    return JSON.parse(raw);
  } catch (e) {
    return { installers: [], prices: {} };
  }
}

function _saveStoredListini(data) {
  localStorage.setItem(LISTINI_KEY, JSON.stringify(data));
}

/**
 * (Re-)render the price-list table inside #listini-container.
 * Called each time the settings modal opens, or after any edit.
 */
function renderListiniModal() {
  const container = document.getElementById('listini-container');
  if (!container) return;

  const data = getStoredListini();
  const numCols = data.installers.length;
  const canAdd  = numCols < LISTINI_MAX_COLS;

  // ── Toolbar ────────────────────────────────────────────────────
  let html = '<div class="listini-toolbar">';
  html += `<span class="listini-toolbar-info">` +
    (numCols === 0
      ? 'Nessun installatore aggiunto ancora. Aggiungi una colonna per inserire i prezzi.'
      : `${numCols} installatore${numCols > 1 ? 'i' : ''} configurato${numCols > 1 ? 'i' : ''}`) +
    `</span>`;
  html += `<button class="listini-add-btn" id="listini-add-btn"${canAdd ? '' : ' disabled'}>` +
    `＋ Aggiungi installatore</button>`;
  html += '</div>';

  // ── Empty state (no columns yet) ───────────────────────────────
  if (numCols === 0) {
    html += `<div class="listini-empty-state">` +
      `<strong>Nessun listino presente</strong>` +
      `Clicca <em>"Aggiungi installatore"</em> per creare la prima colonna di prezzi.` +
      `</div>`;
    container.innerHTML = html;
    _bindListiniEvents(container, data);
    return;
  }

  // ── Table ──────────────────────────────────────────────────────
  html += '<div class="listini-scroll"><table class="listini-table"><thead><tr>';
  html += '<th class="listini-th-label">Lavorazione</th>';

  data.installers.forEach((name, idx) => {
    html += `<th class="listini-th-installer">` +
      `<div class="listini-installer-header">` +
        `<span class="listini-installer-name" title="${_escHtml(name)}">${_escHtml(name)}</span>` +
        `<div class="listini-installer-actions">` +
          `<button class="listini-icon-btn" data-action="rename-col" data-col="${idx}" title="Rinomina">✏</button>` +
          `<button class="listini-icon-btn danger" data-action="delete-col" data-col="${idx}" title="Elimina colonna">🗑</button>` +
        `</div>` +
      `</div>` +
    `</th>`;
  });

  html += '</tr></thead><tbody>';

  LISTINI_ROWS.forEach(row => {
    html += `<tr><td class="listini-td-label">${_escHtml(row.label)}</td>`;
    data.installers.forEach((_, idx) => {
      const val = (data.prices[row.key] && data.prices[row.key][idx] !== undefined)
        ? data.prices[row.key][idx] : '';
      html += `<td class="listini-td-price">` +
        `<div class="listini-price-wrap">` +
          `<span class="listini-price-currency">€</span>` +
          `<input class="listini-price-input" type="number" min="0" step="0.50"` +
            ` data-row="${row.key}" data-col="${idx}"` +
            ` value="${_escHtml(String(val))}" placeholder="—">` +
        `</div>` +
      `</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
  _bindListiniEvents(container, data);
}

/** Attach all event listeners to the rendered listini markup. */
function _bindListiniEvents(container, data) {
  // Add column
  const addBtn = document.getElementById('listini-add-btn');
  if (addBtn && !addBtn.disabled) {
    addBtn.addEventListener('click', () => {
      const fresh = getStoredListini();
      if (fresh.installers.length >= LISTINI_MAX_COLS) return;
      const name = prompt(
        'Nome del nuovo installatore:',
        'Installatore ' + (fresh.installers.length + 1)
      );
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      fresh.installers.push(trimmed);
      _saveStoredListini(fresh);
      renderListiniModal();
    });
  }

  // Rename column
  container.querySelectorAll('[data-action="rename-col"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const col   = parseInt(btn.dataset.col, 10);
      const fresh = getStoredListini();
      const cur   = fresh.installers[col] || '';
      const name  = prompt('Nuovo nome installatore:', cur);
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      fresh.installers[col] = trimmed;
      _saveStoredListini(fresh);
      renderListiniModal();
    });
  });

  // Delete column
  container.querySelectorAll('[data-action="delete-col"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const col   = parseInt(btn.dataset.col, 10);
      const fresh = getStoredListini();
      if (!confirm(`Eliminare la colonna "${fresh.installers[col]}" e tutti i prezzi associati?`)) return;
      fresh.installers.splice(col, 1);
      // Remap column indices in prices (shift down)
      Object.keys(fresh.prices).forEach(rowKey => {
        const rowPrices = fresh.prices[rowKey];
        const newRow    = {};
        Object.keys(rowPrices).forEach(c => {
          const ci = parseInt(c, 10);
          if (ci < col)       newRow[ci]     = rowPrices[c];
          else if (ci > col)  newRow[ci - 1] = rowPrices[c];
          // ci === col: dropped
        });
        fresh.prices[rowKey] = newRow;
      });
      _saveStoredListini(fresh);
      renderListiniModal();
    });
  });

  // Price inputs – save on change (blur / Enter)
  container.querySelectorAll('.listini-price-input').forEach(input => {
    input.addEventListener('change', e => {
      const rowKey = e.target.dataset.row;
      const col    = parseInt(e.target.dataset.col, 10);
      const val    = e.target.value.trim();
      const fresh  = getStoredListini();
      if (!fresh.prices[rowKey]) fresh.prices[rowKey] = {};
      if (val === '') {
        delete fresh.prices[rowKey][col];
      } else {
        fresh.prices[rowKey][col] = val;
      }
      _saveStoredListini(fresh);
    });
  });
}

// ════════════════════════════════════════════════════════════════
//  Boot
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
