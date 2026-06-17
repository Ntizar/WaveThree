/**
 * Océano con ondas Gerstner — Fase 1.1: MVP visual mejorado
 *
 * Superficie marina mediante suma de ondas Gerstner en vertex shader.
 * Mejoras:
 *   - Reflejo especular Blinn-Phong
 *   - Espuma en crestas con threshold variable y detalle de alta frecuencia
 *   - Color oceánico rico: azul profundo → verde-azul claro con variación
 *   - Fresnel más pronunciado con Schlick approximation
 *   - Skybox simulado: gradiente cielo + sol en shader
 *   - WAVE_COUNT = 10 para más detalle
 *
 * Referencia: discourse.threejs.org/t/classic-ocean-shader-example-with-gestner-waves/29227
 */

import * as THREE from 'three';

const WIDTH = 64;
const SEGMENTS = 128;
const WAVE_COUNT = 10;

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
    const freq = baseFreq * (0.5 + i * 0.18);
    const amp = baseAmp * (1.0 - i * 0.09) / WAVE_COUNT;
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
    uColorDeep: { value: new THREE.Color(0x011a33) },
    uColorMid: { value: new THREE.Color(0x0a5c7a) },
    uColorShallow: { value: new THREE.Color(0x2db8a8) },
    uColorFoam: { value: new THREE.Color(0xe8f4f8) },
    uSkyTop: { value: new THREE.Color(0x0b1a3a) },
    uSkyHorizon: { value: new THREE.Color(0x5a9abf) },
    uSkySun: { value: new THREE.Color(0xffe4a0) },
    uSunDir: { value: new THREE.Vector3(0.3, 0.7, 0.5) },
    uSunIntensity: { value: 1.8 },
    uCameraPos: { value: new THREE.Vector3(30, 20, 30) },
  };

  const vertexShader = `
    uniform float uTime;
    uniform float uWaves[${WAVE_COUNT * 5}];
    uniform int uWaveCount;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vHeight;
    varying float vSteepness;
    varying vec2 vUv;

    void main() {
      vec3 pos = position;
      vec3 norm = vec3(0.0, 1.0, 0.0);
      float height = 0.0;
      float steepness = 0.0;

      for (int i = 0; i < ${WAVE_COUNT}; i++) {
        int idx = i * 5;
        float angle = uWaves[idx];
        float freq  = uWaves[idx + 1];
        float amp   = uWaves[idx + 2];
        float speed = uWaves[idx + 3];
        float phase = uWaves[idx + 4];

        vec2 dir = vec2(cos(angle), sin(angle));
        float x = dot(pos.xz, dir);
        float wavePhase = freq * x + uTime * speed + phase;
        float wave = amp * sin(wavePhase);

        // Gerstner: desplazamiento horizontal para crestas más pronunciadas
        float q = amp * freq * 0.75;
        float cosWave = cos(wavePhase);
        pos.x += q * dir.x * cosWave;
        pos.z += q * dir.y * cosWave;
        pos.y += wave;
        height += wave;

        // Steepness para espuma
        float steep = q * sin(wavePhase);
        steepness += abs(steep);

        // Normal aproximada
        norm.x -= dir.x * steep;
        norm.z -= dir.y * steep;
      }

      norm = normalize(norm);
      vNormal = norm;
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      vHeight = height;
      vSteepness = steepness;
      vUv = uv;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColorDeep;
    uniform vec3 uColorMid;
    uniform vec3 uColorShallow;
    uniform vec3 uColorFoam;
    uniform vec3 uSkyTop;
    uniform vec3 uSkyHorizon;
    uniform vec3 uSkySun;
    uniform vec3 uSunDir;
    uniform float uSunIntensity;
    uniform vec3 uCameraPos;
    uniform float uTime;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vHeight;
    varying float vSteepness;
    varying vec2 vUv;

    // ── Schlick Fresnel ──
    float fresnelSchlick(float cosTheta, vec3 F0) {
      return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    }

    // ── Blinn-Phong specular ──
    float blinnPhong(vec3 normal, vec3 viewDir, vec3 lightDir, float shininess) {
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = max(dot(normal, halfDir), 0.0);
      return pow(spec, shininess) * uSunIntensity;
    }

    // ── Sky gradient ──
    vec3 getSkyColor(vec3 dir) {
      float t = max(dir.y, 0.0);
      // Gradiente: horizonte → zenit
      vec3 sky = mix(uSkyHorizon, uSkyTop, pow(t, 0.6));
      // Sol
      float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
      sky += uSkySun * pow(sunDot, 64.0) * 1.5;
      sky += uSkySun * pow(sunDot, 8.0) * 0.3;
      return sky;
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(uCameraPos - vWorldPosition);
      vec3 lightDir = normalize(uSunDir);

      // ── Color base: 3 tonos por altura ──
      float heightNorm = clamp(vHeight / 4.0 + 0.5, 0.0, 1.0);
      vec3 waterColor;
      if (heightNorm < 0.5) {
        waterColor = mix(uColorDeep, uColorMid, heightNorm * 2.0);
      } else {
        waterColor = mix(uColorMid, uColorShallow, (heightNorm - 0.5) * 2.0);
      }

      // ── Micro-olas para detalle de alta frecuencia ──
      float microWave = 0.0;
      microWave += 0.08 * sin(vWorldPosition.x * 3.7 + uTime * 2.1);
      microWave += 0.06 * sin(vWorldPosition.z * 4.3 + uTime * 1.7);
      microWave += 0.04 * sin((vWorldPosition.x + vWorldPosition.z) * 5.1 + uTime * 2.5);
      waterColor += microWave * 0.03;

      // ── Fresnel con Schlick ──
      float NdotV = max(dot(normal, viewDir), 0.0);
      vec3 F0 = vec3(0.04); // Fresnel base para agua
      float fresnel = fresnelSchlick(NdotV, F0);
      // Hacerlo más pronunciado
      fresnel = mix(fresnel, 1.0, pow(1.0 - NdotV, 3.0));
      vec3 skyColor = getSkyColor(normalize(viewDir - normal * 0.5));
      waterColor = mix(waterColor, skyColor, fresnel * 0.85);

      // ── Specular Blinn-Phong ──
      float specular = blinnPhong(normal, viewDir, lightDir, 256.0);
      // Specular secundario (más amplio, más suave)
      float specularSoft = blinnPhong(normal, viewDir, lightDir, 32.0);
      vec3 sunColor = vec3(1.0, 0.95, 0.85);
      waterColor += sunColor * (specular * 0.6 + specularSoft * 0.15);

      // ── Reflejo especular extendido (path-like) ──
      vec3 reflDir = reflect(-viewDir, normal);
      float reflSky = getSkyColor(reflDir).r;
      waterColor += vec3(0.15, 0.2, 0.25) * reflSky * pow(1.0 - NdotV, 2.0) * 0.3;

      // ── Espuma en crestas ──
      // Steepness threshold variable
      float foamThreshold = 0.35 - 0.05 * sin(uTime * 0.3);
      float foam = smoothstep(foamThreshold, foamThreshold + 0.3, vSteepness);
      // Espuma adicional en picos de altura
      float peakFoam = smoothstep(1.2, 2.0, vHeight);
      foam = max(foam, peakFoam * 0.5);
      // Micro-espuma: textura procedural
      float microFoam = smoothstep(0.5, 1.0, sin(vWorldPosition.x * 2.0 + vWorldPosition.z * 1.5 + uTime * 0.8));
      foam += microFoam * 0.08 * peakFoam;
      foam = clamp(foam, 0.0, 1.0);
      waterColor = mix(waterColor, uColorFoam, foam * 0.7);

      // ── Ambient ──
      waterColor += vec3(0.02, 0.03, 0.05);

      // ── Fog (se aplica aquí para coincidir con la escena) ──
      float dist = length(uCameraPos - vWorldPosition);
      float fogFactor = 1.0 - exp(-dist * 0.008);
      vec3 fogColor = vec3(0.55, 0.7, 0.85);
      waterColor = mix(waterColor, fogColor, fogFactor * 0.4);

      gl_FragColor = vec4(waterColor, 1.0);
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
    uniforms.uCameraPos.value.copy(uCameraPos);
    if (newParams) {
      const newWaves = generateWaves(newParams);
      uniforms.uWaves.value = newWaves.flatMap(w => [w.angle, w.freq, w.amp, w.speed, w.phase]);
    }
  }

  // Guardar referencia a cámara para update
  let _cameraPos = new THREE.Vector3(30, 20, 30);
  uniforms.uCameraPos.value.copy(_cameraPos);

  function setCameraPos(pos) {
    _cameraPos.copy(pos);
  }

  return { mesh, update, setCameraPos };
}
