/**
 * Shader personalizado para la batimetría del fondo marino.
 *
 * Características:
 *   - Color por profundidad: azul marino profundo → azul medio → arena beige → verde tierra
 *   - Sombreado básico con luz direccional (Phong simplificado)
 *   - Bandas de profundidad tipo mapa batimétrico (contour lines opcionales)
 *   - Niebla submarina para profundidad atmosférica
 */

import * as THREE from 'three';

// ── Paleta de colores batimétricos ────────────────────────────────────

/**
 * Colores por bandas de profundidad (en metros, valores absolutos).
 * Cada entrada: { depth: metros, color: hex }
 */
const DEPTH_BANDS = [
  { depth: 0,    color: new THREE.Color(0x8B7355) },  // Arena húmeda (superficie)
  { depth: 5,    color: new THREE.Color(0xC2A66B) },  // Arena clara
  { depth: 15,   color: new THREE.Color(0x5B8C5A) },  // Verde algas (poco profundo)
  { depth: 30,   color: new THREE.Color(0x2E7D8F) },  // Turquesa poco profunda
  { depth: 60,   color: new THREE.Color(0x1A5A7A) },  // Azul medio
  { depth: 100,  color: new THREE.Color(0x0D3B5E) },  // Azul profundo
  { depth: 200,  color: new THREE.Color(0x061A2E) },  // Azul muy profundo
  { depth: 500,  color: new THREE.Color(0x020A14) },  // Abismo oscuro
];

/**
 * Interpola color según profundidad usando bandas predefinidas.
 * @param {number} depth - Profundidad en metros (negativo)
 * @param {number} minDepth - Profundidad mínima del dataset
 * @param {number} maxDepth - Profundidad máxima del dataset
 * @returns {THREE.Color}
 */
function getDepthColor(depth, minDepth, maxDepth) {
  const absDepth = Math.abs(depth);
  const range = maxDepth - minDepth;

  if (range <= 0) return DEPTH_BANDS[0].color.clone();

  // Buscar la banda correcta
  let lower = DEPTH_BANDS[0];
  let upper = DEPTH_BANDS[DEPTH_BANDS.length - 1];

  for (let i = 0; i < DEPTH_BANDS.length - 1; i++) {
    if (absDepth >= DEPTH_BANDS[i].depth && absDepth < DEPTH_BANDS[i + 1].depth) {
      lower = DEPTH_BANDS[i];
      upper = DEPTH_BANDS[i + 1];
      break;
    }
  }

  // Interpolación lineal entre bandas
  const lowerRange = upper.depth - lower.depth;
  const t = lowerRange > 0 ? (absDepth - lower.depth) / lowerRange : 0;
  const clampedT = Math.max(0, Math.min(1, t));

  return lower.color.clone().lerp(upper.color, clampedT);
}

// ── Shader material ──────────────────────────────────────────────────

/**
 * Crea un ShaderMaterial para la batimetría.
 * @param {object} opts
 * @param {number} opts.minDepth - Profundidad mínima del dataset
 * @param {number} opts.maxDepth - Profundidad máxima del dataset
 * @param {number} opts.effectiveMaxDepth - Rango de profundidad efectivo
 * @param {THREE.Scene} [opts.scene] - Escena para extraer luces
 * @returns {THREE.ShaderMaterial}
 */
export function createBathymetryMaterial(opts) {
  const { minDepth, maxDepth, effectiveMaxDepth, scene } = opts;

  // Extraer luz direccional principal de la escena si está disponible
  let sunColor = new THREE.Color(0xffeedd);
  let sunDir = new THREE.Vector3(0.3, 0.9, 0.2).normalize();
  let ambientColor = new THREE.Color(0x1a3a5a);
  let ambientIntensity = 0.25;

  if (scene) {
    for (const light of scene.children) {
      if (light.isDirectionalLight && light.intensity > 1) {
        sunColor.copy(light.color);
        sunDir.copy(light.position).normalize();
      }
      if (light.isAmbientLight) {
        ambientColor.copy(light.color);
        ambientIntensity = light.intensity;
      }
    }
  }

  const uniforms = {
    uMinDepth: { value: minDepth },
    uMaxDepth: { value: maxDepth },
    uEffectiveMaxDepth: { value: effectiveMaxDepth },
    uSunColor: { value: sunColor },
    uSunDir: { value: sunDir },
    uAmbientColor: { value: ambientColor },
    uAmbientIntensity: { value: ambientIntensity },
    uFogColor: { value: new THREE.Color(0x020A14) },
    uFogDensity: { value: 0.015 },
    uContourLines: { value: 1.0 }, // 0 = off, 1 = on
    uContourInterval: { value: 20.0 }, // metros entre líneas
    uContourWidth: { value: 0.02 },
  };

  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vDepth;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vDepth = position.y;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = `
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform vec3 uAmbientColor;
    uniform float uAmbientIntensity;
    uniform float uMinDepth;
    uniform float uMaxDepth;
    uniform float uEffectiveMaxDepth;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uContourLines;
    uniform float uContourInterval;
    uniform float uContourWidth;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vDepth;
    varying vec2 vUv;

    // ── Paleta batimétrica ──
    vec3 getBathyColor(float depth) {
      // Bandas: arena → algas → turquesa → azul medio → azul profundo → abismo
      vec3 c1 = vec3(0.55, 0.45, 0.33);  // Arena húmeda
      vec3 c2 = vec3(0.76, 0.65, 0.42);  // Arena clara
      vec3 c3 = vec3(0.36, 0.55, 0.35);  // Verde algas
      vec3 c4 = vec3(0.18, 0.49, 0.56);  // Turquesa
      vec3 c5 = vec3(0.10, 0.35, 0.48);  // Azul medio
      vec3 c6 = vec3(0.05, 0.23, 0.37);  // Azul profundo
      vec3 c7 = vec3(0.02, 0.10, 0.18);  // Muy profundo
      vec3 c8 = vec3(0.01, 0.04, 0.08);  // Abismo

      float absDepth = abs(depth);
      vec3 color;

      if (absDepth < 5.0) {
        color = mix(c1, c2, absDepth / 5.0);
      } else if (absDepth < 15.0) {
        color = mix(c2, c3, (absDepth - 5.0) / 10.0);
      } else if (absDepth < 30.0) {
        color = mix(c3, c4, (absDepth - 15.0) / 15.0);
      } else if (absDepth < 60.0) {
        color = mix(c4, c5, (absDepth - 30.0) / 30.0);
      } else if (absDepth < 100.0) {
        color = mix(c5, c6, (absDepth - 60.0) / 40.0);
      } else if (absDepth < 200.0) {
        color = mix(c6, c7, (absDepth - 100.0) / 100.0);
      } else {
        color = mix(c7, c8, min((absDepth - 200.0) / 300.0, 1.0));
      }

      return color;
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      // ── Iluminación Phong básica ──
      float diff = max(dot(normal, uSunDir), 0.0);
      vec3 halfDir = normalize(uSunDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

      vec3 ambient = uAmbientColor * uAmbientIntensity;
      vec3 diffuse = uSunColor * diff * 0.7;
      vec3 specular = uSunColor * spec * 0.15;

      // ── Color por profundidad ──
      vec3 depthColor = getBathyColor(vDepth);

      // ── Aplicar iluminación ──
      vec3 color = depthColor * (ambient + diffuse) + specular;

      // ── Bandas de profundidad (contour lines) ──
      if (uContourLines > 0.5) {
        float contour = abs(fract(vDepth / uContourInterval) - 0.5);
        float line = smoothstep(0.0, uContourWidth, contour);
        line = 1.0 - line; // líneas oscuras
        color = mix(color, vec3(0.0), line * 0.3);
      }

      // ── Niebla submarina (exponencial) ──
      float dist = length(cameraPosition - vWorldPosition);
      float fogFactor = 1.0 - exp(-uFogDensity * dist * uFogDensity * dist);
      fogFactor = clamp(fogFactor, 0.0, 1.0);
      color = mix(color, uFogColor, fogFactor);

      // ── Brillo mínimo para evitar negro total ──
      color += vec3(0.01, 0.015, 0.02);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
    depthWrite: true,
  });
}
