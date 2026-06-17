#!/usr/bin/env node
/**
 * index.js — CLI principal del preprocesador WaveThree.
 *
 * Comandos:
 *   npm run gebco   — Extraer tile GEBCO a heightmap binario
 *   npm run scenario — Generar escenario JSON desde CSV de boya/SWAN
 *
 * Uso:
 *   npm run gebco -- --input file.nc --output file.bin --lat-min 43.2 --lat-max 43.7 --lon-min -6.0 --lon-max -5.2
 *   npm run scenario -- --input data.csv --output scenario.json --label "Nombre"
 */

import { Command } from 'commander';
import { extractGebco } from './gebco-extract.js';
import { generateScenarios } from './scenario-generator.js';

const program = new Command();

program
  .name('wave3-preprocess')
  .description('Preprocesador de datos para WaveThree — GEBCO bathymetry y escenarios de oleaje')
  .version('0.1.0');

// ── Comando: gebco ────────────────────────────────────────────────────

program
  .command('gebco')
  .description('Extraer un tile GEBCO (NetCDF) y convertirlo a heightmap binario Float32')
  .requiredOption('--input <file>', 'Archivo NetCDF de entrada (tile GEBCO)')
  .requiredOption('--output <file>', 'Archivo binario de salida (heightmap)')
  .requiredOption('--lat-min <number>', 'Latitud mínima de la región')
  .requiredOption('--lat-max <number>', 'Latitud máxima de la región')
  .requiredOption('--lon-min <number>', 'Longitud mínima de la región')
  .requiredOption('--lon-max <number>', 'Longitud máxima de la región')
  .option('--scale <number>', 'Factor de escala para profundidades', '1')
  .action((options) => {
    try {
      extractGebco({
        input: options.input,
        output: options.output,
        latMin: parseFloat(options.latMin),
        latMax: parseFloat(options.latMax),
        lonMin: parseFloat(options.lonMin),
        lonMax: parseFloat(options.lonMax),
        scale: parseFloat(options.scale),
      });
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// ── Comando: scenario ─────────────────────────────────────────────────

program
  .command('scenario')
  .description('Generar escenario JSON desde datos CSV de boya/SWAN')
  .requiredOption('--input <file>', 'Archivo CSV de entrada')
  .requiredOption('--output <file>', 'Archivo JSON de salida')
  .requiredOption('--label <text>', 'Etiqueta descriptiva del escenario')
  .option('--format <type>', 'Formato de salida: single o array', 'single')
  .action((options) => {
    try {
      generateScenarios({
        input: options.input,
        output: options.output,
        label: options.label,
        format: options.format,
      });
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// ── Ejecutar ──────────────────────────────────────────────────────────

program.parse(process.argv);
