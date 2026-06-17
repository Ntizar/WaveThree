/**
 * WaveThree — Export del módulo ocean
 *
 * Re-exporta todos los submódulos de simulación oceánica.
 * Fase 3: incluye tanto el océano Gerstner como el espectral JONSWAP.
 */

export * from './gerstner.js';
export * from './spectrum.js';
export * from './spectral-ocean.js';
export * from './fft.js';
