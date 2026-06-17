/**
 * Espectro JONSWAP + generación de campo de alturas
 *
 * Implementación del espectro JONSWAP (Joint North Sea Wave Project)
 * con distribución direccional cos² y generación de campo de alturas
 * mediante FFT 2D en CPU.
 *
 * Referencias:
 *   - Komen et al. (1994), "Dynamics and Modelling of Ocean Waves"
 *   - Hasselmann et al. (1973), "Measurements of wind-wave growth..."
 *   - Spiri0/Threejs-WebGPU-IFFT-Ocean (GitHub)
 *
 * El espectro JONSWAP es una versión modificada del espectro
 * Pierson-Moskowitz, con un factor de amplificación pico gamma.
 *
 * S(f, θ) = S_f(f) · D(θ - θ_mean, spread)
 */

import { fft2d, fftShift } from './fft.js';

// ── Constantes físicas ────────────────────────────────────────────────

const G = 9.81; // gravedad (m/s²)
const PI = Math.PI;

// ── JONSWAP Spectrum ─────────────────────────────────────────────────

/**
 * Calcula el espectro JONSWAP para una frecuencia dada.
 *
 * S(f) = α · Hs² · fp⁴ · f⁻⁵ · exp(-1.25·(f/fp)⁻⁴) · γ^exp(-(f-fp)² / (2·σ²·fp²))
 *
 * @param {number} f - Frecuencia (Hz)
 * @param {number} Hs - Altura significativa de ola (m)
 * @param {number} Tp - Periodo pico (s)
 * @param {number} gamma - Factor de amplificación pico (default 3.3)
 * @returns {number} Densidad espectral S(f) (m²·s)
 */
export function jonswapSpectrum(f, Hs, Tp, gamma = 3.3) {
  if (f <= 0) return 0;

  const fp = 1 / Tp; // frecuencia pico
  const sigma = f <= fp ? 0.07 : 0.09;

  // Coeficiente de Alpha (Phillips constant ajustado)
  // alpha = 5.061 * Hs² * fp⁴ / (1 - 0.287 * ln(gamma))
  // Nota: la fórmula original de JONSWAP usa alpha = 0.076 * (U² / fp)
  // pero adaptamos a Hs y Tp directamente
  const alpha = 0.076 * Math.pow(G * Tp / (2 * PI), -2);

  // Parte de Pierson-Moskowitz
  const pm = alpha * Hs * Hs * Math.pow(fp, 4) * Math.pow(f, -5) *
    Math.exp(-1.25 * Math.pow(f / fp, -4));

  // Factor de amplificación pico (gamma)
  const gammaFactor = Math.exp(
    -Math.pow(f - fp, 2) / (2 * sigma * sigma * fp * fp)
  );
  const gammaTerm = Math.pow(gamma, gammaFactor);

  return pm * gammaTerm;
}

// ── Distribución direccional cos² ──────────────────────────────────────

/**
 * Distribución direccional cos²(θ - θ_mean).
 *
 * Normalizada para que ∫D(θ)dθ = 1 sobre [-π, π].
 *
 * @param {number} freq - Frecuencia (Hz)
 * @param {number} meanDir - Dirección media (rad)
 * @param {number} spread - Parámetro de dispersión (rad)
 * @returns {number} Densidad direccional
 */
export function angularSpread(freq, meanDir, spread) {
  // Para olas de mar, el spread aumenta con la frecuencia
  // Relación: spread ∝ f (más disperso en altas frecuencias)
  const effectiveSpread = Math.max(spread, 0.15 * freq);

  // cos² distribuido
  const thetaDiff = Math.cos(2 * (0 - meanDir)); // θ = 0 (dirección de referencia)
  // Simplificación: cos²(θ - meanDir) con θ = dirección de la onda
  const cos2 = Math.pow(Math.cos(0 - meanDir), 2);

  // Normalización: 1/(π·(1 + cos(2·spread))) para cos²
  const norm = 1 / (PI * (1 + Math.cos(2 * effectiveSpread)));

  return norm * Math.pow(Math.cos(0 - meanDir), 2) * Math.exp(-Math.pow(0 - meanDir, 2) / (2 * effectiveSpread * effectiveSpread));
}

// ── Generación de campo de alturas ────────────────────────────────────

/**
 * Genera un campo de alturas de superficie oceánica usando el espectro
 * JONSWAP y FFT 2D.
 *
 * Algoritmo:
 * 1. Crear malla de frecuencias 2D (kx, ky)
 * 2. Calcular S(k) = S(f) · D(θ) para cada punto de la malla
 * 3. Generar números aleatorios gaussianos para fase aleatoria
 * 4. Construir campo complejo: A·exp(i·φ) donde A = √(2·S·Δk)
 * 5. Aplicar fftShift al espectro
 * 6. FFT inversa 2D → campo de alturas en espacio real
 *
 * @param {object} params - Parámetros del océano
 * @param {number} params.Hs - Altura significativa (m)
 * @param {number} params.Tp - Periodo pico (s)
 * @param {number} params.dir - Dirección media (grados)
 * @param {number} params.N - Resolución de la malla (64 o 128)
 * @param {number} params.L - Tamaño del dominio (m)
 * @param {number} [params.gamma=3.3] - Factor de amplificación pico
 * @param {number} [params.spread=0.5] - Dispersión direccional (rad)
 * @param {Float32Array} [params.seed] - Semilla determinista para reproducibilidad
 * @returns {Float32Array} Campo de alturas (N×N)
 */
export function generateHeightField(params, seed = null) {
  const { Hs, Tp, dir, N, L, gamma = 3.3, spread = 0.5 } = params;
  const meanDirRad = dir * PI / 180;

  // Número de puntos en el dominio
  const totalPoints = N * N;

  // Espacio complejo: [r0, i0, r1, i1, ...]
  const complexData = new Float32Array(totalPoints * 2);

  // Malla de frecuencias espaciales
  const dk = 2 * PI / L; // espaciado en k
  const maxK = (N / 2) * dk; // frecuencia espacial máxima

  // Generador de números aleatorios gaussianos (Box-Muller)
  let rngState = seed || Date.now();
  function gaussRng() {
    // LCG simple para reproducibilidad
    rngState = (rngState * 1664525 + 1013904223) & 0xFFFFFFFF;
    const u1 = ((rngState >>> 0) / 0xFFFFFFFF) * 0.9999 + 0.0001;
    rngState = (rngState * 1664525 + 1013904223) & 0xFFFFFFFF;
    const u2 = ((rngState >>> 0) / 0xFFFFFFFF);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * PI * u2);
  }

  // Generar campo de alturas
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const idx = (i * N + j) * 2;

      // Coordenadas en espacio de Fourier (centrado)
      let kx = i * dk;
      let ky = j * dk;

      // Ajustar para fftShift: frecuencias negativas
      if (i >= N / 2) kx -= N * dk;
      if (j >= N / 2) ky -= N * dk;

      const k = Math.sqrt(kx * kx + ky * ky);

      // Relación de dispersión: ω² = g·k (agua profunda)
      const omega = Math.sqrt(G * k);

      if (k < 1e-10) {
        // DC component: cero para superficie de agua
        complexData[idx] = 0;
        complexData[idx + 1] = 0;
        continue;
      }

      // Frecuencia temporal
      const f = omega / (2 * PI);

      // Espectro JONSWAP
      const S_f = jonswapSpectrum(f, Hs, Tp, gamma);

      // Distribución direccional
      const theta = Math.atan2(ky, kx);
      const D = angularSpread(f, meanDirRad, spread);

      // Espectro 2D completo
      const S_k = S_f * D;

      // Amplitud: A = √(2 · S(k) · Δk²)
      // El factor 2 viene de la simetría conjugada
      const amplitude = Math.sqrt(2 * S_k * dk * dk);

      // Fase aleatoria uniforme [0, 2π]
      const phase = gaussRng() * PI;

      // Componente compleja
      complexData[idx] = amplitude * Math.cos(phase);
      complexData[idx + 1] = amplitude * Math.sin(phase);
    }
  }

  // Aplicar fftShift al espectro (DC al centro)
  fftShift(complexData, N);

  // FFT inversa → campo de alturas en espacio real
  fft2d(complexData, N, true); // inverse = true

  // El resultado está en parte real; la imaginaria debería ser ~0
  const heights = new Float32Array(totalPoints);
  for (let i = 0; i < totalPoints; i++) {
    heights[i] = complexData[i * 2]; // solo parte real
  }

  // Normalizar para que Hs coincida (Hs = 4·σ de las alturas)
  let sum = 0;
  for (let i = 0; i < totalPoints; i++) {
    sum += heights[i];
  }
  const mean = sum / totalPoints;

  let variance = 0;
  for (let i = 0; i < totalPoints; i++) {
    const diff = heights[i] - mean;
    variance += diff * diff;
  }
  variance /= totalPoints;
  const sigmaH = Math.sqrt(variance);

  // Factor de escala: Hs = 4σ, así que scale = Hs / (4σ)
  const scale = sigmaH > 0 ? Hs / (4 * sigmaH) : 1;
  for (let i = 0; i < totalPoints; i++) {
    heights[i] *= scale;
  }

  return heights;
}

// ── Precomputación de frames ──────────────────────────────────────────

/**
 * Precomputa un array de campos de alturas para animación.
 *
 * @param {object} params - Parámetros del océano (mismo que generateHeightField)
 * @param {number} frameCount - Número de frames a precomputar
 * @param {number} dt - Intervalo temporal entre frames (s)
 * @returns {Float32Array[]} Array de campos de alturas
 */
export function precomputeFrames(params, frameCount, dt) {
  const frames = [];
  const { N } = params;

  for (let i = 0; i < frameCount; i++) {
    // Variar ligeramente los parámetros para animación
    const timeOffset = i * dt;
    const paramsShifted = { ...params };
    // Pequeña variación de fase en el seed
    paramsShifted.seed = Date.now() + i * 1000;
    frames.push(generateHeightField(paramsShifted));
  }

  return frames;
}
