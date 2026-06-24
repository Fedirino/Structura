// ============================================
// STRUCTURA — Layout Planner
// 2D grid editor with multi-layer support
// ============================================

function initLayoutPlanner(gameData) {
  'use strict';

  const GRID_SIZE = 60;
  const CELL_PX = 24;         // pixels per cell at zoom=1
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 3;
  const LAYERS = ['basement', 'ground', 'upper', 'roof'];
  const LAYER_LABELS = { basement: 'Basement', ground: 'Ground', upper: 'Upper', roof: 'Roof' };

  // --- Build the full palette from game data ---
  const palette = [];
  // Generators (produce power)
  gameData.generators.forEach(g => {
    palette.push({
      id: g.id, name: g.name, w: g.gridW, h: g.gridH,
      color: g.color, abbrev: g.abbrev, category: 'Generator',
      powerOutput: g.powerOutput, powerDraw: 0
    });
  });
  // Consumers (draw power)
  gameData.powerConsumers.forEach(c => {
    palette.push({
      id: c.id, name: c.name, w: c.gridW, h: c.gridH,
      color: c.color, abbrev: c.abbrev, category: c.category,
      powerOutput: 0, powerDraw: c.powerDraw
    });
  });
  // Structural (no power)
  gameData.structural.forEach(s => {
    palette.push({
      id: s.id, name: s.name, w: s.gridW, h: s.gridH,
      color: s.color, abbrev: s.abbrev, category: s.category,
      powerOutput: 0, powerDraw: 0
    });
  });

  const paletteMap = {};
  palette.forEach(p => (paletteMap[p.id] = p));

  // --- State ---
  const state = {
    activeLayer: 'ground',
    layers: {},
    selectedBuilding: null,  // palette item or null
    zoom: 1,
    panX: 0, panY: 0,
    isPanning: false,
    panStartX: 0, panStartY: 0,
    panStartPanX: 0, panStartPanY: 0,
    hoverCell: null,         // {x, y} or null
    paletteFilter: 'all',
    tool: 'place'            // 'place', 'erase', 'move'
  };

  // Init layers
  LAYERS.forEach(l => {
    state.layers[l] = { buildings: [] }; // [{id, buildingId, x, y, w, h}]
  });

  // --- Canvas setup ---
  const canvas = document.getElementById('layout-canvas');
  const ctx = canvas.getContext('2d');
  let canvasW, canvasH;

  function resizeCanvas() {
    const container = canvas.parentElement;
    canvasW = container.clientWidth;
    canvasH = container.clientHeight;
    canvas.width = canvasW * devicePixelRatio;
    canvas.height = canvasH * devicePixelRatio;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    render();
  }

  // --- Coordinate helpers ---
  function screenToGrid(sx, sy) {
    const gx = Math.floor((sx - state.panX) / (CELL_PX * state.zoom));
    const gy = Math.floor((sy - state.panY) / (CELL_PX * state.zoom));
    return { x: gx, y: gy };
  }

  function gridToScreen(gx, gy) {
    return {
      x: gx * CELL_PX * state.zoom + state.panX,
      y: gy * CELL_PX * state.zoom + state.panY
    };
  }

  function isInGrid(gx, gy) {
    return gx >= 0 && gy >= 0 && gx < GRID_SIZE && gy < GRID_SIZE;
  }

  // --- Collision detection ---
  function getBuildingAt(layer, gx, gy) {
    return state.layers[layer].buildings.find(b =>
      gx >= b.x && gx < b.x + b.w && gy >= b.y && gy < b.y + b.h
    );
  }

  function canPlace(layer, bx, by, bw, bh, excludeId) {
    // Check grid bounds
    if (bx < 0 || by < 0 || bx + bw > GRID_SIZE || by + bh > GRID_SIZE) return false;
    // Check collisions
    return !state.layers[layer].buildings.some(b => {
      if (excludeId && b.id === excludeId) return false;
      return bx < b.x + b.w && bx + bw > b.x && by < b.y + b.h && by + bh > b.y;
    });
  }

  // --- Place / remove ---
  let nextBuildingId = 1;

  function placeBuilding(layer, buildingId, gx, gy) {
    const def = paletteMap[buildingId];
    if (!def) return false;
    if (!canPlace(layer, gx, gy, def.w, def.h)) return false;
    state.layers[layer].buildings.push({
      id: nextBuildingId++,
      buildingId: buildingId,
      x: gx, y: gy,
      w: def.w, h: def.h
    });
    updatePowerSummary();
    return true;
  }

  function removeBuilding(layer, instanceId) {
    const idx = state.layers[layer].buildings.findIndex(b => b.id === instanceId);
    if (idx !== -1) {
      state.layers[layer].buildings.splice(idx, 1);
      updatePowerSummary();
    }
  }

  function clearLayer(layer) {
    state.layers[layer].buildings = [];
    updatePowerSummary();
    render();
  }

  function clearAll() {
    LAYERS.forEach(l => (state.layers[l].buildings = []));
    updatePowerSummary();
    render();
  }

  // --- Render ---
  function render() {
    const cellSize = CELL_PX * state.zoom;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background
    ctx.fillStyle = '#12100d';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Grid lines
    ctx.strokeStyle = 'rgba(92, 74, 53, 0.3)';
    ctx.lineWidth = 0.5;

    const startCell = screenToGrid(0, 0);
    const endCell = screenToGrid(canvasW, canvasH);
    const drawStartX = Math.max(0, startCell.x);
    const drawStartY = Math.max(0, startCell.y);
    const drawEndX = Math.min(GRID_SIZE, endCell.x + 2);
    const drawEndY = Math.min(GRID_SIZE, endCell.y + 2);

    ctx.beginPath();
    for (let x = drawStartX; x <= drawEndX; x++) {
      const sx = x * cellSize + state.panX;
      ctx.moveTo(sx, Math.max(0, state.panY));
      ctx.lineTo(sx, Math.min(canvasH, GRID_SIZE * cellSize + state.panY));
    }
    for (let y = drawStartY; y <= drawEndY; y++) {
      const sy = y * cellSize + state.panY;
      ctx.moveTo(Math.max(0, state.panX), sy);
      ctx.lineTo(Math.min(canvasW, GRID_SIZE * cellSize + state.panX), sy);
    }
    ctx.stroke();

    // Grid border
    ctx.strokeStyle = 'rgba(212, 146, 42, 0.4)';
    ctx.lineWidth = 1.5;
    const originScreen = gridToScreen(0, 0);
    const endScreen = gridToScreen(GRID_SIZE, GRID_SIZE);
    ctx.strokeRect(originScreen.x, originScreen.y,
      endScreen.x - originScreen.x, endScreen.y - originScreen.y);

    // Coordinate labels (every 10 cells if zoomed enough)
    if (state.zoom >= 0.5) {
      ctx.fillStyle = 'rgba(168, 152, 128, 0.5)';
      ctx.font = `${Math.max(8, 10 * state.zoom)}px system-ui`;
      ctx.textAlign = 'center';
      for (let x = 0; x <= GRID_SIZE; x += 10) {
        const s = gridToScreen(x, 0);
        ctx.fillText(x, s.x, s.y - 4);
      }
      ctx.textAlign = 'right';
      for (let y = 0; y <= GRID_SIZE; y += 10) {
        const s = gridToScreen(0, y);
        ctx.fillText(y, s.x - 4, s.y + 4);
      }
    }

    // Placed buildings
    const buildings = state.layers[state.activeLayer].buildings;
    buildings.forEach(b => {
      const def = paletteMap[b.buildingId];
      if (!def) return;
      const s = gridToScreen(b.x, b.y);
      const w = b.w * cellSize;
      const h = b.h * cellSize;

      // Fill
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(s.x + 1, s.y + 1, w - 2, h - 2);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x + 1, s.y + 1, w - 2, h - 2);

      // Label
      if (cellSize >= 14) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.min(11, cellSize * 0.45)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(def.abbrev, s.x + w / 2, s.y + h / 2 + 4);
      }
    });

    // Ghost preview (hover)
    if (state.selectedBuilding && state.hoverCell && state.tool === 'place') {
      const def = state.selectedBuilding;
      const gx = state.hoverCell.x;
      const gy = state.hoverCell.y;
      const valid = canPlace(state.activeLayer, gx, gy, def.w, def.h);
      const s = gridToScreen(gx, gy);
      const w = def.w * cellSize;
      const h = def.h * cellSize;

      ctx.globalAlpha = 0.4;
      ctx.fillStyle = valid ? def.color : '#c9302c';
      ctx.fillRect(s.x + 1, s.y + 1, w - 2, h - 2);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = valid ? 'rgba(255,255,255,0.5)' : 'rgba(201,48,44,0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(s.x + 1, s.y + 1, w - 2, h - 2);
      ctx.setLineDash([]);

      if (cellSize >= 14) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.min(11, cellSize * 0.45)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(def.abbrev, s.x + w / 2, s.y + h / 2 + 4);
      }
    }

    // Erase hover highlight
    if (state.tool === 'erase' && state.hoverCell) {
      const b = getBuildingAt(state.activeLayer, state.hoverCell.x, state.hoverCell.y);
      if (b) {
        const s = gridToScreen(b.x, b.y);
        const w = b.w * cellSize;
        const h = b.h * cellSize;
        ctx.strokeStyle = '#c9302c';
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x, s.y, w, h);
        // X
        ctx.beginPath();
        ctx.moveTo(s.x + 3, s.y + 3);
        ctx.lineTo(s.x + w - 3, s.y + h - 3);
        ctx.moveTo(s.x + w - 3, s.y + 3);
        ctx.lineTo(s.x + 3, s.y + h - 3);
        ctx.strokeStyle = 'rgba(201,48,44,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // --- Mouse events ---
  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('mousedown', e => {
    const pos = getMousePos(e);

    // Middle button or right button = pan
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      state.isPanning = true;
      state.panStartX = pos.x;
      state.panStartY = pos.y;
      state.panStartPanX = state.panX;
      state.panStartPanY = state.panY;
      canvas.style.cursor = 'grabbing';
      return;
    }

    // Left click — also pan if holding space (handled via tool), or place/erase
    if (e.button === 0) {
      const cell = screenToGrid(pos.x, pos.y);
      if (!isInGrid(cell.x, cell.y)) return;

      if (state.tool === 'place' && state.selectedBuilding) {
        if (placeBuilding(state.activeLayer, state.selectedBuilding.id, cell.x, cell.y)) {
          render();
        }
      } else if (state.tool === 'erase') {
        const b = getBuildingAt(state.activeLayer, cell.x, cell.y);
        if (b) {
          removeBuilding(state.activeLayer, b.id);
          render();
        }
      }
    }
  });

  canvas.addEventListener('mousemove', e => {
    const pos = getMousePos(e);

    if (state.isPanning) {
      state.panX = state.panStartPanX + (pos.x - state.panStartX);
      state.panY = state.panStartPanY + (pos.y - state.panStartY);
      render();
      return;
    }

    const cell = screenToGrid(pos.x, pos.y);
    if (isInGrid(cell.x, cell.y)) {
      state.hoverCell = cell;
      // Update coords display
      const coordsEl = document.getElementById('grid-coords');
      if (coordsEl) coordsEl.textContent = `${cell.x}, ${cell.y}`;
    } else {
      state.hoverCell = null;
    }
    render();
  });

  canvas.addEventListener('mouseup', e => {
    if (state.isPanning) {
      state.isPanning = false;
      canvas.style.cursor = state.tool === 'erase' ? 'crosshair' : 'default';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoverCell = null;
    if (state.isPanning) {
      state.isPanning = false;
      canvas.style.cursor = 'default';
    }
    render();
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const pos = getMousePos(e);
    const gridBefore = screenToGrid(pos.x, pos.y);

    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * zoomDelta));

    // Keep the point under cursor stable
    const newScreen = gridToScreen(gridBefore.x, gridBefore.y);
    state.panX += pos.x - newScreen.x;
    state.panY += pos.y - newScreen.y;

    render();
  }, { passive: false });

  // --- Center grid on init ---
  function centerGrid() {
    const totalPx = GRID_SIZE * CELL_PX * state.zoom;
    state.panX = (canvasW - totalPx) / 2;
    state.panY = (canvasH - totalPx) / 2;
  }

  // --- Layer tabs ---
  function renderLayerTabs() {
    const container = document.getElementById('layer-tabs');
    container.innerHTML = '';
    LAYERS.forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'layer-tab' + (l === state.activeLayer ? ' active' : '');
      btn.textContent = LAYER_LABELS[l];
      btn.dataset.layer = l;
      const count = state.layers[l].buildings.length;
      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'layer-badge';
        badge.textContent = count;
        btn.appendChild(badge);
      }
      container.appendChild(btn);
    });
  }

  document.getElementById('layer-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.layer-tab');
    if (!btn) return;
    state.activeLayer = btn.dataset.layer;
    renderLayerTabs();
    render();
  });

  // --- Palette ---
  const PALETTE_CATEGORIES = ['all', 'Generator', 'Water', 'Crafting', 'Refining', 'Utility', 'Defense', 'Structure', 'Storage'];

  function renderPalette() {
    const container = document.getElementById('palette-items');
    container.innerHTML = '';

    const filtered = state.paletteFilter === 'all'
      ? palette
      : palette.filter(p => p.category === state.paletteFilter);

    filtered.forEach(item => {
      const div = document.createElement('div');
      div.className = 'palette-item' + (state.selectedBuilding && state.selectedBuilding.id === item.id ? ' selected' : '');
      div.dataset.id = item.id;

      const swatch = document.createElement('span');
      swatch.className = 'palette-swatch';
      swatch.style.background = item.color;
      swatch.textContent = item.abbrev;

      const info = document.createElement('div');
      info.className = 'palette-info';

      const name = document.createElement('div');
      name.className = 'palette-name';
      name.textContent = item.name;

      const detail = document.createElement('div');
      detail.className = 'palette-detail';
      let detailText = `${item.w}x${item.h}`;
      if (item.powerOutput) detailText += ` · +${item.powerOutput}V`;
      if (item.powerDraw) detailText += ` · -${item.powerDraw}V`;
      detail.textContent = detailText;

      info.appendChild(name);
      info.appendChild(detail);
      div.appendChild(swatch);
      div.appendChild(info);
      container.appendChild(div);
    });
  }

  // Palette click
  document.getElementById('palette-items').addEventListener('click', e => {
    const item = e.target.closest('.palette-item');
    if (!item) return;
    const id = item.dataset.id;
    if (state.selectedBuilding && state.selectedBuilding.id === id) {
      state.selectedBuilding = null; // deselect
    } else {
      state.selectedBuilding = paletteMap[id];
      state.tool = 'place';
      updateToolButtons();
    }
    renderPalette();
    canvas.style.cursor = state.selectedBuilding ? 'default' : 'default';
  });

  // Palette filter
  function renderPaletteFilter() {
    const container = document.getElementById('palette-filter');
    container.innerHTML = '';
    PALETTE_CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (cat === state.paletteFilter ? ' active' : '');
      btn.dataset.category = cat;
      btn.textContent = cat === 'all' ? 'All' : cat;
      container.appendChild(btn);
    });
  }

  document.getElementById('palette-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.paletteFilter = btn.dataset.category;
    renderPaletteFilter();
    renderPalette();
  });

  // --- Tool buttons ---
  function updateToolButtons() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === state.tool);
    });
    canvas.style.cursor = state.tool === 'erase' ? 'crosshair' : 'default';
  }

  document.getElementById('layout-tools').addEventListener('click', e => {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;
    const tool = btn.dataset.tool;

    if (tool === 'clear-layer') {
      if (confirm(`Clear all buildings on ${LAYER_LABELS[state.activeLayer]}?`)) {
        clearLayer(state.activeLayer);
        renderLayerTabs();
      }
      return;
    }
    if (tool === 'clear-all') {
      if (confirm('Clear ALL buildings on ALL layers?')) {
        clearAll();
        renderLayerTabs();
      }
      return;
    }
    if (tool === 'center') {
      centerGrid();
      render();
      return;
    }

    state.tool = tool;
    if (tool === 'erase') state.selectedBuilding = null;
    updateToolButtons();
    renderPalette();
  });

  // --- Power summary ---
  function updatePowerSummary() {
    let totalOutput = 0;
    let totalDraw = 0;
    let buildingCount = 0;

    LAYERS.forEach(l => {
      state.layers[l].buildings.forEach(b => {
        const def = paletteMap[b.buildingId];
        if (!def) return;
        totalOutput += def.powerOutput;
        totalDraw += def.powerDraw;
        buildingCount++;
      });
    });

    const balance = totalOutput - totalDraw;

    const outputEl = document.getElementById('layout-power-output');
    const drawEl = document.getElementById('layout-power-draw');
    const balanceEl = document.getElementById('layout-power-balance');
    const countEl = document.getElementById('layout-building-count');

    if (outputEl) outputEl.textContent = `+${totalOutput} V`;
    if (drawEl) drawEl.textContent = `-${totalDraw} V`;
    if (balanceEl) {
      balanceEl.textContent = `${balance >= 0 ? '+' : ''}${balance} V`;
      balanceEl.className = 'stat-value ' +
        (balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral');
    }
    if (countEl) countEl.textContent = buildingCount;

    renderLayerTabs();
  }

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', e => {
    // Only handle if layout planner is visible
    if (document.getElementById('layout').style.display === 'none') return;

    if (e.key === 'Escape') {
      state.selectedBuilding = null;
      state.tool = 'place';
      updateToolButtons();
      renderPalette();
      render();
    }
    if (e.key === 'e' || e.key === 'E') {
      state.tool = 'erase';
      state.selectedBuilding = null;
      updateToolButtons();
      renderPalette();
      render();
    }
    if (e.key === 'r' || e.key === 'R') {
      centerGrid();
      render();
    }
  });

  // --- Save / Load integration ---
  let currentLayoutId = null;
  let currentLayoutName = null;
  const layoutNameEl = document.getElementById('layout-name');
  const saveBtn = document.getElementById('save-layout-btn');
  const saveAsBtn = document.getElementById('save-as-layout-btn');
  const loadBtn = document.getElementById('load-layout-btn');
  const layoutStatus = document.getElementById('layout-status');

  function showStatus(msg, type) {
    if (!layoutStatus) return;
    layoutStatus.textContent = msg;
    layoutStatus.className = 'layout-status ' + (type || '');
    clearTimeout(layoutStatus._timer);
    layoutStatus._timer = setTimeout(() => { layoutStatus.textContent = ''; }, 3000);
  }

  async function handleSave() {
    if (!StructuraAuth.getUser()) {
      StructuraAuth.signIn();
      return;
    }
    const name = currentLayoutName || prompt('Name your layout:');
    if (!name) return;
    try {
      showStatus('Saving...', '');
      const id = await LayoutStorage.saveLayout(name, state.layers);
      currentLayoutId = id;
      currentLayoutName = name;
      if (layoutNameEl) layoutNameEl.textContent = name;
      showStatus('Saved!', 'success');
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  async function handleSaveAs() {
    if (!StructuraAuth.getUser()) {
      StructuraAuth.signIn();
      return;
    }
    const name = prompt('Name for new layout:', (currentLayoutName || '') + ' copy');
    if (!name) return;
    const prevName = currentLayoutName;
    currentLayoutName = name;
    currentLayoutId = null; // Force new doc
    try {
      showStatus('Saving...', '');
      const id = await LayoutStorage.saveLayout(name, state.layers);
      currentLayoutId = id;
      if (layoutNameEl) layoutNameEl.textContent = name;
      showStatus('Saved!', 'success');
    } catch (err) {
      currentLayoutName = prevName;
      showStatus(err.message, 'error');
    }
  }

  async function handleLoad() {
    if (!StructuraAuth.getUser()) {
      StructuraAuth.signIn();
      return;
    }
    try {
      const layouts = await LayoutStorage.listLayouts();
      if (layouts.length === 0) {
        showStatus('No saved layouts.', '');
        return;
      }
      showLayoutPicker(layouts);
    } catch (err) {
      showStatus('Load failed: ' + err.message, 'error');
    }
  }

  function showLayoutPicker(layouts) {
    // Remove existing picker
    const old = document.getElementById('layout-picker-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'layout-picker-overlay';
    overlay.className = 'picker-overlay';

    let html = '<div class="picker-modal"><h3>Load Layout</h3><div class="picker-list">';
    layouts.forEach(l => {
      const date = l.updatedAt ? new Date(l.updatedAt.seconds * 1000).toLocaleDateString() : '--';
      // Count buildings across layers
      let count = 0;
      if (l.gridData) {
        Object.values(l.gridData).forEach(layer => { count += (layer.buildings || []).length; });
      }
      html += `<div class="picker-item" data-id="${l.id}">
        <div class="picker-item-info">
          <div class="picker-item-name">${l.name}</div>
          <div class="picker-item-detail">${count} buildings · ${date}</div>
        </div>
        <div class="picker-item-actions">
          <button class="picker-load-btn" data-id="${l.id}">Load</button>
          <button class="picker-delete-btn" data-id="${l.id}" title="Delete">X</button>
        </div>
      </div>`;
    });
    html += '</div><button class="picker-close-btn">Cancel</button></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // Events
    overlay.querySelector('.picker-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.picker-load-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const layout = await LayoutStorage.loadLayout(id);
          applyLoadedLayout(layout);
          overlay.remove();
          showStatus('Loaded: ' + layout.name, 'success');
        } catch (err) {
          showStatus('Load failed: ' + err.message, 'error');
        }
      });
    });

    overlay.querySelectorAll('.picker-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Delete this layout?')) return;
        try {
          await LayoutStorage.deleteLayout(id);
          btn.closest('.picker-item').remove();
          if (currentLayoutId === id) {
            currentLayoutId = null;
            currentLayoutName = null;
            if (layoutNameEl) layoutNameEl.textContent = 'Untitled';
          }
          showStatus('Deleted.', '');
        } catch (err) {
          showStatus('Delete failed: ' + err.message, 'error');
        }
      });
    });
  }

  function applyLoadedLayout(layout) {
    currentLayoutId = layout.id;
    currentLayoutName = layout.name;
    if (layoutNameEl) layoutNameEl.textContent = layout.name;

    // Reset layers
    LAYERS.forEach(l => { state.layers[l] = { buildings: [] }; });
    nextBuildingId = 1;

    // Apply loaded data
    if (layout.gridData) {
      LAYERS.forEach(l => {
        if (layout.gridData[l] && layout.gridData[l].buildings) {
          layout.gridData[l].buildings.forEach(b => {
            state.layers[l].buildings.push({
              id: nextBuildingId++,
              buildingId: b.buildingId,
              x: b.x, y: b.y,
              w: b.w, h: b.h
            });
          });
        }
      });
    }

    updatePowerSummary();
    renderLayerTabs();
    render();

    // Update 3D if active
    if (window._threePreview) window._threePreview.rebuild();
  }

  if (saveBtn) saveBtn.addEventListener('click', handleSave);
  if (saveAsBtn) saveAsBtn.addEventListener('click', handleSaveAs);
  if (loadBtn) loadBtn.addEventListener('click', handleLoad);

  // --- 3D Preview toggle ---
  const toggle2dBtn = document.getElementById('view-2d-btn');
  const toggle3dBtn = document.getElementById('view-3d-btn');
  const canvasContainer = document.querySelector('.canvas-container');
  const threeContainer = document.getElementById('three-container');
  let threePreview = null;

  function switchTo3D() {
    if (!threePreview) {
      threePreview = initThreePreview(gameData, () => state);
      window._threePreview = threePreview;
    }
    if (canvasContainer) canvasContainer.style.display = 'none';
    if (threeContainer) threeContainer.style.display = 'block';
    if (toggle2dBtn) toggle2dBtn.classList.remove('active');
    if (toggle3dBtn) toggle3dBtn.classList.add('active');
    threePreview.resize();
    threePreview.start();
    threePreview.rebuild();
  }

  function switchTo2D() {
    if (canvasContainer) canvasContainer.style.display = '';
    if (threeContainer) threeContainer.style.display = 'none';
    if (toggle2dBtn) toggle2dBtn.classList.add('active');
    if (toggle3dBtn) toggle3dBtn.classList.remove('active');
    if (threePreview) threePreview.stop();
    resizeCanvas();
    render();
  }

  if (toggle2dBtn) toggle2dBtn.addEventListener('click', switchTo2D);
  if (toggle3dBtn) toggle3dBtn.addEventListener('click', switchTo3D);

  // --- Init ---
  resizeCanvas();
  centerGrid();
  renderLayerTabs();
  renderPaletteFilter();
  renderPalette();
  updatePowerSummary();
  updateToolButtons();
  render();

  window.addEventListener('resize', resizeCanvas);

  // Return API for external access
  return { state, clearAll, render, applyLoadedLayout };
}
