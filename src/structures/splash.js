/**
 * WaveThree — Sistema de salpicadura (spray)
 *
 * Fase 4: partículas de spray que simulan el impacto explosivo
 * de las olas contra estructuras costeras.
 *
 * Diferencias con espuma:
 * - Partículas más pequeñas y más rápidas
 * - Color blanco semitransparente
 * - Efecto de explosión radial
 * - Vida más corta
 */

import * as THREE from 'three';

// ── Constantes ─────────────────────────────────────────────────────────

const MAX_SPRAY = 2000;
const SPRAY_LIFETIME = 1.5; // segundos (más corto que la espuma)
const SPRAY_SIZE = 0.15;

const STATE_DEAD = 0;
const STATE_ALIVE = 1;

/**
 * Crea un sistema de salpicadura para la escena.
 *
 * @param {THREE.Scene} scene — Escena Three.js
 * @returns {object} Sistema de spray con método update()
 */
export function createSpraySystem(scene) {
  // ── Geometría de partículas ──────────────────────────────────────

  const positions = new Float32Array(MAX_SPRAY * 3);
  const colors = new Float32Array(MAX_SPRAY * 4);
  const sizes = new Float32Array(MAX_SPRAY);
  const alphas = new Float32Array(MAX_SPRAY);
  const lifetimes = new Float32Array(MAX_SPRAY);
  const velocities = new Float32Array(MAX_SPRAY * 3);
  const states = new Uint8Array(MAX_SPRAY);

  for (let i = 0; i < MAX_SPRAY; i++) {
    states[i] = STATE_DEAD;
    lifetimes[i] = 0;
    sizes[i] = 0;
  }

  // ── Shader de spray ──────────────────────────────────────────────

  const sprayMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      attribute vec4 color;

      uniform float uPixelRatio;

      varying float vAlpha;
      varying vec4 vColor;

      void main() {
        vAlpha = alpha;
        vColor = color;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (150.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 0.5);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec4 vColor;

      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;

        // Punto compacto y brillante
        float core = 1.0 - smoothstep(0.0, 0.3, dist);
        float edge = 1.0 - smoothstep(0.2, 0.5, dist);

        // Más brillante en el centro
        float brightness = core * 0.5 + 0.5;

        gl_FragColor = vec4(vColor.rgb * brightness, vAlpha * edge);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const points = new THREE.Points(geometry, sprayMaterial);
  points.frustumCulled = false;

  scene.add(points);

  // ── Pool ─────────────────────────────────────────────────────────

  function findDeadParticle() {
    for (let i = 0; i < MAX_SPRAY; i++) {
      if (states[i] === STATE_DEAD) return i;
    }
    let oldest = 0;
    for (let i = 1; i < MAX_SPRAY; i++) {
      if (lifetimes[i] < lifetimes[oldest]) oldest = i;
    }
    return oldest;
  }

  /**
   * Emite una partícula de spray con velocidad explosiva.
   */
  function emit(x, y, z, intensity = 1.0) {
    const idx = findDeadParticle();

    positions[idx * 3] = x + (Math.random() - 0.5) * 0.3;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.3;

    // Velocidad explosiva: mayor componente vertical y radial
    const speed = 3.0 + intensity * 6.0;
    const angle = Math.random() * Math.PI * 2;
    const verticalBias = 0.5 + Math.random() * 0.5;

    velocities[idx * 3] = Math.cos(angle) * speed * (0.3 + Math.random() * 0.7);
    velocities[idx * 3 + 1] = speed * verticalBias; // muy hacia arriba
    velocities[idx * 3 + 2] = Math.sin(angle) * speed * (0.3 + Math.random() * 0.7);

    lifetimes[idx] = 0.5 + Math.random() * SPRAY_LIFETIME * intensity;

    // Color blanco azulado semitransparente
    const r = 0.85 + Math.random() * 0.15;
    const g = 0.9 + Math.random() * 0.1;
    const b = 0.95 + Math.random() * 0.05;
    colors[idx * 4] = r;
    colors[idx * 4 + 1] = g;
    colors[idx * 4 + 2] = b;
    colors[idx * 4 + 3] = 1.0;

    sizes[idx] = SPRAY_SIZE * (0.5 + Math.random() * 1.0);
    states[idx] = STATE_ALIVE;
  }

  // ── Actualización ────────────────────────────────────────────────

  /**
   * Actualiza el sistema de spray frame a frame.
   *
   * @param {number} dt — Delta time
   * @param {number} waveHeight — Altura de ola (controla emisión)
   * @param {object} [structurePos] — Posición de la estructura
   */
  function update(dt, waveHeight, structurePos = null) {
    if (dt > 0.1) dt = 0.1;

    let emitCount = 0;

    // Tasa de emisión proporcional a la ola
    if (waveHeight > 1.0) {
      emitCount = Math.floor(1 + waveHeight * 3);
    }

    for (let i = 0; i < emitCount; i++) {
      let ex, ey, ez;
      if (structurePos) {
        ex = structurePos.x + (Math.random() - 0.5) * 2;
        ey = Math.max(0.5, waveHeight * 0.5);
        ez = structurePos.z + (Math.random() - 0.5) * 1.5;
      } else {
        ex = (Math.random() - 0.5) * 40;
        ey = Math.max(0.5, waveHeight * 0.3);
        ez = (Math.random() - 0.5) * 40;
      }
      emit(ex, ey, ez, Math.min(waveHeight / 3.0, 1.0));
    }

    // Actualizar partículas
    for (let i = 0; i < MAX_SPRAY; i++) {
      if (states[i] !== STATE_ALIVE) continue;

      lifetimes[i] -= dt;

      if (lifetimes[i] <= 0) {
        states[i] = STATE_DEAD;
        sizes[i] = 0;
        alphas[i] = 0;
        continue;
      }

      // Mover
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

      // Fricción fuerte (spray se frena rápido)
      velocities[i * 3] *= 0.95;
      velocities[i * 3 + 1] *= 0.94;
      velocities[i * 3 + 2] *= 0.95;

      // Gravedad (más fuerte que espuma)
      velocities[i * 3 + 1] -= 2.0 * dt;

      // Fade
      const lifeRatio = lifetimes[i] / SPRAY_LIFETIME;
      alphas[i] = Math.pow(lifeRatio, 0.3) * 0.5;

      sizes[i] *= (1.0 + dt * 0.5);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;

    return { activeCount: states.reduce((a, s) => a + (s === STATE_ALIVE ? 1 : 0), 0) };
  }

  /**
   * Dispara una explosión de spray (impacto fuerte).
   */
  function burst(x, y, z, count = 100) {
    for (let i = 0; i < count; i++) {
      emit(x, y, z, 1.0);
    }
  }

  return {
    points,
    update,
    burst,
    get count() {
      let c = 0;
      for (let i = 0; i < MAX_SPRAY; i++) {
        if (states[i] === STATE_ALIVE) c++;
      }
      return c;
    },
  };
}
