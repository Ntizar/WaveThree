/**
 * WaveThree — Sistema de espuma dinámica
 *
 * Fase 4: partículas de espuma que se generan donde la ola
 * impacta contra estructuras costeras.
 *
 * Usa THREE.Points con un buffer de partículas recicladas (pool).
 */

import * as THREE from 'three';

// ── Constantes del sistema ─────────────────────────────────────────────

const MAX_PARTICLES = 4000;
const PARTICLE_LIFETIME = 3.0; // segundos
const PARTICLE_SIZE = 0.4;

// Estado de cada partícula
const STATE_DEAD = 0;
const STATE_ALIVE = 1;

/**
 * Crea un sistema de espuma para la escena.
 *
 * @param {THREE.Scene} scene — Escena Three.js
 * @returns {object} Sistema de espuma con método update()
 */
export function createFoamSystem(scene) {
  // ── Geometría de partículas ──────────────────────────────────────

  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 4); // RGBA
  const sizes = new Float32Array(MAX_PARTICLES);
  const alphas = new Float32Array(MAX_PARTICLES);

  // Inicializar todas las partículas como muertas
  const lifetimes = new Float32Array(MAX_PARTICLES); // tiempo restante
  const velocities = new Float32Array(MAX_PARTICLES * 3); // vx, vy, vz
  const states = new Uint8Array(MAX_PARTICLES);

  for (let i = 0; i < MAX_PARTICLES; i++) {
    states[i] = STATE_DEAD;
    lifetimes[i] = 0;
    sizes[i] = 0;
  }

  // ── Shader personalizado para espuma ─────────────────────────────

  const foamMaterial = new THREE.ShaderMaterial({
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
        gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec4 vColor;

      void main() {
        // Forma circular suave
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;

        // Borde suave
        float edge = 1.0 - smoothstep(0.2, 0.5, dist);

        // Variación de brillo
        float brightness = 0.85 + 0.15 * (1.0 - dist * 2.0);

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

  const points = new THREE.Points(geometry, foamMaterial);
  points.frustumCulled = false;

  scene.add(points);

  // ── Pool de partículas ───────────────────────────────────────────

  let nextIndex = 0;

  /**
   * Busca una partícula muerta en el pool para reutilizar.
   */
  function findDeadParticle() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (states[i] === STATE_DEAD) {
        return i;
      }
    }
    // Si no hay muertas, reciclar la más vieja
    let oldest = 0;
    for (let i = 1; i < MAX_PARTICLES; i++) {
      if (lifetimes[i] < lifetimes[oldest]) {
        oldest = i;
      }
    }
    return oldest;
  }

  /**
   * Emite una partícula de espuma.
   *
   * @param {number} x — Posición X
   * @param {number} y — Posición Y
   * @param {number} z — Posición Z
   * @param {number} intensity — Intensidad del impacto (0-1)
   */
  function emit(x, y, z, intensity = 0.5) {
    const idx = findDeadParticle();

    // Posición inicial con algo de dispersión
    positions[idx * 3] = x + (Math.random() - 0.5) * 0.5;
    positions[idx * 3 + 1] = y + Math.random() * 0.3;
    positions[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.5;

    // Velocidad: hacia arriba y hacia los lados
    const spread = 1.5 + intensity * 2.0;
    velocities[idx * 3] = (Math.random() - 0.5) * spread;
    velocities[idx * 3 + 1] = 0.5 + Math.random() * 1.5 * intensity; // hacia arriba
    velocities[idx * 3 + 2] = (Math.random() - 0.5) * spread;

    // Vida útil
    lifetimes[idx] = 1.0 + Math.random() * 2.0 * intensity;

    // Color: blanco con variación
    const brightness = 0.9 + Math.random() * 0.1;
    colors[idx * 4] = brightness;
    colors[idx * 4 + 1] = brightness;
    colors[idx * 4 + 2] = brightness;
    colors[idx * 4 + 3] = 1.0; // alpha inicial

    // Tamaño variable
    sizes[idx] = PARTICLE_SIZE * (0.5 + Math.random() * 1.5) * (0.5 + intensity);

    states[idx] = STATE_ALIVE;
  }

  // ── Función pública de actualización ──────────────────────────────

  /**
   * Actualiza el sistema de espuma frame a frame.
   *
   * @param {number} dt — Delta time en segundos
   * @param {number} waveHeight — Altura de ola cercana al emisor (m)
   * @param {object} [structurePos] — Posición de la estructura
   * @param {number} [structurePos.x=0]
   * @param {number} [structurePos.z=0]
   */
  function update(dt, waveHeight, structurePos = null) {
    if (dt > 0.1) dt = 0.1; // Clamp delta

    let emitCount = 0;

    // Tasa de emisión basada en altura de ola
    if (waveHeight > 0.5) {
      emitCount = Math.floor(2 + waveHeight * 8);
    }

    // Emitir nuevas partículas
    for (let i = 0; i < emitCount; i++) {
      let ex, ey, ez;
      if (structurePos) {
        // Emitir en la posición de la estructura
        ex = structurePos.x + (Math.random() - 0.5) * 3;
        ey = Math.max(0, waveHeight * 0.3);
        ez = structurePos.z + (Math.random() - 0.5) * 2;
      } else {
        // Emisión ambiental (olas rompiendo en general)
        ex = (Math.random() - 0.5) * 60;
        ey = Math.max(0, waveHeight * 0.2);
        ez = (Math.random() - 0.5) * 60;
      }
      emit(ex, ey, ez, Math.min(waveHeight / 4.0, 1.0));
    }

    // Actualizar partículas existentes
    let activeCount = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (states[i] !== STATE_ALIVE) continue;

      lifetimes[i] -= dt;

      if (lifetimes[i] <= 0) {
        states[i] = STATE_DEAD;
        sizes[i] = 0;
        alphas[i] = 0;
        continue;
      }

      activeCount++;

      // Mover partícula
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

      // Fricción del aire
      velocities[i * 3] *= 0.98;
      velocities[i * 3 + 1] *= 0.97;
      velocities[i * 3 + 2] *= 0.98;

      // Gravedad reducida (la espuma es ligera)
      velocities[i * 3 + 1] -= 0.1 * dt;

      // Fade out
      const lifeRatio = lifetimes[i] / (1.0 + 2.0 * Math.min(waveHeight / 4.0, 1.0));
      alphas[i] = Math.pow(lifeRatio, 0.5) * 0.7;

      // Tamaño crece ligeramente con el tiempo (dispersión)
      sizes[i] *= (1.0 + dt * 0.3);
    }

    // Marcar atributos como needing update
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;

    return { activeCount, emitCount };
  }

  /**
   * Dispara un burst de espuma (impacto fuerte).
   */
  function burst(x, y, z, count = 50) {
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
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (states[i] === STATE_ALIVE) c++;
      }
      return c;
    },
  };
}
