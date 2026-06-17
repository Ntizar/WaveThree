#!/usr/bin/env node
/**
 * demo-bathy.js — Genera un heightmap sintético de plataforma continental.
 *
 * Crea un grid de 100×100 con forma de plataforma continental:
 *   - Zona costera poco profunda (0 a -10m)
 *   - Talud continental (-10 a -200m)
 *   - Fondo oceánico profundo (-200 a -300m)
 *
 * Guarda el resultado como data/processed/demo-bathymetry.bin
 * en el formato: [width: uint32][height: uint32][data: Float32LE × width × height]
 *
 * Uso:
 *   cd apps/preprocessing && node src/demo-bathy.js
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const OUTPUT = resolve(ROOT, 'data/processed/demo-bathymetry.bin');

// ── Parámetros ────────────────────────────────────────────────────────

const SIZE = 100; // 100×100 grid
const COAST_LINE = 0.35; // Fracción desde la izquierda donde está la costa
const TALUD_START = 0.45; // Donde empieza el talud continental
const TALUD_END = 0.75; // Donde termina el talud
const SHALLOW_DEPTH = -8; // Profundidad en zona costera
const DEEP_DEPTH = -280; // Profundidad en fondo oceánico

// ── Generar heightmap sintético ──────────────────────────────────────

function generateContinentShelf(width, height) {
  const data = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Normalizar coordenadas [0, 1]
      const nx = x / (width - 1);
      const ny = y / (height - 1);

      // La costa va de izquierda (x=0) a derecha (x=1)
      // Zona costera: x < COAST_LINE → profundidad suave
      // Talud: COAST_LINE ≤ x < TALUD_END → descenso pronunciado
      // Fondo: x ≥ TALUD_END → profundidad máxima

      let depth;
      if (nx < COAST_LINE) {
        // Zona costera poco profunda con variación suave
        const t = nx / COAST_LINE;
        // Profundidad mínima en la orilla, ligeramente más profundo en el borde
        depth = SHALLOW_DEPTH * (0.3 + 0.7 * t);
        // Añadir variación aleatoria suave (ruido simple)
        const noise = Math.sin(nx * 20) * Math.cos(ny * 15) * 1.5;
        depth += noise;
      } else if (nx < TALUD_START) {
        // Plataforma continental: profundidad constante con ondulaciones
        const t = (nx - COAST_LINE) / (TALUD_START - COAST_LINE);
        depth = SHALLOW_DEPTH * (0.7 + 0.3 * t);
        const noise = Math.sin(nx * 30 + ny * 10) * 1.0;
        depth += noise;
      } else if (nx < TALUD_END) {
        // Talud continental: descenso pronunciado
        const t = (nx - TALUD_START) / (TALUD_END - TALUD_START);
        depth = SHALLOW_DEPTH + (DEEP_DEPTH - SHALLOW_DEPTH) * Math.pow(t, 1.5);
        const noise = Math.sin(nx * 25 - ny * 20) * 5.0;
        depth += noise;
      } else {
        // Fondo oceánico profundo
        const t = (nx - TALUD_END) / (1 - TALUD_END);
        depth = DEEP_DEPTH + (DEEP_DEPTH * 0.1) * t;
        // Montañas submarinas aleatorias
        const mountainDist = Math.sqrt(
          Math.pow((nx - 0.82) * 3, 2) + Math.pow((ny - 0.5) * 3, 2)
        );
        if (mountainDist < 0.8) {
          const mountainHeight = (1 - mountainDist / 0.8) * 80;
          depth -= mountainHeight;
        }
        // Segundo monte
        const mountainDist2 = Math.sqrt(
          Math.pow((nx - 0.88) * 4, 2) + Math.pow((ny - 0.7) * 4, 2)
        );
        if (mountainDist2 < 0.5) {
          const mountainHeight2 = (1 - mountainDist2 / 0.5) * 50;
          depth -= mountainHeight2;
        }
      }

      data[y * width + x] = Math.round(depth * 10) / 10; // Precisión 0.1m
    }
  }

  return data;
}

// ── Generar y guardar ────────────────────────────────────────────────

console.log('🗺️  Generando heightmap sintético de plataforma continental...');
console.log(`   Grid: ${SIZE}×${SIZE}`);

const data = generateContinentShelf(SIZE, SIZE);

// Calcular estadísticas
const depths = Array.from(data);
const minDepth = Math.min(...depths);
const maxDepth = Math.max(...depths);
console.log(`   Profundidad mínima: ${minDepth.toFixed(1)} m`);
console.log(`   Profundidad máxima: ${maxDepth.toFixed(1)} m`);

// Construir binario: [width: uint32][height: uint32][data: Float32LE]
const headerSize = 4 + 4;
const dataBytes = data.buffer.byteLength;
const totalBytes = headerSize + dataBytes;
const outputBuffer = Buffer.alloc(totalBytes);
outputBuffer.writeUInt32LE(SIZE, 0);
outputBuffer.writeUInt32LE(SIZE, 4);
for (let i = 0; i < data.length; i++) {
  outputBuffer.writeFloatLE(data[i], headerSize + i * 4);
}

// Asegurar que el directorio existe
mkdirSync(resolve(ROOT, 'data/processed'), { recursive: true });

writeFileSync(OUTPUT, outputBuffer);

console.log(`\n✅ Heightmap guardado: ${OUTPUT}`);
console.log(`   Tamaño: ${(totalBytes / 1024).toFixed(1)} KB`);
console.log(`   Formato: [width:u32][height:u32][Float32LE×${SIZE}²]`);
