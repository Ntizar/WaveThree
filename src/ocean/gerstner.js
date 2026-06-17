/**
 * Océano con ondas Gerstner — Fase 1.1: MVP visual mejorado
 *
 * Superficie marina mediante suma de ondas Gerstner en vertex shader.
 * Shader con espuma dinámica, color oceánico por profundidad,
 * Fresnel, reflejo especular y skybox simulado.
 *
 * Parámetros: amplitud (Hs), frecuencia (1/Tp), dirección, velocidad
 * Referencia: discourse.threejs.org/t/classic-ocean-shader-example-with-gestner-waves/29227
 */

import * as THREE from 'three';

const WIDTH = 64;
const SEGMENTS = 128;
const WAVE_COUNT = 10;

/**
 * Genera ondas Gerstner pseudoaleatorias con distribución realista
 */
function generateWaves(params) {
  const waves = [];
  const baseFreq = params.frequency || 0.4;
  const baseAmp = params.amplitude || 3.2;
  const baseDir = (params.direction || 245) * Math.PI / 180;

  // Distribución de ondas: más energía en frecuencias medias
  for (let i = 0; i < WAVE_COUNT; i++) {
    const spread = (i - WAVE_COUNT / 2) * 0.12;
    const angle = baseDir + spread + (Math.sin(i * 2.3) * 0.08);
    const freq = baseFreq * (0.5 + i * 0.12 + Math.sin(i * 1.7) * 0.05);
    const amp = baseAmp * (0.18 - i * 0.012) * (1 + Math.sin(i * 3.1) * 0.2);
    const speed = 0.3 + i * 0.06 + Math.sin(i * 2.1) * 0.02;
    const phase = i * 1.7 + i * 0.3;

    if (amp > 0.01) {
      waves.push({ angle, freq, amp, speed, phase, steepness: Math.min(0.8, amp * freq * 0.6) });
    }
  }

  return waves;
}

/**
 * Crea la malla del océano con shader mejorado
 */
export function createGerstnerOcean(params) {
  const geometry = new THREE.PlaneGeometry(WIDTH, WIDTH, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const waves = generateWaves(params);

  const uniforms = {
    uTime: { value: 0 },
    uWaves: { value: waves.flatMap(w => [w.angle, w.freq, w.amp, w.speed, w.phase, w.steepness]) },
    uWaveCount: { value: waves.length },
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
    uniform float uWaves[${waves.length * 6}];
    uniform int uWaveCount;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vHeight;
    varying float vFogDepth;

    void main() {
      vec3 pos = position;
      vec3 norm = vec3(0.0, 1.0, 0.0);
      float height = 0.0;
      float totalAmp = 0.0;

      for (int i = 0; i < ${waves.length}; i++) {
        int idx = i * 6;
        float angle    = uWaves[idx];
        float freq     = uWaves[idx + 1];
        float amp      = uWaves[idx + 2];
        float speed    = uWaves[idx + 3];
        float phase    = uWaves[idx + 4];
        float steep    = uWaves[idx + 5];

        vec2 dir = vec2(cos(angle), sin(angle));
        float x = dot(pos.xz, dir);
        float wave = amp * sin(freq * x + uTime * speed + phase);

        // Gerstner: desplazamiento horizontal para crestas pronunciadas
        float cosWave = cos(freq * x + uTime * speed + phase);
        pos.x += steep * dir.x * cosWave;
        pos.z += steep * dir.y * cosWave;
        pos.y += wave;
        height += wave;
        totalAmp += amp;

        // Normal perturbada por la ola
        float steepDeriv = steep * sin(freq * x + uTime * speed + phase);
        norm.x -= dir.x * steepDeriv;
        norm.z -= dir.y * steepDeriv;
      }

      norm = normalize(norm);
      vNormal = norm;
      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
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
      // Espuma secundaria en bordes de ola
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

      // --- Corrección de gamma aproximada ---
      color = pow(color, vec3(1.0 / 2.2));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
  });

  const mesh = new THREE.Mesh(geometry, material);

  function update(time, newParams) {
    uniforms.uTime.value = time;
    if (newParams) {
      const newWaves = generateWaves(newParams);
      uniforms.uWaves.value = newWaves.flatMap(w => [w.angle, w.freq, w.amp, w.speed, w.phase, w.steepness]);
      uniforms.uWaveCount.value = newWaves.length;
    }
  }

  return { mesh, update };
}