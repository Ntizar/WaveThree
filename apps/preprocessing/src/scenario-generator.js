#!/usr/bin/env node
/**
 * scenario-generator.js — Genera escenarios JSON desde datos CSV de boya/SWAN.
 *
 * Formato CSV esperado:
 *   fecha,hs,tp,dir,wind_speed,wind_dir
 *
 * Uso standalone:
 *   node src/scenario-generator.js --input data.csv --output scenario.json --label "Nombre"
 *
 * Uso como módulo:
 *   import { generateScenarios } from './scenario-generator.js';
 *   const result = generateScenarios({ input, output, label, format });
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

// ── CSV Parser (sin dependencias externas) ────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('El CSV debe tener al menos una línea de cabecera y una de datos');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const required = ['fecha', 'hs', 'tp', 'dir'];
  for (const col of required) {
    if (!headers.includes(col)) {
      throw new Error(`Columna requerida no encontrada en CSV: "${col}". Columnas: ${headers.join(', ')}`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────

function safeFloat(value, field) {
  const n = parseFloat(value);
  if (isNaN(n)) {
    console.warn(`⚠️  Valor inválido para ${field}: "${value}" — usando 0`);
    return 0;
  }
  return n;
}

function dirToCardinal(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function generateId() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `temporal_${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

// ── Main logic (exportable) ──────────────────────────────────────────

/**
 * Genera escenarios JSON desde datos CSV.
 * @param {object} opts
 * @param {string} opts.input - Ruta al archivo CSV
 * @param {string} opts.output - Ruta al archivo JSON de salida
 * @param {string} opts.label - Etiqueta descriptiva
 * @param {string} [opts.format='single'] - 'single' o 'array'
 * @returns {object} { scenarios, count, last }
 */
export function generateScenarios(opts) {
  const { input, output, label = 'Escenario generado', format = 'single' } = opts;

  const inputFile = resolve(input);
  const outputFile = resolve(output);

  if (!existsSync(inputFile)) {
    throw new Error(`Error: archivo no encontrado: ${inputFile}`);
  }

  console.log(`📂 Leyendo CSV: ${inputFile}`);

  let csvText;
  try {
    csvText = readFileSync(inputFile, 'utf-8');
  } catch (err) {
    throw new Error(`Error al leer el archivo: ${err.message}`);
  }

  let rows;
  try {
    rows = parseCSV(csvText);
  } catch (err) {
    throw new Error(`Error al parsear CSV: ${err.message}`);
  }

  console.log(`📊 ${rows.length} filas de datos leídas`);

  // Generar escenarios
  const scenarios = [];

  for (const row of rows) {
    const fecha = row.fecha || '';
    const hs = safeFloat(row.hs || '0', 'hs');
    const tp = safeFloat(row.tp || '0', 'tp');
    const dir = safeFloat(row.dir || '0', 'dir');
    const windSpeed = safeFloat(row.wind_speed || '0', 'wind_speed');
    const windDir = safeFloat(row.wind_dir || '0', 'wind_dir');

    const dirCardinal = dirToCardinal(dir);
    const windCardinal = dirToCardinal(windDir);

    const scenario = {
      id: generateId(),
      label,
      location: 'zona piloto',
      time: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
      wave: {
        hs,
        tp,
        dir,
        notes: `Altura significativa ${hs}m, periodo pico ${tp}s, dirección ${dirCardinal} (${dir}°)`,
      },
      wind: {
        speed: windSpeed,
        dir: windDir,
        notes: `Viento de ${windSpeed} m/s desde ${windCardinal}`,
      },
      bathymetry: 'gebco_tile_01.bin',
      structure: 'dique_piloto.glb',
    };

    scenarios.push(scenario);
  }

  // Formatear salida
  let outputJSON;
  if (format === 'array') {
    outputJSON = scenarios;
  } else {
    outputJSON = scenarios.length > 0 ? scenarios[scenarios.length - 1] : {};
  }

  // Escribir archivo
  writeFileSync(outputFile, JSON.stringify(outputJSON, null, 2) + '\n', 'utf-8');

  console.log(`✅ Escenario escrito: ${outputFile}`);
  if (scenarios.length > 0) {
    const last = scenarios[scenarios.length - 1];
    console.log(`   Hs: ${last.wave.hs}m | Tp: ${last.wave.tp}s | Dir: ${last.wave.dir}°`);
    console.log(`   Viento: ${last.wind.speed} m/s desde ${last.wind.dir}°`);
  }
  console.log(`   Total filas procesadas: ${rows.length}`);

  return { scenarios, count: scenarios.length, last: scenarios.length > 0 ? scenarios[scenarios.length - 1] : null };
}

// ── Standalone entry point ───────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('scenario-generator.js')) {
  const args = parseArgs(process.argv);

  if (!args.input) { console.error('Error: --input es obligatorio'); process.exit(1); }
  if (!args.output) { console.error('Error: --output es obligatorio'); process.exit(1); }

  try {
    const opts = {
      input: args.input,
      output: args.output,
      label: args.label || 'Escenario generado',
      format: args.format || 'single',
    };
    generateScenarios(opts);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
