/**
 * Océano con ondas Gerstner — Fase 1: MVP visual
 *
 * Superficie marina mediante suma de ondas Gerstner en vertex shader.
 * Parámetros: amplitud, frecuencia, dirección, velocidad.
 *
 * Referencia: discourse.threejs.org/t/classic-ocean-shader-example-with-gestner-waves/29227
 */

import * as THREE from 'three';

const WIDTH = 64;
const SEGMENTS = 128;
const WAVE_COUNT = 6;

/**
 * Genera ondas Gerstner pseudoaleatorias a partir de parámetros base.
 */
function generateWaves(params) {
  const waves = [];
  const baseFreq = params.frequency || 0.4;
  const baseAmp = params.amplitude || 3.2;
  const baseDir = (params.direction || 245) * Math.PI / 180;

  for (let i = 0; i < WAVE_COUNT; i++) {
    const angle = baseDir + (i - WAVE_COUNT / 2) * 0.15;
    const freq = baseFreq * (0.6 + i * 0.15);
    const amp = baseAmp * (1.0 - i * 0.12) / WAVE_COUNT;
    const speed = params.speed || (0.5 + i * 0.08);
    const phase = i * 1.7;

    waves.push({ angle, freq, amp, speed, phase });
  }

  return waves;
}

/**
 * Crea la malla del océano con un material que desplaza vértices en el vertex shader
 * usando la suma de ondas Gerstner.
 */
export function createGerstnerOcean(params) {
  const geometry = new THREE.PlaneGeometry(WIDTH, WIDTH, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const waves = generateWaves(params);

  // Construir uniforms para pasar ondas al shader
  const uniforms = {
    uTime: { value: 0 },
    uWaves: { value: waves.flatMap(w => [w.angle, w.freq, w.amp, w.speed, w.phase]) },
    uWaveCount: { value: WAVE_COUNT },
    uColorDeep: { value: new THREE.Color(0x0a3a5a) },
    uColorShallow: { value: new THREE.Color(0x1a7a9a) },
    uColorFoam: { value: new THREE.Color(0xc8e8f0) },
  };

  const vertexShader = `
    uniform float uTime;
    uniform float uWaves[${WAVE_COUNT * 5}];
    uniform int uWaveCount;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vHeight;

    void main() {
      vec3 pos = position;
      vec3 norm = vec3(0.0, 1.0, 0.0);
      float height = 0.0;

      for (int i = 0; i < ${WAVE_COUNT}; i++) {
        int idx = i * 5;
        float angle = uWaves[idx];
        float freq  = uWaves[idx + 1];
        float amp   = uWaves[idx + 2];
        float speed = uWaves[idx + 3];
        float phase = uWaves[idx + 4];

        vec2 dir = vec2(cos(angle), sin(angle));
        float x = dot(pos.xz, dir);
        float wave = amp * sin(freq * x + uTime * speed + phase);

        // Gerstner: desplazamiento horizontal para crestas más pronunciadas
        float q = amp * freq * 0.8;
        float cosWave = cos(freq * x + uTime * speed + phase);
        pos.x += q * dir.x * cosWave;
        pos.z += q * dir.y * cosWave;
        pos.y += wave;
        height += wave;

        // Normal aproximada
        float steep = q * sin(freq * x + uTime * speed + phase);
        norm.x -= dir.x * steep;
        norm.z -= dir.y * steep;
      }

      norm = normalize(norm);
      vNormal = norm;
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      vHeight = height;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uColorFoam;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vHeight;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
      float diffuse = max(dot(normal, lightDir), 0.15);

      // Color por altura (profundo → somero)
      float heightNorm = clamp(vHeight / 3.0 + 0.5, 0.0, 1.0);
      vec3 waterColor = mix(uColorDeep, uColorShallow, heightNorm);

      // Espuma en crestas
      float foam = smoothstep(0.6, 1.0, heightNorm);
      vec3 color = mix(waterColor, uColorFoam, foam * 0.4);

      // Fresnel aproximado
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
      fresnel = pow(fresnel, 3.0);
      color = mix(color, uColorFoam * 0.3, fresnel * 0.5);

      color *= diffuse * 1.2;
      color += 0.05; // ambient mínimo

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
    wireframe: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  function update(time, newParams) {
    uniforms.uTime.value = time;
    if (newParams) {
      const newWaves = generateWaves(newParams);
      uniforms.uWaves.value = newWaves.flatMap(w => [w.angle, w.freq, w.amp, w.speed, w.phase]);
    }
  }

  return { mesh, update };
}