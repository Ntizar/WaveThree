/**
 * Cargadores de datos — Escenarios JSON, batimetría, NetCDF
 *
 * Funciones para cargar y normalizar escenarios de oleaje,
 * convertir parámetros físicos a wave params del shader,
 * y cargar datos de batimetría.
 */

// ── Schema de validación ─────────────────────────────────────────────

const REQUIRED_FIELDS = {
  id: 'string',
  label: 'string',
  location: 'string',
  time: 'string',
  wave: { hs: 'number', tp: 'number', dir: 'number' },
  wind: { speed: 'number', dir: 'number' },
};

/**
 * Valida un escenario contra el schema esperado.
 * @param {object} data - Objeto JSON del escenario
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateScenario(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['El escenario debe ser un objeto JSON'] };
  }

  // Campos escalares requeridos
  for (const [field, type] of Object.entries(REQUIRED_FIELDS)) {
    if (typeof type === 'string') {
      if (!(field in data) || typeof data[field] !== type) {
        errors.push(`Campo requerido: ${field} (${type})`);
      }
    } else {
      // Objeto anidado (wave, wind)
      if (!data[field] || typeof data[field] !== 'object') {
        errors.push(`Campo requerido: ${field} (objeto)`);
      } else {
        for (const [subField, subType] of Object.entries(type)) {
          if (!(subField in data[field]) || typeof data[field][subField] !== subType) {
            errors.push(`Campo requerido: ${field}.${subField} (${subType})`);
          }
        }
      }
    }
  }

  // Validaciones de rango
  if (data.wave) {
    if (data.wave.hs < 0 || data.wave.hs > 25) errors.push('Hs debe estar entre 0 y 25 m');
    if (data.wave.tp < 0 || data.wave.tp > 30) errors.push('Tp debe estar entre 0 y 30 s');
    if (data.wave.dir < 0 || data.wave.dir > 360) errors.push('Dir debe estar entre 0 y 360°');
  }
  if (data.wind) {
    if (data.wind.speed < 0 || data.wind.speed > 60) errors.push('Velocidad viento debe estar entre 0 y 60 m/s');
  }

  return { valid: errors.length === 0, errors };
}

// ── loadScenario ─────────────────────────────────────────────────────

/**
 * Carga un escenario JSON desde una URL, lo valida y devuelve
 * el objeto normalizado.
 *
 * @param {string} url - URL del archivo JSON del escenario
 * @returns {Promise<object>} Objeto escenario normalizado
 * @throws {Error} Si el archivo no existe o el JSON es inválido
 */
export async function loadScenario(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`No se pudo conectar con ${url}: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`No se pudo cargar escenario "${url}" (HTTP ${response.status})`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`JSON inválido en ${url}: ${err.message}`);
  }

  const validation = validateScenario(data);
  if (!validation.valid) {
    throw new Error(
      `Escenario inválido en ${url}: ${validation.errors.join(', ')}`
    );
  }

  return normalizeScenario(data);
}

// ── loadScenariosList ────────────────────────────────────────────────

/**
 * Escanea el directorio data/scenarios/*.json y devuelve una lista
 * de metadatos de escenarios disponibles.
 *
 * Como no podemos hacer readdir del filesystem desde el navegador,
 * esta función devuelve la lista hardcodeada basada en los IDs
 * conocidos, y carga los metadatos de cada uno.
 *
 * @param {string} [basePath='../../data/scenarios'] - Ruta base relativa
 * @returns {Promise<Array<{id: string, label: string, location: string, time: string}>>}
 */
export async function loadScenariosList(basePath = '../../data/scenarios') {
  const knownScenarios = [
    'temporal_2026_01_17_1200',
    'swell_atlantic',
    'calm_day',
    'storm_extreme',
  ];

  const results = [];
  for (const id of knownScenarios) {
    try {
      const url = `${basePath}/${id}.json`;
      const sc = await loadScenario(url);
      results.push({
        id: sc.id,
        label: sc.label,
        location: sc.location,
        time: sc.time,
      });
    } catch (err) {
      // Si falla la carga de un escenario, lo omitimos silenciosamente
      // (puede ser un escenario eliminado o ruta cambiada)
      console.warn(`⚠️ Escenario omitido: ${id} — ${err.message}`);
    }
  }

  return results;
}

// ── scenarioToWaveParams ─────────────────────────────────────────────

/**
 * Convierte un escenario normalizado a parámetros del shader Gerstner.
 *
 * Mapeo:
 *   Hs (altura significativa) → amplitud (directo, Hs es la amplitud efectiva)
 *   Tp (periodo pico) → frecuencia (1/Tp)
 *   Dir (dirección) → dirección en radianes para el shader
 *   wind.speed → windSpeed (para futuras extensiones)
 *
 * @param {object} scenario - Escenario normalizado
 * @returns {object} Parámetros para createGerstnerOcean
 */
export function scenarioToWaveParams(scenario) {
  const { wave, wind } = scenario;

  return {
    amplitude: wave.hs,              // Hs → amplitud directa
    frequency: 1 / wave.tp,          // Tp → frecuencia angular (Hz)
    direction: wave.dir,             // Dirección en grados
    windSpeed: wind.speed,           // Velocidad viento
    windDir: wind.dir,               // Dirección viento
  };
}

// ── normalizeScenario ────────────────────────────────────────────────

/**
 * Normaliza un escenario crudo a formato consistente.
 * Añade valores por defecto si faltan campos opcionales.
 *
 * @param {object} raw - Objeto JSON crudo del escenario
 * @returns {object} Escenario normalizado
 */
function normalizeScenario(raw) {
  return {
    id: raw.id,
    label: raw.label || raw.id,
    location: raw.location || 'Desconocida',
    time: raw.time || new Date().toISOString(),
    wave: {
      hs: raw.wave.hs,
      tp: raw.wave.tp,
      dir: raw.wave.dir,
      notes: raw.wave.notes || '',
    },
    wind: {
      speed: raw.wind.speed,
      dir: raw.wind.dir,
      notes: raw.wind.notes || '',
    },
    bathymetry: raw.bathymetry || null,
    structure: raw.structure || null,
  };
}

// ── loadBathymetryBin ────────────────────────────────────────────────

/**
 * Carga un archivo binario de batimetría.
 *
 * @param {string} url - URL del archivo .bin
 * @returns {Promise<ArrayBuffer>} Buffer crudo
 */
export async function loadBathymetryBin(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar batimetría: ${url}`);
  const buffer = await response.arrayBuffer();
  return buffer;
}

// ── loadNetCDF ───────────────────────────────────────────────────────

/**
 * Loader NetCDF — placeholder para Fase 2+
 *
 * @param {string} url - URL del archivo NetCDF
 * @returns {Promise<null>}
 */
export async function loadNetCDF(url) {
  console.warn('🌊 Loader NetCDF no implementado — Fase 2');
  return null;
}
