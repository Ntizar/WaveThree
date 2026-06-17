/**
 * WaveThree — Punto de entrada del visor marino
 *
 * Carga la escena, inicializa el océano, conecta la UI.
 * Fase 2.2: Escenarios reales — loader funcional, selector conectado,
 * metadatos dinámicos, carga desde JSON en data/scenarios/.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGerstnerOcean } from '../../../src/ocean/gerstner.js';
import { createScene } from '../../../src/scene/setup.js';
import { loadAndCreateBathymetry } from '../../../src/bathymetry/index.js';
import { loadScenariosList, scenarioToWaveParams } from '../../../src/loaders/index.js';

// ── Inicialización escena ────────────────────────────────────────────

const { scene, camera, renderer } = createScene();
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI / 2.1;
controls.update();

// ── Estado ───────────────────────────────────────────────────────────

const state = {
  scenarioId: null,
  scenarioMeta: null,
  params: {
    amplitude: 0,
    frequency: 0.4,
    speed: 0.5,
    direction: 245,
    windSpeed: 17.5,
  },
};

// ── Océano ───────────────────────────────────────────────────────────

const ocean = createGerstnerOcean(state.params);
scene.add(ocean.mesh);

// ── Batimetría 3D (Fase 2.1) ────────────────────────────────────────

let bathymetryMesh = null;

async function loadBathymetry() {
  try {
    console.log('🌊 Cargando batimetría de demostración...');
    const bathyUrl = '/demo-bathymetry.bin';

    const mesh = await loadAndCreateBathymetry(bathyUrl, {
      segW: 128,
      segH: 128,
      scaleX: 100,
      scaleZ: 100,
      verticalScale: 0.3,
      maxDepth: 300,
      scene,
    });

    mesh.position.y = -2;
    mesh.position.x = 0;
    mesh.position.z = 0;

    scene.add(mesh);
    bathymetryMesh = mesh;
    console.log('✅ Batimetría cargada');
  } catch (err) {
    console.warn('⚠️ No se pudo cargar la batimetría:', err.message);
  }
}

loadBathymetry();

// ── Gestión de escenarios ───────────────────────────────────────────

let availableScenarios = [];

/**
 * Carga la lista de escenarios disponibles desde data/scenarios/*.json
 * y popula el selector del DOM.
 */
async function initScenarios() {
  try {
    availableScenarios = await loadScenariosList();
    populateScenarioSelector(availableScenarios);

    if (availableScenarios.length > 0) {
      // Cargar el primer escenario por defecto
      await selectScenario(availableScenarios[0].id);
      console.log(`✅ ${availableScenarios.length} escenarios cargados`);
    } else {
      console.warn('⚠️ No se encontraron escenarios');
    }
  } catch (err) {
    console.error('❌ Error al cargar escenarios:', err);
  }
}

/**
 * Pobla el <select> de escenarios con las opciones disponibles.
 */
function populateScenarioSelector(scenarios) {
  const select = document.getElementById('scenario-select');
  select.innerHTML = '';

  for (const sc of scenarios) {
    const option = document.createElement('option');
    option.value = sc.id;
    option.textContent = sc.label;
    select.appendChild(option);
  }
}

/**
 * Selecciona y carga un escenario por ID.
 * Lee el JSON, convierte a wave params, actualiza la escena y la UI.
 */
async function selectScenario(id) {
  try {
    const sc = await loadScenarioFromId(id);
    const params = scenarioToWaveParams(sc);

    state.scenarioId = id;
    state.scenarioMeta = sc;

    // Actualizar estado
    state.params.amplitude = params.amplitude;
    state.params.frequency = params.frequency;
    state.params.direction = params.direction;
    state.params.windSpeed = params.windSpeed;

    // Actualizar sliders del DOM
    document.getElementById('hs-slider').value = sc.wave.hs;
    document.getElementById('tp-slider').value = sc.wave.tp;
    document.getElementById('dir-slider').value = sc.wave.dir;
    document.getElementById('wind-slider').value = sc.wind.speed;

    // Actualizar valores mostrados
    updateSliderLabels();

    // Actualizar metadatos del escenario
    updateScenarioMeta(sc);

    // Actualizar el océano
    ocean.update(0, state.params);
  } catch (err) {
    console.error(`❌ Error al cargar escenario "${id}":`, err.message);
  }
}

/**
 * Carga un escenario JSON desde su ID usando la ruta relativa.
 */
async function loadScenarioFromId(id) {
  const response = await fetch(`../../data/scenarios/${id}.json`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar escenario "${id}" (HTTP ${response.status})`);
  }
  const data = await response.json();

  // Validación básica
  if (!data.wave || !data.wind) {
    throw new Error(`Escenario "${id}" no tiene campos wave/wind`);
  }
  if (typeof data.wave.hs !== 'number' || typeof data.wave.tp !== 'number') {
    throw new Error(`Escenario "${id}" tiene campos wave inválidos`);
  }

  return data;
}

/**
 * Actualiza el panel de metadatos con info del escenario activo.
 */
function updateScenarioMeta(sc) {
  const metaEl = document.getElementById('scenario-meta');
  const dateStr = new Date(sc.time).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  metaEl.innerHTML =
    `<div style="margin-bottom:4px;"><strong>📍 ${sc.location}</strong> · ${dateStr}</div>` +
    `<div><strong>Hs:</strong> ${sc.wave.hs.toFixed(1)} m · <strong>Tp:</strong> ${sc.wave.tp.toFixed(1)} s · <strong>Dir:</strong> ${sc.wave.dir}°</div>` +
    `<div><strong>Viento:</strong> ${sc.wind.speed.toFixed(1)} m/s desde ${sc.wind.dir}°</div>`;
}

/**
 * Actualiza los labels de los sliders con los valores actuales.
 */
function updateSliderLabels() {
  const hs = parseFloat(document.getElementById('hs-slider').value);
  const tp = parseFloat(document.getElementById('tp-slider').value);
  const dir = parseFloat(document.getElementById('dir-slider').value);
  const wind = parseFloat(document.getElementById('wind-slider').value);

  document.getElementById('hs-val').textContent = hs.toFixed(1) + ' m';
  document.getElementById('tp-val').textContent = tp.toFixed(1) + ' s';
  document.getElementById('dir-val').textContent = dir.toFixed(0) + '°';
  document.getElementById('wind-val').textContent = wind.toFixed(1) + ' m/s';

  // Si no hay escenario cargado, mostrar valores de sliders
  if (!state.scenarioMeta) {
    updateScenarioMeta({
      location: 'Personalizado',
      time: new Date().toISOString(),
      wave: { hs, tp, dir },
      wind: { speed: wind, dir: 0 },
    });
  }
}

// ── UI: Selector de escenarios ──────────────────────────────────────

document.getElementById('scenario-select').addEventListener('change', async (e) => {
  await selectScenario(e.target.value);
  document.getElementById('loading').classList.add('hidden');
});

// ── UI: Sliders ─────────────────────────────────────────────────────

function onSliderChange() {
  updateSliderLabels();

  const hs = parseFloat(document.getElementById('hs-slider').value);
  const tp = parseFloat(document.getElementById('tp-slider').value);
  const dir = parseFloat(document.getElementById('dir-slider').value);
  const wind = parseFloat(document.getElementById('wind-slider').value);

  state.params.amplitude = hs;
  state.params.frequency = 1 / tp;
  state.params.direction = dir;
  state.params.windSpeed = wind;

  // Si estamos en modo personalizado (sin escenario), actualizar meta
  if (!state.scenarioId) {
    updateScenarioMeta({
      location: 'Personalizado',
      time: new Date().toISOString(),
      wave: { hs, tp, dir },
      wind: { speed: wind, dir: 0 },
    });
  }

  ocean.update(0, state.params);
}

document.getElementById('hs-slider').addEventListener('input', onSliderChange);
document.getElementById('tp-slider').addEventListener('input', onSliderChange);
document.getElementById('dir-slider').addEventListener('input', onSliderChange);
document.getElementById('wind-slider').addEventListener('input', onSliderChange);

// ── UI: Panel toggle ────────────────────────────────────────────────

document.getElementById('panel-toggle').addEventListener('click', () => {
  const panel = document.getElementById('panel');
  panel.classList.toggle('collapsed');
  document.getElementById('panel-toggle').textContent =
    panel.classList.contains('collapsed') ? '▶' : '◀';
});

// ── UI: Reset cámara ────────────────────────────────────────────────

document.getElementById('reset-cam').addEventListener('click', () => {
  camera.position.set(30, 18, 30);
  controls.target.set(0, 0, 0);
  controls.update();
});

// ── UI: FPS counter ─────────────────────────────────────────────────

const fpsEl = document.getElementById('fps');
let frameCount = 0;
let fpsTime = 0;

function updateFPS(time) {
  frameCount++;
  if (time - fpsTime >= 1.0) {
    const fps = Math.round(frameCount / (time - fpsTime));
    fpsEl.textContent = fps + ' FPS';
    fpsEl.className = fps >= 50 ? 'good' : fps >= 30 ? 'warn' : 'bad';
    frameCount = 0;
    fpsTime = time;
  }
}

// ── Keyboard shortcuts ──────────────────────────────────────────────

document.addEventListener('keydown', async (e) => {
  if (e.key === 'r' || e.key === 'R') {
    document.getElementById('reset-cam').click();
  }
  if (e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1;
    if (idx < availableScenarios.length) {
      const sc = availableScenarios[idx];
      document.getElementById('scenario-select').value = sc.id;
      await selectScenario(sc.id);
    }
  }
});

// ── Animación ───────────────────────────────────────────────────────

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  ocean.update(t);
  controls.update();
  renderer.render(scene, camera);

  updateFPS(t);
}

animate();

// ── Ocultar loading ─────────────────────────────────────────────────

setTimeout(() => {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('loading').querySelector('.status').textContent = '¡Listo!';
}, 800);

// ── Arranque ─────────────────────────────────────────────────────────

initScenarios();

console.log('🌊 WaveThree — Visor marino 3D iniciado');
