/**
 * Configuración de escena Three.js para WaveThree
 *
 * Crea escena, cámara, luces y renderizador con detección de WebGPU.
 * Fase 1.1: fondo degradado simulado, niebla marina, luces mejoradas.
 */

import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();

  // ── Fondo degradado simulado (sky gradient) ──
  // Usamos un ShaderMaterial en un plano gigante como cielo
  const skyGeo = new THREE.SphereGeometry(200, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform float uTime;
      void main() {
        float h = normalize(vWorldPos).y;
        // Gradiente: horizonte azul-gris → zenit azul oscuro
        vec3 horizon = vec3(0.45, 0.62, 0.78);
        vec3 mid = vec3(0.25, 0.45, 0.65);
        vec3 zenith = vec3(0.04, 0.08, 0.18);
        vec3 col;
        if (h < 0.0) {
          col = horizon;
        } else {
          col = mix(horizon, mid, pow(h, 0.5));
          col = mix(col, zenith, pow(h, 1.5));
        }
        // Sol
        vec3 sunDir = normalize(vec3(0.3, 0.35, 0.5));
        float sunDot = max(dot(normalize(vWorldPos), sunDir), 0.0);
        col += vec3(1.0, 0.9, 0.6) * pow(sunDot, 128.0) * 2.0;
        col += vec3(1.0, 0.85, 0.5) * pow(sunDot, 16.0) * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Niebla marina suave (color azul claro)
  scene.fog = new THREE.FogExp2(0x8ab4cc, 0.006);

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
  renderer.toneMappingExposure = 1.3;
  document.body.appendChild(renderer.domElement);

  // ── Luces mejoradas ──

  // Ambient: luz base azulada suave
  const ambientLight = new THREE.AmbientLight(0x3355aa, 0.3);
  scene.add(ambientLight);

  // Sol principal: cálido, con sombras
  const sunLight = new THREE.DirectionalLight(0xffeedd, 2.5);
  sunLight.position.set(50, 80, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  scene.add(sunLight);

  // Fill: luz azul desde el lado opuesto (reflejo del cielo)
  const fillLight = new THREE.DirectionalLight(0x5588cc, 0.5);
  fillLight.position.set(-50, 20, -30);
  scene.add(fillLight);

  // Rim light: borde para destacar crestas
  const rimLight = new THREE.DirectionalLight(0x88bbff, 0.3);
  rimLight.position.set(0, 10, -50);
  scene.add(rimLight);

  // Hemisphere: cielo → mar
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x0a2a4a, 0.5);
  scene.add(hemiLight);

  // ── Grid de referencia (más sutil) ──

  const gridHelper = new THREE.GridHelper(80, 40, 0x2266aa, 0x113366);
  gridHelper.position.y = -1;
  gridHelper.material.opacity = 0.3;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // ── Resize ──

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, skyMat };
}
