/**
 * Cargadores de datos — NetCDF, escenarios JSON, modelos GLB
 *
 * Fase 2+ : parseo de NetCDF (netcdfjs), carga de escenarios autocontenidos.
 */

export async function loadScenario(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar escenario: ${url}`);
  return await response.json();
}

export async function loadBathymetryBin(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar batimetría: ${url}`);
  const buffer = await response.arrayBuffer();
  // TODO: interpretar buffer como heightmap (Float32Array)
  return buffer;
}

export async function loadNetCDF(url) {
  // netcdfjs: import { read } from 'netcdf';
  // TODO: implementar cuando haya datos reales
  console.warn('🌊 Loader NetCDF no implementado — Fase 2');
  return null;
}