#!/usr/bin/env node
/**
 * gebco-extract.js — Extrae un tile GEBCO (NetCDF) y lo convierte a heightmap binario Float32.
 *
 * Formato de salida:
 *   [width: uint32LE][height: uint32LE][data: Float32LE × width × height]
 *
 * Uso standalone:
 *   node src/gebco-extract.js --input file.nc --output file.bin \
 *     --lat-min 43.2 --lat-max 43.7 --lon-min -6.0 --lon-max -5.2 --scale 1
 *
 * Uso como módulo:
 *   import { extractGebco } from './gebco-extract.js';
 *   await extractGebco({ input, output, latMin, latMax, lonMin, lonMax, scale });
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NetCDFReader } from 'netcdfjs';

// ── Argument parsing (minimal, no commander dependency here) ──────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseCoord(value, name) {
  const n = parseFloat(value);
  if (isNaN(n)) throw new Error(`--${name} debe ser un número, recibido: "${value}"`);
  return n;
}

function validateCoords(latMin, latMax, lonMin, lonMax) {
  if (latMin > latMax) throw new Error(`--lat-min (${latMin}) > --lat-max (${latMax})`);
  if (lonMin > lonMax) throw new Error(`--lon-min (${lonMin}) > --lon-max (${lonMax})`);
  if (latMin < -90 || latMax > 90) throw new Error(`Latitudes fuera de rango [-90, 90]`);
  if (lonMin < -180 || lonMax > 180) throw new Error(`Longitudes fuera de rango [-180, 180]`);
}

/**
 * Determina qué variable de batimetría usar en el NetCDF GEBCO.
 */
function findBathymetryVariable(reader) {
  const vars = reader.variables || [];
  const candidates = ['elevation', 'grid_values', 'bathymetry', 'z', 'depth'];
  for (const name of candidates) {
    const found = vars.find(v => v.name === name);
    if (found) return { variable: found, name };
  }
  // Fallback: cualquier variable numérica no-atributo
  for (const v of vars) {
    if (['float', 'double', 'int', 'short'].includes(v.type)) {
      return { variable: v, name: v.name };
    }
  }
  return null;
}

/**
 * Convierte índices de dimensión a coordenadas geográficas.
 */
function findLatLonDimensions(reader) {
  const dims = reader.dimensions || [];
  const dimMap = {};
  for (const d of dims) {
    dimMap[d.name] = d;
  }

  const latDim = dimMap['lat'] || dimMap['y'] || dimMap['latitude'];
  const lonDim = dimMap['lon'] || dimMap['x'] || dimMap['longitude'];

  return { latDim, lonDim, dimMap };
}

/**
 * Obtiene los valores reales de coordenadas de una dimensión.
 */
function getCoordinateValues(reader, dimName, dimSize) {
  const varData = reader.getDataVariable(dimName);
  if (varData && varData.length >= dimSize) {
    return varData;
  }
  return null;
}

// ── Main logic (exportable) ──────────────────────────────────────────

/**
 * Extrae un tile GEBCO y lo convierte a heightmap binario.
 * @param {object} opts
 * @param {string} opts.input - Ruta al archivo NetCDF
 * @param {string} opts.output - Ruta al archivo binario de salida
 * @param {number} opts.latMin - Latitud mínima
 * @param {number} opts.latMax - Latitud máxima
 * @param {number} opts.lonMin - Longitud mínima
 * @param {number} opts.lonMax - Longitud máxima
 * @param {number} [opts.scale=1] - Factor de escala
 * @returns {object} { width, height, minDepth, maxDepth, bytes }
 */
export function extractGebco(opts) {
  const {
    input, output, latMin, latMax, lonMin, lonMax, scale = 1
  } = opts;

  const inputFile = resolve(input);
  const outputFile = resolve(output);

  validateCoords(latMin, latMax, lonMin, lonMax);

  if (!existsSync(inputFile)) {
    throw new Error(`Error: archivo no encontrado: ${inputFile}`);
  }

  console.log(`📂 Leyendo NetCDF: ${inputFile}`);
  console.log(`🌍 Región: [${latMin}, ${latMax}] × [${lonMin}, ${lonMax}]`);

  // Leer y parsear NetCDF
  let data;
  try {
    data = readFileSync(inputFile);
  } catch (err) {
    throw new Error(`Error al leer el archivo: ${err.message}`);
  }

  let reader;
  try {
    reader = new NetCDFReader(data);
  } catch (err) {
    throw new Error(`Error al parsear NetCDF: ${err.message}`);
  }

  console.log(`📊 Versión NetCDF: ${reader.version}`);
  console.log(`📐 Dimensiones:`, JSON.stringify(reader.dimensions.map(d => `${d.name}=${d.size}`)));
  console.log(`📦 Variables:`, reader.variables.map(v => `${v.name} (${v.type})`));

  // Encontrar la variable de batimetría
  const bathy = findBathymetryVariable(reader);
  if (!bathy) {
    throw new Error('Error: no se encontró ninguna variable de batimetría en el archivo NetCDF');
  }
  console.log(`🔍 Variable de batimetría: ${bathy.name}`);

  // Leer datos de batimetría
  let bathyData;
  try {
    bathyData = reader.getDataVariable(bathy.variable);
  } catch (err) {
    throw new Error(`Error al leer variable "${bathy.name}": ${err.message}`);
  }

  // Encontrar dimensiones lat/lon
  const { latDim, lonDim } = findLatLonDimensions(reader);
  if (!latDim || !lonDim) {
    throw new Error('Error: no se encontraron dimensiones lat/lon en el archivo');
  }
  console.log(`📐 Dim lat: ${latDim.name} (${latDim.size}), dim lon: ${lonDim.name} (${lonDim.size})`);

  // Obtener valores de coordenadas
  let latValues = getCoordinateValues(reader, latDim.name, latDim.size);
  let lonValues = getCoordinateValues(reader, lonDim.name, lonDim.size);

  // Si no hay coordenadas explícitas, generar valores lineales
  if (!latValues) {
    console.log('⚠️ Sin coordenadas explícitas, generando valores lineales para lat');
    latValues = Array.from({ length: latDim.size }, (_, i) =>
      latDim.name === 'y' ? -90 + (180 / latDim.size) * i : latMin - 0.001 + ((latMax - latMin + 0.002) / latDim.size) * i
    );
  }
  if (!lonValues) {
    console.log('⚠️ Sin coordenadas explícitas, generando valores lineales para lon');
    lonValues = Array.from({ length: lonDim.size }, (_, i) =>
      lonDim.name === 'x' ? -180 + (360 / lonDim.size) * i : lonMin - 0.001 + ((lonMax - lonMin + 0.002) / lonDim.size) * i
    );
  }

  // Mapear datos 1D a 2D
  const bathyLength = bathyData.length;

  let dimSizes;
  if (bathy.variable.dimensions.length === 2) {
    const dimA = reader.dimensions[bathy.variable.dimensions[0]];
    const dimB = reader.dimensions[bathy.variable.dimensions[1]];
    dimSizes = [dimA.size, dimB.size];
  } else if (bathy.variable.dimensions.length === 1 && bathy.variable.record) {
    const recordDim = reader.recordDimension;
    const spatialDim = reader.dimensions[bathy.variable.dimensions[1]];
    dimSizes = [recordDim.length, spatialDim.size];
  } else {
    dimSizes = [Math.round(Math.sqrt(bathyLength)), Math.round(Math.sqrt(bathyLength))];
  }

  console.log(`📐 Dimensiones de datos: [${dimSizes.join(' × ')}]`);

  const rows = dimSizes[0];
  const cols = dimSizes[1];
  const grid2D = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      row.push(bathyData[idx] !== undefined ? bathyData[idx] : 0);
    }
    grid2D.push(row);
  }

  // Encontrar índice más cercano a un valor de coordenada
  function coordIndex(values, target) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < values.length; i++) {
      const d = Math.abs(values[i] - target);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  const latStartIdx = coordIndex(latValues, latMin);
  const latEndIdx = coordIndex(latValues, latMax);
  const lonStartIdx = coordIndex(lonValues, lonMin);
  const lonEndIdx = coordIndex(lonValues, lonMax);

  console.log(`🎯 Índices: lat [${latStartIdx}..${latEndIdx}], lon [${lonStartIdx}..${lonEndIdx}]`);

  // Extraer sub-región
  const extracted = [];
  for (let r = latStartIdx; r <= latEndIdx; r++) {
    const row = [];
    for (let c = lonStartIdx; c <= lonEndIdx; c++) {
      let depth = grid2D[r] ? grid2D[r][c] : 0;
      depth = depth * scale;
      row.push(depth);
    }
    extracted.push(row);
  }

  const width = extracted[0].length;
  const height = extracted.length;
  console.log(`✂️  Tile extraído: ${width} × ${height} celdas`);

  // Convertir a array plano Float32
  const flat = new Float32Array(width * height);
  let idx = 0;
  for (const row of extracted) {
    for (const val of row) {
      flat[idx++] = val;
    }
  }

  // Construir binario: [width: uint32][height: uint32][data: Float32 × width × height]
  const headerSize = 4 + 4;
  const dataBytes = flat.byteLength;
  const totalBytes = headerSize + dataBytes;
  const outputBuffer = Buffer.alloc(totalBytes);
  outputBuffer.writeUInt32LE(width, 0);
  outputBuffer.writeUInt32LE(height, 4);
  flat.forEach((v, i) => outputBuffer.writeFloatLE(v, headerSize + i * 4));

  // Escribir archivo
  writeFileSync(outputFile, outputBuffer);

  console.log(`✅ Heightmap escrito: ${outputFile} (${(totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`   Profundidad mínima: ${Math.min(...flat).toFixed(1)} m`);
  console.log(`   Profundidad máxima: ${Math.max(...flat).toFixed(1)} m`);

  return { width, height, minDepth: Math.min(...flat), maxDepth: Math.max(...flat), bytes: totalBytes };
}

// ── Standalone entry point ───────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('gebco-extract.js')) {
  const args = parseArgs(process.argv);

  if (!args.input) { console.error('Error: --input es obligatorio'); process.exit(1); }
  if (!args.output) { console.error('Error: --output es obligatorio'); process.exit(1); }
  if (!args['lat-min'] || !args['lat-max'] || !args['lon-min'] || !args['lon-max']) {
    console.error('Error: --lat-min, --lat-max, --lon-min, --lon-max son obligatorios');
    process.exit(1);
  }

  try {
    const opts = {
      input: args.input,
      output: args.output,
      latMin: parseFloat(args['lat-min']),
      latMax: parseFloat(args['lat-max']),
      lonMin: parseFloat(args['lon-min']),
      lonMax: parseFloat(args['lon-max']),
      scale: args.scale ? parseFloat(args.scale) : 1,
    };
    extractGebco(opts);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
