/**
 * WaveThree — Punto de entrada del visor marino
 *
 * Carga la escena, inicializa el océano y el panel de control.
 * Fase 1.1: selector de escenarios, FPS, reset cámara, glassmorphism UI.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGerstnerOcean } from '../../src/ocean/gerstner.js';
import { createScene } from '../../src/scene/setup.js';

// ── Escenarios predefinidos ──

const SCENARIOS = {
  temporal: {
    label: 'Temporal enero 2026',
    amplitude: 3.2, frequency: 0.4, speed: 0.5, direction: 245,
  },
  marfondo: {
    label: 'Mar de fondo',
    amplitude: 1.8, frequency: 0.25, speed: 0.3, direction: 270,
  },
  calma: {
    label: 'Calma',
    amplitude: 0.5, frequency: 0.15, speed: 0.15, direction: 180,
  },
};

// ── Inicialización ──

const { scene, camera, renderer } = createScene();
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1;

// ── Océano ──

const params = { amplitude: 3.2, frequency: 0.4, speed: 0.5, direction: 245 };
const ocean = createGerstnerOcean(params);
scene.add(ocean.mesh);

// ── Cámara inicial ──

const cameraDefaultPos = new THREE.Vector3(30, 20, 30);
const cameraDefaultTarget = new THREE.Vector3(0, 0, 0);

// ── FPS counter ──

let frameCount = 0;
let lastFpsTime = performance.now();
const fpsValueEl = document.getElementById('fps-value');

function updateFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 500) {
    const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
    fpsValueEl.textContent = fps;
    // Color según rendimiento
    if (fps >= 50) {
      fpsValueEl.style.color = '#38bdf8';
    } else if (fps >= 30) {
      fpsValueEl.style.color = '#f59e0b';
    } else {
      fpsValueEl.style.color = '#ef4444';
    }
    frameCount = 0;
    lastFpsTime = now;
  }
}

// ── UI Elements ──

const hsSlider = document.getElementById('hs-slider');
const tpSlider = document.getElementById('tp-slider');
const dirSlider = document.getElementById('dir-slider');
const hsValue = document.getElementById('hs-value');
const tpValue = document.getElementById('tp-value');
const dirValue = document.getElementById('dir-value');
const scenarioSelect = document.getElementById('scenario-select');
const btnReset = document.getElementById('btn-reset');
const statusBar = document.getElementById('status-bar');

// ── Sliders ──

hsSlider.addEventListener('input', () => {
  const v = parseFloat(hsSlider.value);
  hsValue.textContent = v.toFixed(1) + ' m';
  params.amplitude = v;
});

tpSlider.addEventListener('input', () => {
  const v = parseFloat(tpSlider.value);
  tpValue.textContent = v.toFixed(1) + ' s';
  params.frequency = 1 / v;
});

dirSlider.addEventListener('input', () => {
  const v = parseFloat(dirSlider.value);
  dirValue.textContent = v.toFixed(0) + '°';
  params.direction = v;
});

// ── Scenario selector ──

function loadScenario(key) {
  const scenario = SCENARIOS[key];
  if (!scenario) return;

  params.amplitude = scenario.amplitude;
  params.frequency = scenario.frequency;
  params.speed = scenario.speed;
  params.direction = scenario.direction;

  // Update sliders
  hsSlider.value = scenario.amplitude;
  tpSlider.value = (1 / scenario.frequency).toFixed(1);
  dirSlider.value = scenario.direction;

  hsValue.textContent = scenario.amplitude.toFixed(1) + ' m';
  tpValue.textContent = (1 / scenario.frequency).toFixed(1) + ' s';
  dirValue.textContent = scenario.direction.toFixed(0) + '°';

  showStatus('Escenario: ' + scenario.label);
}

scenarioSelect.addEventListener('change', () => {
  loadScenario(scenarioSelect.value);
});

// ── Reset camera ──

btnReset.addEventListener('click', () => {
  // Smooth camera reset using tween-like approach
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 800; // ms
  const startTime = performance.now();

  function animateReset() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1.0);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(startPos, cameraDefaultPos, ease);
    controls.target.lerpVectors(startTarget, cameraDefaultTarget, ease);
    controls.update();

    if (t < 1.0) {
      requestAnimationFrame(animateReset);
    } else {
      showStatus('Cámara restaurada');
    }
  }

  animateReset();
});

// ── Status bar helper ──

function showStatus(msg) {
  statusBar.textContent = msg;
  statusBar.style.opacity = '1';
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    statusBar.style.opacity = '0.5';
  }, 3000);
}

// ── Load scenario from JSON ──

async function loadScenarioJSON(path) {
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.wave) {
      params.amplitude = data.wave.hs || params.amplitude;
      params.frequency = 1 / (data.wave.tp || 1 / params.frequency);
      params.direction = data.wave.dir || params.direction;

      hsSlider.value = params.amplitude;
      tpSlider.value = (1 / params.frequency).toFixed(1);
      dirSlider.value = params.direction;

      hsValue.textContent = params.amplitude.toFixed(1) + ' m';
      tpValue.textContent = (1 / params.frequency).toFixed(1) + ' s';
      dirValue.textContent = params.direction.toFixed(0) + '°';

      showStatus(`Cargado: ${data.label || path}`);
    }
  } catch (err) {
    console.warn('⚠️ No se pudo cargar escenario JSON:', err.message);
  }
}

// ── Loop ──

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  ocean.update(t, params);
  ocean.setCameraPos(camera.position);
  controls.update();
  renderer.render(scene, camera);
  updateFPS();
}

animate();

// ── Loading screen ──

document.getElementById('loading').classList.add('hidden');
console.log('🌊 WaveThree — Fase 1.1 iniciado');

// ── Intentar cargar JSON del escenario temporal ──

loadScenarioJSON('/data/scenarios/temporal_2026_01_17_1200.json');
