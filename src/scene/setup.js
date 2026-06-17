/**
 * Configuración de escena Three.js para WaveThree
 *
 * Crea escena, cámara, luces y renderizador con detección de WebGPU.
 */

import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1628);
  scene.fog = new THREE.Fog(0x0a1628, 60, 150);

  // ── Cámara ──

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(30, 20, 30);
  camera.lookAt(0, 0, 0);

  // ── Renderizador WebGPU / WebGL fallback ──

  let renderer;
  if (navigator.gpu) {
    try {
      renderer = new THREE.WebGPURenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      console.log('🌊 WebGPU activo');
    } catch {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      console.log('🌊 WebGL fallback');
    }
  } else {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    console.log('🌊 WebGL (WebGPU no disponible)');
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.body.appendChild(renderer.domElement);

  // ── Luces ──

  const ambientLight = new THREE.AmbientLight(0x4466aa, 0.4);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffeedd, 2.0);
  sunLight.position.set(50, 80, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
  fillLight.position.set(-50, 20, -30);
  scene.add(fillLight);

  // ── Cielo (hemisphere) ──

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a2a4a, 0.6);
  scene.add(hemiLight);

  // ── Grid de referencia ──

  const gridHelper = new THREE.GridHelper(80, 40, 0x3388ff, 0x224488);
  gridHelper.position.y = -1;
  scene.add(gridHelper);

  // ── Resize ──

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}