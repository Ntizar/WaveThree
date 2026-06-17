/**
 * Módulo de batimetría — carga y representación del fondo marino
 *
 * Fuente: GEBCO global grid (netCDF / GeoTIFF)
 * Fase 2: carga de heightmaps preprocesados en formato binario.
 *
 * Formato del heightmap binario:
 *   [width: uint32LE][height: uint32LE][data: Float32LE × width × height]
 *
 * Los valores en data son profundidades en metros (negativo = bajo el nivel del mar).
 */

import * as THREE from 'three';
import { createBathymetryMaterial } from './bathymetry-shader.js';

// ── Carga de heightmap binario ────────────────────────────────────────

/**
 * Carga un heightmap binario desde una URL.
 * @param {string} url - URL del archivo .bin
 * @returns {Promise<{ data: Float32Array, width: number, height: number }>}
 */
export async function loadBathymetry(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load bathymetry: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const view = new DataView(arrayBuffer);

  // Leer dimensiones del header
  const width = view.getUint32(0, true); // uint32LE
  const height = view.getUint32(4, true); // uint32LE

  if (width < 2 || height < 2) {
    throw new Error(`Invalid bathymetry dimensions: ${width}×${height}`);
  }

  // Leer datos Float32LE
  const data = new Float32Array(arrayBuffer, 8, width * height);

  return { data, width, height };
}

// ── Creación de malla de batimetría ──────────────────────────────────

/**
 * Crea una malla de batimetría a partir de un heightmap.
 *
 * Genera un PlaneGeometry con segmentos, desplaza los vértices en Y
 * según la profundidad, y aplica un material con color por altitud.
 *
 * @param {object} opts
 * @param {Float32Array} opts.data - Datos de profundidad (negativo = fondo)
 * @param {number} opts.width - Ancho del grid
 * @param {number} opts.height - Alto del grid
 * @param {number} [opts.segW=128] - Segmentos en X
 * @param {number} [opts.segH=128] - Segmentos en Z
 * @param {number} [opts.scaleX=100] - Escala horizontal en X
 * @param {number} [opts.scaleZ=100] - Escala horizontal en Z
 * @param {number} [opts.verticalScale=0.3] - Escala vertical de desplazamiento
 * @param {number} [opts.maxDepth=200] - Profundidad máxima esperada (para normalización)
 * @param {THREE.Scene} [opts.scene] - Escena Three.js (para luz direccional si hay shader)
 * @returns {THREE.Mesh}
 */
export function createBathymetryMesh(opts) {
  const {
    data,
    width,
    height,
    segW = 128,
    segH = 128,
    scaleX = 100,
    scaleZ = 100,
    verticalScale = 0.3,
    maxDepth = 200,
    scene,
  } = opts;

  // Calcular dimensiones reales del grid
  const realW = scaleX;
  const realH = scaleZ;
  const aspectRatio = width / height;
  const actualH = realW / aspectRatio;

  // Crear geometría
  const geometry = new THREE.PlaneGeometry(realW, actualH, segW, segH);

  // Desplazar vértices según profundidad
  const positions = geometry.attributes.position.array;
  const count = positions.length / 3;

  // Normalizar datos para mapear a [0, 1]
  let minDepth = Infinity;
  let maxDepthVal = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < minDepth) minDepth = v;
    if (v > maxDepthVal) maxDepthVal = v;
  }

  // Si los datos ya tienen valores razonables, usarlos; sino usar maxDepth
  const depthRange = maxDepthVal - minDepth;
  const effectiveMaxDepth = depthRange > 0 ? depthRange : maxDepth;

  // Mapear vértices: grid 2D → array plano de posiciones
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 1]; // PlaneGeometry está en XY por defecto, pero lo rotamos

    // Normalizar coordenadas del vértice a índices del grid
    const u = (x / realW + 0.5) * (width - 1);
    const v = (z / actualH + 0.5) * (height - 1);

    const col = Math.floor(u);
    const row = Math.floor(v);
    const colFrac = u - col;
    const rowFrac = v - row;

    // Bilinear interpolation
    const c00 = Math.min(col, width - 1);
    const c10 = Math.min(col + 1, width - 1);
    const c01 = Math.min(col, width - 1);
    const c11 = Math.min(col + 1, width - 1);
    const r0 = Math.min(row, height - 1);
    const r1 = Math.min(row + 1, height - 1);

    let depth;
    if (r0 === r1 && c00 === c10) {
      depth = data[r0 * width + c00];
    } else {
      const d00 = data[r0 * width + c00];
      const d10 = data[r0 * width + c10];
      const d01 = data[r1 * width + c01];
      const d11 = data[r1 * width + c11];

      const d0 = d00 * (1 - colFrac) + d10 * colFrac;
      const d1 = d01 * (1 - colFrac) + d11 * colFrac;
      depth = d0 * (1 - rowFrac) + d1 * rowFrac;
    }

    // Desplazar en Y (negativo = bajo el nivel del mar)
    const y = depth * verticalScale;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  geometry.computeVertexNormals();

  // Crear material
  const material = createBathymetryMaterial({
    minDepth,
    maxDepth: maxDepthVal,
    effectiveMaxDepth,
    scene,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // Acostar en XZ
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  // Guardar metadatos en la malla
  mesh.userData.bathymetry = {
    minDepth,
    maxDepth: maxDepthVal,
    width,
    height,
    scaleX: realW,
    scaleZ: actualH,
  };

  return mesh;
}

// ── Función de conveniencia: crear desde URL ─────────────────────────

/**
 * Carga un heightmap desde URL y crea directamente la malla.
 * @param {string} url - URL del archivo .bin
 * @param {object} [options] - Opciones para createBathymetryMesh
 * @returns {Promise<THREE.Mesh>}
 */
export async function loadAndCreateBathymetry(url, options = {}) {
  const { data, width, height } = await loadBathymetry(url);
  return createBathymetryMesh({ data, width, height, ...options });
}
