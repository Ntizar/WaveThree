/**
 * Configuración de escena Three.js para WaveThree
 *
 * Crea escena con cielo degradado, cámara, luces, niebla
 * y renderizador con detección de WebGPU.
 */

import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  // Fondo degradado marino (se maneja con el shader del cielo)
  scene.background = null;

  // ── Cielo degradado con shader ──

  const skyGeo = new THREE.SphereGeometry(200, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTopColor: { value: new THREE.Color(0x0a1a3a) },
      uBottomColor: { value: new THREE.Color(0x3a7aaa) },
      uHorizonColor: { value: new THREE.Color(0x5a8aba) },
      uSunPosition: { value: new THREE.Vector3(0.3, 0.7, 0.4).normalize() },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunPosition;

      varying vec3 vPosition;

      void main() {
        vec3 dir = normalize(vPosition);
        float heightFactor = dir.y * 0.5 + 0.5;

        // Degradado vertical
        vec3 sky = mix(uBottomColor, uTopColor, pow(heightFactor, 0.6));

        // Brillo alrededor del sol
        float sunAngle = max(dot(dir, uSunPosition), 0.0);
        float sunGlow = pow(sunAngle, 32.0);
        sky += vec3(1.0, 0.9, 0.7) * sunGlow * 0.3;

        // Círculo solar
        float sunDisc = pow(sunAngle, 128.0);
        sky += vec3(1.0, 0.95, 0.8) * sunDisc;

        // Brillo en el horizonte
        float horizonGlow = exp(-pow((heightFactor - 0.45) * 8.0, 2.0));
        sky = mix(sky, uHorizonColor, horizonGlow * 0.3);

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // ── Niebla marina ──

  scene.fog = new THREE.FogExp2(0x2a5a7a, 0.006);

  // ── Cámara ──

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(30, 18, 30);
  camera.lookAt(0, 0, 0);

  // ── Renderizador WebGL optimizado ──
  // WebGPU estará disponible en una fase posterior cuando Three.js
  // tenga soporte estable para compute shaders y el bundle webgpu.

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.bias = 0.0001;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.prepend(renderer.domElement);

  // ── Luces ──

  const ambientLight = new THREE.AmbientLight(0x4466aa, 0.3);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffeedd, 2.5);
  sunLight.position.set(30, 60, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 150;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
  fillLight.position.set(-40, 20, -30);
  scene.add(fillLight);

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a2a4a, 0.5);
  scene.add(hemiLight);

  // ── Grid de referencia (sutil) ──

  const gridHelper = new THREE.GridHelper(80, 40, 0x2266aa, 0x224488);
  gridHelper.position.y = -2;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.3;
  scene.add(gridHelper);

  // ── Resize ──

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}