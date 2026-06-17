/**
 * WaveThree — Punto de entrada del visor marino
 *
 * Carga la escena, inicializa el océano, conecta la UI.
 * Fase 1.1: MVP visual mejorado con shader, escenarios, FPS.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGerstnerOcean } from '../../src/ocean/gerstner.js';
import { createScene } from '../../src/scene/setup.js';

// ── Escenarios predefinidos ──

const SCENARIOS = {
  temporal_2026_01_17_1200: {
    label: 'Temporal enero 2026',
    wave: { hs: 3.2, tp: 8.7, dir: 245 },
    wind: { speed: 17.5, dir: 240 },
  },
  swell_atlantic: {
    label: 'Mar de fondo atlántico',
    wave: { hs: 1.8, tp: 12.5, dir: 310 },
    wind: { speed: 5.0, dir: 10 },
  },
  calm_day: {
    label: 'Día en calma',
    wave: { hs: 0.5, tp: 4.2, dir: 180 },
    wind: { speed: 3.0, dir: 160 },
  },
  storm_extreme: {
    label: 'Temporal extremo',
    wave: { hs: 6.0, tp: 14.2, dir: 300 },
    wind: { speed: 25.0, dir: 310 },
  },
};

// ── Inicialización ──

const { scene, camera, renderer } = createScene();
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI / 2.1;
controls.update();

// ── Estado ──

const state = {
  scenarioId: 'temporal_2026_01_17_1200',
  params: {
    amplitude: 3.2,
    frequency: 0.4,
    speed: 0.5,
    direction: 245,
    windSpeed: 17.5,
  },
};

// ── Océano ──

const ocean = createGerstnerOcean(state.params);
scene.add(ocean.mesh);

// ── Función para cargar escenario ──

function loadScenario(id) {
  const sc = SCENARIOS[id];
  if (!sc) return;

  state.scenarioId = id;
  state.params.amplitude = sc.wave.hs;
  state.params.frequency = 1 / sc.wave.tp;
  state.params.direction = sc.wave.dir;
  state.params.windSpeed = sc.wind.speed;

  // Actualizar UI
  document.getElementById('hs-slider').value = sc.wave.hs;
  document.getElementById('tp-slider').value = sc.wave.tp;
  document.getElementById('dir-slider').value = sc.wave.dir;
  document.getElementById('wind-slider').value = sc.wind.speed;

  document.getElementById('hs-val').textContent = sc.wave.hs.toFixed(1) + ' m';
  document.getElementById('tp-val').textContent = sc.wave.tp.toFixed(1) + ' s';
  document.getElementById('dir-val').textContent = sc.wave.dir.toFixed(0) + '°';
  document.getElementById('wind-val').textContent = sc.wind.speed.toFixed(1) + ' m/s';

  document.getElementById('scenario-meta').innerHTML =
    `<strong>Hs:</strong> ${sc.wave.hs} m · <strong>Tp:</strong> ${sc.wave.tp} s · <strong>Dir:</strong> ${sc.wave.dir}°` +
    ` · <strong>Viento:</strong> ${sc.wind.speed} m/s`;

  ocean.update(0, state.params);
}

// ── UI: Selector de escenarios ──

document.getElementById('scenario-select').addEventListener('change', (e) => {
  loadScenario(e.target.value);
  document.getElementById('loading').classList.add('hidden');
});

// ── UI: Sliders ──

function onSliderChange() {
  const hs = parseFloat(document.getElementById('hs-slider').value);
  const tp = parseFloat(document.getElementById('tp-slider').value);
  const dir = parseFloat(document.getElementById('dir-slider').value);
  const wind = parseFloat(document.getElementById('wind-slider').value);

  document.getElementById('hs-val').textContent = hs.toFixed(1) + ' m';
  document.getElementById('tp-val').textContent = tp.toFixed(1) + ' s';
  document.getElementById('dir-val').textContent = dir.toFixed(0) + '°';
  document.getElementById('wind-val').textContent = wind.toFixed(1) + ' m/s';

  document.getElementById('scenario-meta').innerHTML =
    `<strong>Hs:</strong> ${hs.toFixed(1)} m · <strong>Tp:</strong> ${tp.toFixed(1)} s · <strong>Dir:</strong> ${dir.toFixed(0)}°` +
    ` · <strong>Viento:</strong> ${wind.toFixed(1)} m/s`;

  state.params.amplitude = hs;
  state.params.frequency = 1 / tp;
  state.params.direction = dir;
  state.params.windSpeed = wind;
}

document.getElementById('hs-slider').addEventListener('input', onSliderChange);
document.getElementById('tp-slider').addEventListener('input', onSliderChange);
document.getElementById('dir-slider').addEventListener('input', onSliderChange);
document.getElementById('wind-slider').addEventListener('input', onSliderChange);

// ── UI: Panel toggle ──

document.getElementById('panel-toggle').addEventListener('click', () => {
  const panel = document.getElementById('panel');
  panel.classList.toggle('collapsed');
  document.getElementById('panel-toggle').textContent =
    panel.classList.contains('collapsed') ? '▶' : '◀';
});

// ── UI: Reset cámara ──

document.getElementById('reset-cam').addEventListener('click', () => {
  camera.position.set(30, 18, 30);
  controls.target.set(0, 0, 0);
  controls.update();
});

// ── UI: FPS counter ──

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

// ── Keyboard shortcuts ──

document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    document.getElementById('reset-cam').click();
  }
  if (e.key >= '1' && e.key <= '4') {
    const keys = Object.keys(SCENARIOS);
    const idx = parseInt(e.key) - 1;
    if (idx < keys.length) {
      document.getElementById('scenario-select').value = keys[idx];
      loadScenario(keys[idx]);
    }
  }
});

// ── Animación ──

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

// ── Ocultar loading ──

setTimeout(() => {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('loading').querySelector('.status').textContent = '¡Listo!';
}, 800);

// Cargar escenario inicial
loadScenario('temporal_2026_01_17_1200');

console.log('🌊 WaveThree — MVP visual mejorado iniciado');
console.log(`📊 Escenario inicial: ${state.params.amplitude}m Hs, ${(1/state.params.frequency).toFixed(1)}s Tp`);