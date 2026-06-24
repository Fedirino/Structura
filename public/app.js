// ============================================
// STRUCTURA — Dune Awakening Base Builder
// ============================================

const APP_VERSION = '0.3.0';

(async function () {
  'use strict';

  // --- Display version ---
  document.getElementById('version-badge').textContent = `v${APP_VERSION}`;

  // --- Load game data ---
  let gameData;
  try {
    const res = await fetch('data/game-data.json');
    gameData = await res.json();
  } catch (err) {
    document.getElementById('app').innerHTML =
      '<p style="color:#c9302c;padding:2rem;">Failed to load game data. Check that data/game-data.json exists.</p>';
    return;
  }

  // ==========================================
  // NAV — view switching
  // ==========================================
  const views = { calculator: 'calculator', layout: 'layout' };
  let currentView = 'calculator';
  let layoutInitialized = false;

  document.querySelector('.main-nav').addEventListener('click', e => {
    const link = e.target.closest('.nav-link');
    if (!link) return;
    e.preventDefault();
    const view = link.dataset.view;
    if (!view || view === currentView) return;
    switchView(view);
  });

  function switchView(view) {
    currentView = view;
    // Toggle sections
    document.getElementById('calculator').style.display = view === 'calculator' ? '' : 'none';
    document.getElementById('layout').style.display = view === 'layout' ? '' : 'none';

    // Toggle nav active
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === view);
    });

    // Lazy-init layout planner
    if (view === 'layout' && !layoutInitialized) {
      layoutInitialized = true;
      // Small delay so the container has dimensions before canvas init
      requestAnimationFrame(() => initLayoutPlanner(gameData));
    }
  }

  // Handle hash on load
  if (window.location.hash === '#layout') {
    switchView('layout');
  }

  // ==========================================
  // POWER CALCULATOR (existing v0.1 code)
  // ==========================================
  const state = {
    generators: {},
    consumers: {},
    durationDays: 7,
    categoryFilter: 'all'
  };

  gameData.generators.forEach(g => (state.generators[g.id] = 0));
  gameData.powerConsumers.forEach(c => (state.consumers[c.id] = 0));

  function renderGenerators() {
    const container = document.getElementById('generator-inputs');
    container.innerHTML = '';

    gameData.generators.forEach(gen => {
      const row = document.createElement('div');
      row.className = 'input-row';
      row.innerHTML = `
        <div class="input-row-info">
          <div class="input-row-name">${gen.name}</div>
          <div class="input-row-detail">${gen.fuelType} · ${gen.placement}</div>
        </div>
        <div class="input-row-power">+${gen.powerOutput} V</div>
        <div class="qty-control">
          <button class="qty-btn" data-id="${gen.id}" data-delta="-1">−</button>
          <span class="qty-value" id="qty-gen-${gen.id}">${state.generators[gen.id]}</span>
          <button class="qty-btn" data-id="${gen.id}" data-delta="1">+</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.addEventListener('click', e => {
      const btn = e.target.closest('.qty-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      const delta = parseInt(btn.dataset.delta);
      state.generators[id] = Math.max(0, state.generators[id] + delta);
      document.getElementById(`qty-gen-${id}`).textContent = state.generators[id];
      recalculate();
    });
  }

  function renderConsumers() {
    const container = document.getElementById('consumer-inputs');
    container.innerHTML = '';

    const filtered = state.categoryFilter === 'all'
      ? gameData.powerConsumers
      : gameData.powerConsumers.filter(c => c.category === state.categoryFilter);

    filtered.forEach(con => {
      const row = document.createElement('div');
      row.className = 'input-row';
      row.dataset.category = con.category;
      row.innerHTML = `
        <div class="input-row-info">
          <div class="input-row-name">${con.name}</div>
          <div class="input-row-detail">${con.category}${con.notes ? ' · ' + con.notes : ''}</div>
        </div>
        <div class="input-row-power">−${con.powerDraw} V</div>
        <div class="qty-control">
          <button class="qty-btn" data-id="${con.id}" data-delta="-1">−</button>
          <span class="qty-value" id="qty-con-${con.id}">${state.consumers[con.id]}</span>
          <button class="qty-btn" data-id="${con.id}" data-delta="1">+</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.addEventListener('click', e => {
      const btn = e.target.closest('.qty-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      const delta = parseInt(btn.dataset.delta);
      state.consumers[id] = Math.max(0, state.consumers[id] + delta);
      document.getElementById(`qty-con-${id}`).textContent = state.consumers[id];
      recalculate();
    });
  }

  document.querySelector('.consumer-category-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.consumer-category-filter .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.categoryFilter = btn.dataset.category;
    renderConsumers();
  });

  document.getElementById('duration-days').addEventListener('input', e => {
    state.durationDays = Math.max(1, parseInt(e.target.value) || 1);
    recalculate();
  });

  function recalculate() {
    let totalOutput = 0;
    gameData.generators.forEach(gen => {
      totalOutput += gen.powerOutput * state.generators[gen.id];
    });
    document.getElementById('total-power-output').textContent = `${totalOutput} V`;

    let totalDraw = 0;
    gameData.powerConsumers.forEach(con => {
      totalDraw += con.powerDraw * state.consumers[con.id];
    });
    document.getElementById('total-power-draw').textContent = `${totalDraw} V`;

    const balance = totalOutput - totalDraw;
    const balanceEl = document.getElementById('power-balance');
    const statusEl = document.getElementById('power-status');

    balanceEl.textContent = `${balance >= 0 ? '+' : ''}${balance} V`;
    balanceEl.className = 'summary-value ' +
      (balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral');

    if (totalOutput === 0 && totalDraw === 0) {
      statusEl.textContent = '—';
      statusEl.className = 'summary-value neutral';
    } else if (balance > 0) {
      statusEl.textContent = 'Surplus';
      statusEl.className = 'summary-value positive';
    } else if (balance === 0) {
      statusEl.textContent = 'Balanced';
      statusEl.className = 'summary-value positive';
    } else {
      statusEl.textContent = 'Deficit!';
      statusEl.className = 'summary-value negative';
    }

    renderFuelCosts();
  }

  function renderFuelCosts() {
    const container = document.getElementById('fuel-cost-breakdown');
    const hours = state.durationDays * 24;

    const activeGens = gameData.generators
      .filter(gen => state.generators[gen.id] > 0)
      .map(gen => {
        const count = state.generators[gen.id];
        const totalFuel = Math.ceil(gen.fuelPerHour * count * hours);
        return { ...gen, count, totalFuel };
      });

    if (activeGens.length === 0) {
      container.innerHTML = '<p class="no-fuel-msg">Add generators to see fuel costs.</p>';
      return;
    }

    let html = `
      <table class="fuel-table">
        <thead>
          <tr>
            <th>Generator</th>
            <th>Qty</th>
            <th>Fuel Type</th>
            <th>Per Hour (total)</th>
            <th>${state.durationDays}d Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    activeGens.forEach(g => {
      const perHourTotal = (g.fuelPerHour * g.count).toFixed(2).replace(/\.?0+$/, '');
      html += `
        <tr>
          <td>${g.name}</td>
          <td>${g.count}</td>
          <td>${g.fuelType}</td>
          <td>${perHourTotal}/hr</td>
          <td>${g.totalFuel.toLocaleString()}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  renderGenerators();
  renderConsumers();
  recalculate();
})();
