/**
 * WaveThree — Punto de entrada del visor marino
 *
 * Carga la escena, inicializa el océano y el panel de control.
 * Fase 1: MVP visual con ondas Gerstner.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGerstnerOcean } from '../../src/ocean/gerstner.js';
import { createScene } from '../../src/scene/setup.js';

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

// ── UI ──

const hsSlider = document.getElementById('hs-slider');
const tpSlider = document.getElementById('tp-slider');
const dirSlider = document.getElementById('dir-slider');
const hsValue = document.getElementById('hs-value');
const tpValue = document.getElementById('tp-value');
const dirValue = document.getElementById('dir-value');

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

// ── Loop ──

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  ocean.update(t, params);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// ── Loading screen ──

document.getElementById('loading').classList.add('hidden');
console.log('🌊 WaveThree — MVP visual iniciado');