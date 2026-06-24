// ============================================
// STRUCTURA — Three.js 3D Preview
// ============================================

function initThreePreview(gameData, getLayoutState) {
  'use strict';

  const CELL_SIZE_3D = 1;          // 1 unit per grid cell
  const LAYER_HEIGHT = 3;          // vertical spacing between layers
  const GRID_SIZE = 60;
  const LAYERS = ['basement', 'ground', 'upper', 'roof'];
  const LAYER_Y = { basement: -LAYER_HEIGHT, ground: 0, upper: LAYER_HEIGHT, roof: LAYER_HEIGHT * 2 };
  const BUILDING_HEIGHT = 2.5;     // how tall a building box is

  const container = document.getElementById('three-container');
  if (!container) return null;

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x12100d, 1);
  container.appendChild(renderer.domElement);

  // --- Scene ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x12100d, 0.008);

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(45, 40, 45);
  camera.lookAt(30, 0, 30);

  // --- Lights ---
  const ambient = new THREE.AmbientLight(0xf0c060, 0.4);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffe8c0, 0.8);
  dirLight.position.set(40, 60, 30);
  scene.add(dirLight);

  const hemi = new THREE.HemisphereLight(0xd4922a, 0x1a1611, 0.3);
  scene.add(hemi);

  // --- Ground plane ---
  const groundGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2a2318 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(GRID_SIZE / 2, -0.01, GRID_SIZE / 2);
  scene.add(ground);

  // --- Grid helper ---
  const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x5c4a35, 0x3d3226);
  gridHelper.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2);
  scene.add(gridHelper);

  // --- Orbit controls (manual, no import needed) ---
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let spherical = { theta: Math.PI / 4, phi: Math.PI / 4, radius: 65 };
  const target = new THREE.Vector3(30, 0, 30);

  function updateCamera() {
    const r = spherical.radius;
    const sinPhi = Math.sin(spherical.phi);
    camera.position.set(
      target.x + r * sinPhi * Math.sin(spherical.theta),
      target.y + r * Math.cos(spherical.phi),
      target.z + r * sinPhi * Math.cos(spherical.theta)
    );
    camera.lookAt(target);
  }

  renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 0 || e.button === 2) {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    }
  });

  renderer.domElement.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    prevMouse = { x: e.clientX, y: e.clientY };

    if (e.buttons === 1) {
      // Orbit
      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.005));
    } else if (e.buttons === 2) {
      // Pan
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      camera.getWorldDirection(right);
      right.cross(up).normalize();
      target.addScaledVector(right, -dx * 0.1);
      target.y += dy * 0.1;
    }
    updateCamera();
  });

  window.addEventListener('mouseup', () => { isDragging = false; });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    spherical.radius = Math.max(10, Math.min(150, spherical.radius + e.deltaY * 0.05));
    updateCamera();
  }, { passive: false });

  // --- Building meshes ---
  const buildingMeshes = new THREE.Group();
  scene.add(buildingMeshes);

  // Layer floor planes (semi-transparent)
  const layerFloors = {};
  LAYERS.forEach(l => {
    if (l === 'ground') return; // ground plane already exists
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    const mat = new THREE.MeshLambertMaterial({
      color: 0x3d3226,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(GRID_SIZE / 2, LAYER_Y[l], GRID_SIZE / 2);
    mesh.visible = false;
    scene.add(mesh);
    layerFloors[l] = mesh;
  });

  // --- Parse hex color to Three.js color ---
  function hexToColor(hex) {
    return new THREE.Color(hex);
  }

  // Material cache
  const materialCache = {};
  function getMaterial(hex) {
    if (!materialCache[hex]) {
      materialCache[hex] = new THREE.MeshLambertMaterial({ color: hexToColor(hex) });
    }
    return materialCache[hex];
  }

  // --- Rebuild 3D scene from layout state ---
  let visibleLayers = new Set(['basement', 'ground', 'upper', 'roof']);

  function rebuild() {
    // Clear old meshes
    while (buildingMeshes.children.length > 0) {
      const m = buildingMeshes.children[0];
      m.geometry.dispose();
      buildingMeshes.remove(m);
    }

    const state = getLayoutState();
    if (!state || !state.layers) return;

    // Build palette map
    const allItems = [
      ...gameData.generators.map(g => ({ ...g, category: 'Generator', powerOutput: g.powerOutput })),
      ...gameData.powerConsumers,
      ...gameData.structural
    ];
    const itemMap = {};
    allItems.forEach(item => { itemMap[item.id] = item; });

    LAYERS.forEach(layerName => {
      if (!visibleLayers.has(layerName)) return;
      const layer = state.layers[layerName];
      if (!layer) return;

      const yBase = LAYER_Y[layerName];

      // Show layer floor
      if (layerFloors[layerName]) {
        layerFloors[layerName].visible = true;
      }

      layer.buildings.forEach(b => {
        const def = itemMap[b.buildingId];
        if (!def) return;

        const geo = new THREE.BoxGeometry(
          b.w * CELL_SIZE_3D,
          BUILDING_HEIGHT,
          b.h * CELL_SIZE_3D
        );

        const mat = getMaterial(def.color || '#888888');
        const mesh = new THREE.Mesh(geo, mat);

        // Position: center of the building footprint
        mesh.position.set(
          b.x + b.w / 2,
          yBase + BUILDING_HEIGHT / 2,
          b.y + b.h / 2
        );

        // Wireframe outline
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
        );
        mesh.add(line);

        buildingMeshes.add(mesh);
      });
    });

    // Hide unused layer floors
    for (const [l, floor] of Object.entries(layerFloors)) {
      if (!visibleLayers.has(l)) floor.visible = false;
    }
  }

  // --- Resize ---
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // --- Animation loop ---
  let animating = false;

  function animate() {
    if (!animating) return;
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  function start() {
    if (animating) return;
    animating = true;
    resize();
    updateCamera();
    rebuild();
    animate();
  }

  function stop() {
    animating = false;
  }

  // --- Layer visibility toggle ---
  function setLayerVisible(layerName, visible) {
    if (visible) visibleLayers.add(layerName);
    else visibleLayers.delete(layerName);
    rebuild();
  }

  // Watch for container resize
  window.addEventListener('resize', () => { if (animating) resize(); });

  return { start, stop, rebuild, resize, setLayerVisible };
}
