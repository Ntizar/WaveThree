/**
 * Océano espectral — Malla animada con alturas JONSWAP/FFT
 *
 * Genera una malla de superficie oceánica usando campos de alturas
 * calculados con el espectro JONSWAP + FFT 2D en CPU.
 *
 * Cada frame: regenera el campo de alturas con fase temporal
 * actualizada, actualiza los vértices de la malla Three.js.
 *
 * Interfaz compatible con gerstner.js:
 *   createSpectralOcean(params) → { mesh, update }
 */

import * as THREE from 'three';
import { generateHeightField } from './spectrum.js';

// ── Constantes de la malla ───────────────────────────────────────────

const SEGMENTS = 128; // misma resolución que gerstner.js

// ── Shader material para el océano espectral ──────────────────────────

/**
 * Crea el material shader para el océano espectral.
 * Reutiliza la estética del océano Gerstner (colores, fresnel, espuma).
 */
function createSpectralMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x0a2a4a) },
    uColorMid: { value: new THREE.Color(0x1a6a8a) },
    uColorShallow: { value: new THREE.Color(0x2a9aba) },
    uColorFoam: { value: new THREE.Color(0xd8eef8) },
    uSunDir: { value: new THREE.Vector3(0.3, 0.9, 0.2).normalize() },
    uSkyTop: { value: new THREE.Color(0x0a1a3a) },
    uSkyHorizon: { value: new THREE.Color(0x3a7aaa) },
    uFogColor: { value: new THREE.Color(0x2a5a7a) },
    uFogNear: { value: 40.0 },
    uFogFar: { value: 120.0 },
  };

  const vertexShader = `
    uniform float uTime;
    uniform float uFogNear;
    uniform float uFogFar;

    attribute float height;
    attribute vec3 normal;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vHeight;
    varying float vFogDepth;

    void main() {
      vec3 pos = position;
      pos.y = height;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      vNormal = normalize(normalMatrix * normal);
      vHeight = height;
      vFogDepth = length(worldPos.xyz - cameraPosition);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColorDeep;
    uniform vec3 uColorMid;
    uniform vec3 uColorShallow;
    uniform vec3 uColorFoam;
    uniform vec3 uSunDir;
    uniform vec3 uSkyTop;
    uniform vec3 uSkyHorizon;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vHeight;
    varying float vFogDepth;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      // --- Iluminación difusa ---
      float diffuse = max(dot(normal, uSunDir), 0.0);
      float ambient = 0.12;
      float lighting = ambient + diffuse * 0.88;

      // --- Color por profundidad ---
      float heightNorm = clamp(vHeight / 4.0 + 0.5, 0.0, 1.0);
      vec3 waterColor = uColorDeep;
      waterColor = mix(waterColor, uColorMid, smoothstep(0.0, 0.4, heightNorm));
      waterColor = mix(waterColor, uColorShallow, smoothstep(0.4, 0.7, heightNorm));

      // --- Espuma dinámica en crestas ---
      float foamThreshold = 0.55 + 0.15 * (1.0 - diffuse);
      float foam = smoothstep(foamThreshold, 1.0, heightNorm);
      float foamEdge = smoothstep(0.3, 0.6, abs(heightNorm - 0.5) * 2.0) * 0.3;
      foam = max(foam, foamEdge);
      vec3 color = mix(waterColor, uColorFoam, foam * 0.5);

      // --- Fresnel ---
      float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
      fresnel = pow(fresnel, 4.0);
      vec3 fresnelColor = mix(uColorFoam * 0.4, uColorFoam * 0.7, fresnel);
      color = mix(color, fresnelColor, fresnel * 0.6);

      // --- Reflejo especular (Blinn-Phong) ---
      vec3 halfDir = normalize(uSunDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
      color += uColorFoam * spec * 0.6;

      // --- Reflejo del cielo (simulado) ---
      float reflectDot = max(dot(reflect(-viewDir, normal), uSunDir), 0.0);
      vec3 skyColor = mix(uSkyHorizon, uSkyTop, pow(1.0 - abs(normal.y), 2.0));
      color = mix(color, skyColor, fresnel * 0.25);

      // --- Aplicar iluminación ---
      color *= lighting;

      // --- Niebla marina ---
      float fogFactor = clamp((vFogDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
      color = mix(color, uFogColor, fogFactor * 0.8);

      // --- Brillo ambiental mínimo ---
      color += 0.04;

      // --- Corrección de gamma ---
      color = pow(color, vec3(1.0 / 2.2));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });
}

// ── Interpolación lineal entre frames ─────────────────────────────────

/**
 * Interpola linealmente entre dos campos de alturas.
 *
 * @param {Float32Array} a - Campo A
 * @param {Float32Array} b - Campo B
 * @param {number} t - Factor de interpolación [0, 1]
 * @returns {Float32Array} Campo interpolado
 */
function lerpHeightFields(a, b, t) {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * (1 - t) + b[i] * t;
  }
  return result;
}

// ── Crear océano espectral ────────────────────────────────────────────

/**
 * Crea un océano espectral con malla Three.js animada.
 *
 * Parámetros:
 *   - hs: Altura significativa (m)
 *   - tp: Periodo pico (s)
 *   - dir: Dirección media (grados)
 *   - N: Resolución de la FFT (64 o 128)
 *   - L: Tamaño del dominio (m)
 *   - windSpeed: Velocidad del viento (m/s) — usado para gamma
 *   - windDir: Dirección del viento (grados)
 *
 * @param {object} params - Parámetros del océano
 * @returns {{ mesh: THREE.Mesh, update: function }}
 */
export function createSpectralOcean(params) {
  const {
    hs = 3.2,
    tp = 8.7,
    dir = 245,
    N = 128,
    L = 64,
    windSpeed = 17.5,
    windDir = 240,
  } = params;

  // Calcular gamma a partir de windSpeed (relación empírica)
  // gamma ≈ 3.3 para vientos moderados, sube con viento fuerte
  const gamma = Math.min(5.0, 3.3 + (windSpeed - 10) * 0.05);

  // Generar geometría base
  const geometry = new THREE.PlaneGeometry(L, L, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  // Añadir atributos custom para height y normal
  const vertexCount = (SEGMENTS + 1) * (SEGMENTS + 1);
  geometry.setAttribute('height', new THREE.Float32BufferAttribute(new Float32Array(vertexCount), 1));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(vertexCount * 3), 3));

  // Crear material
  const material = createSpectralMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  // Parámetros del campo de alturas
  const heightParams = {
    Hs: hs,
    Tp: tp,
    dir: dir,
    N: N,
    L: L,
    gamma: gamma,
    spread: 0.5,
  };

  // Campos de alturas actuales y anteriores para interpolación
  let currentHeights = generateHeightField(heightParams);
  let prevHeights = new Float32Array(currentHeights.length);
  let interpT = 0;

  // Tiempo acumulado
  let elapsed = 0;

  // Actualizar los vértices de la malla con el campo de alturas
  function updateMesh(heights) {
    const positions = geometry.attributes.position.array;
    const heightAttr = geometry.attributes.height;
    const normalAttr = geometry.attributes.normal;

    for (let i = 0; i < vertexCount; i++) {
      // Altura suavizada (clip suave para evitar picos extremos)
      const smoothH = Math.tanh(heights[i] / 3.0) * 3.0;
      positions[i * 3 + 1] = smoothH;
      heightAttr.array[i] = smoothH;

      // Normal aproximada por diferencia finita
      // Encontrar índices de vecinos en la malla
      const row = Math.floor(i / (SEGMENTS + 1));
      const col = i % (SEGMENTS + 1);

      const hL = heights[Math.max(0, i - 1)];
      const hR = heights[Math.min(vertexCount - 1, i + 1)];
      const hD = heights[Math.max(0, i - (SEGMENTS + 1))];
      const hU = heights[Math.min(vertexCount - 1, i + (SEGMENTS + 1))];

      const dx = L / SEGMENTS;
      const dz = L / SEGMENTS;

      // Normal por gradiente
      let nx = -(hR - hL) / (2 * dx);
      let nz = -(hU - hD) / (2 * dz);
      let ny = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      normalAttr.array[i * 3] = nx;
      normalAttr.array[i * 3 + 1] = ny;
      normalAttr.array[i * 3 + 2] = nz;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.height.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  // Actualizar los parámetros del océano (llamado desde main.js)
  function update(time, newParams) {
    elapsed = time;

    // Actualizar parámetros si se proporcionan
    if (newParams) {
      if (newParams.amplitude !== undefined) heightParams.Hs = newParams.amplitude;
      if (newParams.frequency !== undefined) heightParams.Tp = 1 / newParams.frequency;
      if (newParams.direction !== undefined) heightParams.dir = newParams.direction;
      if (newParams.windSpeed !== undefined) {
        heightParams.gamma = Math.min(5.0, 3.3 + (newParams.windSpeed - 10) * 0.05);
      }
    }

    // Generar nuevo campo cada ~0.1s para rendimiento
    const regenerationInterval = 0.1;
    const regenCount = Math.floor(time / regenerationInterval);
    const regenCountPrev = Math.floor((time - 0.016) / regenerationInterval);

    if (regenCount !== regenCountPrev) {
      // Generar nuevo campo
      prevHeights = new Float32Array(currentHeights);
      currentHeights = generateHeightField(heightParams);
      interpT = 0;
    }

    // Interpolar entre frames
    interpT = (time % regenerationInterval) / regenerationInterval;
    const blended = lerpHeightFields(prevHeights, currentHeights, interpT);

    updateMesh(blended);

    // Actualizar uniforms del shader
    material.uniforms.uTime.value = time;
  }

  // Inicializar malla con el primer frame
  updateMesh(currentHeights);

  return { mesh, update };
}
