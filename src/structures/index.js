/**
 * WaveThree — Estructuras costeras
 *
 * Fase 4: diques en talud, espigones/muelles, líneas de costa.
 * Todo generado proceduralmente con Three.js (sin GLB externos).
 */

import * as THREE from 'three';

// ── Utilidades de ruido ────────────────────────────────────────────────

/**
 * Simplex-like 3D noise (compact implementation).
 * Devuelve valores en [-1, 1].
 */
function noise3D(x, y, z) {
  // Perlin-like hash noise
  const perm = new Uint8Array(512);
  const p = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
    69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,
    252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,
    171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,
    122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,
    63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,
    188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,
    38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,
    42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,
    43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
    218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,
    145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,
    115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,
    141,128,195,78,66,215,61,156,180
  ];
  for (let i = 0; i < 256; i++) perm[i] = perm[i + 256] = p[i];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);

  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  const A = perm[X] + Y;
  const AA = perm[A] + Z;
  const AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y;
  const BA = perm[B] + Z;
  const BB = perm[B + 1] + Z;

  return lerp(
    lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
         lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
         lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
    w
  );
}

/**
 * FBM (fractal brownian motion) — múltiples octavas de ruido.
 */
function fbm(x, y, z, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

// ── Material de escollera ──────────────────────────────────────────────

/**
 * Crea un material texturizado que simula rocas de escollera.
 * Usa un canvas texture procedimental con ruido granular.
 */
function createRubbleMaterial(baseColor = new THREE.Color(0x5a5a52)) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Fondo base
  ctx.fillStyle = `#${baseColor.getHexString()}`;
  ctx.fillRect(0, 0, 256, 256);

  // Granulado de rocas
  const imageData = ctx.getImageData(0, 0, 256, 256);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % 256;
    const py = Math.floor((i / 4) / 256);
    const n = fbm(px * 0.05, py * 0.05, 0.5, 5);
    const variation = (n + 1) * 0.5; // [0, 1]
    const rockiness = (Math.random() - 0.5) * 30;
    data[i] = Math.max(0, Math.min(255, data[i] * variation + rockiness));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * variation + rockiness));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * variation + rockiness));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);

  // Normal map simulado (usamos la misma textura como roughness)
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = 128;
  normalCanvas.height = 128;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = '#8080ff';
  nctx.fillRect(0, 0, 128, 128);
  const nData = nctx.getImageData(0, 0, 128, 128);
  for (let i = 0; i < nData.data.length; i += 4) {
    const px = (i / 4) % 128;
    const py = Math.floor((i / 4) / 128);
    const n = fbm(px * 0.1, py * 0.1, 1.0, 3);
    nData.data[i] = 128 + n * 40;
    nData.data[i + 1] = 128 + n * 40;
  }
  nctx.putImageData(nData, 0, 0);
  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(4, 4);

  return new THREE.MeshStandardMaterial({
    map: texture,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.95,
    metalness: 0.05,
    color: 0x888880,
  });
}

// ── Dique en talud (breakwater) ────────────────────────────────────────

/**
 * Crea un dique en talud con perfil trapezoidal y escollera texturizada.
 *
 * @param {object} params
 * @param {number} [params.length=40] — Longitud del dique (eje X)
 * @param {number} [params.height=6] — Altura total desde el fondo
 * @param {number} [params.baseWidth=12] — Ancho de la base
 * @param {number} [params.topWidth=3] — Ancho de la coronación
 * @param {number} [params.positionX=0] — Posición X en la escena
 * @param {number} [params.positionZ=-35] — Posición Z (cerca del borde)
 * @param {number} [params.positionY=-1] — Elevación base
 * @param {THREE.Scene} [params.scene] — Escena para añadir la malla
 * @returns {THREE.Group} Grupo con la geometría del dique
 */
export function createBreakwater(params = {}) {
  const {
    length = 40,
    height = 6,
    baseWidth = 12,
    topWidth = 3,
    positionX = 0,
    positionZ = -35,
    positionY = -1,
    scene = null,
  } = params;

  const group = new THREE.Group();
  group.name = 'breakwater';

  const material = createRubbleMaterial();

  // Perfil trapezoidal: sección transversal en XZ
  // Vamos a construir el dique como un prisma largo con sección trapezoidal
  const segments = 20; // segmentos a lo largo del eje X
  const depthSegments = 16; // segmentos verticales

  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Generar malla del dique
  // El dique se extiende en X de -length/2 a +length/2
  // La sección transversal (Z-Y) es un trapecio

  const halfLen = length / 2;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -halfLen + t * length;

    // Añadir algo de irregularidad a lo largo del dique
    const irregularity = fbm(x * 0.08, 0, 0, 3) * 0.5;

    for (let j = 0; j <= depthSegments; j++) {
      const s = j / depthSegments; // 0 = base, 1 = coronación

      // Ancho en esta altura (interpolación lineal del trapecio)
      const w = baseWidth * (1 - s) + topWidth * s;

      // Irregularidad vertical
      const vertIrreg = fbm(x * 0.1, s * 5, 0.3, 3) * 0.4;

      // Posición Y (base hacia arriba)
      const y = positionY + s * height + vertIrreg;

      // Posición Z (centro del dique)
      const z = positionZ;

      // Offset lateral para el ancho
      const halfW = w / 2;

      // Dos vértices por sección (lado izquierdo y derecho)
      vertices.push(x - halfW, y, z);   // izquierda
      vertices.push(x + halfW, y, z);   // derecha
      normals.push(0, 1, 0);
      uvs.push(t, s);
    }
  }

  // Índices: crear quads entre vértices consecutivos
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < depthSegments; j++) {
      const a = i * (depthSegments + 1) * 2 + j * 2;
      const b = a + 1;
      const c = a + 2 * (depthSegments + 1);
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Material principal (escollera)
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Añadir coronación (parte superior plana)
  const capGeo = new THREE.BoxGeometry(length + 1, 0.3, topWidth + 1);
  const capMesh = new THREE.Mesh(capGeo, material);
  capMesh.position.set(
    positionX,
    positionY + height + 0.15,
    positionZ
  );
  capMesh.castShadow = true;
  group.add(capMesh);

  // Añadir escollera adicional en los laterales (textura irregular)
  for (let side = -1; side <= 1; side += 2) {
    const rockCount = 30;
    for (let r = 0; r < rockCount; r++) {
      const rx = -halfLen + Math.random() * length;
      const ry = positionY + Math.random() * height * 0.8;
      const rz = positionZ + side * (topWidth / 2 + Math.random() * (baseWidth - topWidth) / 2);

      const rockSize = 0.3 + Math.random() * 0.8;
      const rockGeo = new THREE.DodecahedronGeometry(rockSize, 0);
      const rock = new THREE.Mesh(rockGeo, material);
      rock.position.set(rx, ry, rz);
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      rock.castShadow = true;
      group.add(rock);
    }
  }

  group.position.set(positionX, 0, positionZ);

  if (scene) {
    scene.add(group);
  }

  // Guardar metadatos para la espuma
  group.userData.breakwater = {
    length,
    height,
    positionX,
    positionZ,
    positionY,
    baseWidth,
    topWidth,
  };

  return group;
}

// ── Línea de costa ─────────────────────────────────────────────────────

/**
 * Crea una línea de costa a partir de una serie de puntos 3D.
 *
 * @param {Array<{x: number, z: number}>} points — Puntos de la costa en XZ
 * @param {object} [options]
 * @param {number} [options.width=4] — Ancho de la franja costera
 * @param {number} [options.segW=50] — Segmentos a lo largo de la costa
 * @param {THREE.Scene} [options.scene] — Escena para añadir
 * @returns {THREE.Mesh} Malla de la línea de costa
 */
export function createSimpleCoastline(points, options = {}) {
  const { width = 4, segW = 50, scene = null } = options;

  if (points.length < 2) {
    console.warn('⚠️ createSimpleCoastline: se necesitan al menos 2 puntos');
    return null;
  }

  // Crear geometría de franja
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Interpolar puntos para tener más segmentos
  const interpolated = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segs = Math.max(2, Math.floor(segW / (points.length - 1)));
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      interpolated.push({
        x: p0.x + (p1.x - p0.x) * t,
        z: p0.z + (p1.z - p0.z) * t,
      });
    }
  }

  // Si solo hay un punto, añadir uno más
  if (interpolated.length < 2) {
    interpolated.push({ x: interpolated[0].x + 1, z: interpolated[0].z });
  }

  const totalSegs = interpolated.length - 1;

  for (let i = 0; i <= totalSegs; i++) {
    const p = interpolated[i];
    const t = i / totalSegs;

    // Dirección a lo largo de la costa
    let dx, dz;
    if (i < totalSegs) {
      dx = interpolated[i + 1].x - p.x;
      dz = interpolated[i + 1].z - p.z;
    } else {
      dx = p.x - interpolated[i - 1].x;
      dz = p.z - interpolated[i - 1].z;
    }
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    dx /= len;
    dz /= len;

    // Normal (perpendicular hacia tierra)
    const nx = -dz;
    const nz = dx;

    // Irregularidad en la línea de costa
    const irreg = fbm(p.x * 0.1, 0, p.z * 0.1, 3) * 1.5;

    for (let side = -1; side <= 1; side += 2) {
      const w = width / 2 + irreg * side;
      const x = p.x + nx * w;
      const z = p.z + nz * w;

      vertices.push(x, 0, z);
      normals.push(0, 1, 0);
      uvs.push(t, side === -1 ? 0 : 1);
    }
  }

  for (let i = 0; i < totalSegs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = c + 1;

    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Material arena/verde
  const sandMaterial = new THREE.MeshStandardMaterial({
    color: 0xc2b280,
    roughness: 1.0,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, sandMaterial);
  mesh.position.y = 0.05; // Just above water level
  mesh.receiveShadow = true;
  mesh.rotation.x = -Math.PI / 2;

  // Ajustar rotación según dirección de la costa
  if (points.length >= 2) {
    const dx = points[points.length - 1].x - points[0].x;
    const dz = points[points.length - 1].z - points[0].z;
    const angle = Math.atan2(dz, dx);
    mesh.rotation.y = angle;
    mesh.rotation.x = -Math.PI / 2;
  }

  if (scene) {
    scene.add(mesh);
  }

  return mesh;
}

// ── Muelle / Espigón ───────────────────────────────────────────────────

/**
 * Crea un muelle o espigón simple con geometría de cajas.
 *
 * @param {object} params
 * @param {number} [params.length=20] — Longitud del muelle
 * @param {number} [params.width=3] — Ancho del muelle
 * @param {number} [params.height=1.5] — Altura sobre el agua
 * @param {number} [params.positionX=0] — Posición X
 * @param {number} [params.positionZ=0] — Posición Z
 * @param {number} [params.rotationY=0] — Rotación en radianes
 * @param {THREE.Scene} [params.scene] — Escena para añadir
 * @returns {THREE.Group} Grupo con el muelle
 */
export function createPier(params = {}) {
  const {
    length = 20,
    width = 3,
    height = 1.5,
    positionX = 0,
    positionZ = -25,
    rotationY = 0,
    scene = null,
  } = params;

  const group = new THREE.Group();
  group.name = 'pier';

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B6914,
    roughness: 0.85,
    metalness: 0.05,
  });

  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0x999999,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Tablón principal (deck)
  const deckGeo = new THREE.BoxGeometry(width, 0.15, length);
  const deck = new THREE.Mesh(deckGeo, woodMaterial);
  deck.position.y = height;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Barandilla
  const railHeight = 1.0;
  const railThickness = 0.08;

  for (let side = -1; side <= 1; side += 2) {
    // Postes
    const postCount = Math.floor(length / 2) + 1;
    for (let p = 0; p < postCount; p++) {
      const pz = -length / 2 + p * 2;
      const postGeo = new THREE.BoxGeometry(railThickness, railHeight, railThickness);
      const post = new THREE.Mesh(postGeo, woodMaterial);
      post.position.set(side * width / 2, height + railHeight / 2, pz);
      post.castShadow = true;
      group.add(post);
    }

    // Barandilla superior
    const railGeo = new THREE.BoxGeometry(railThickness, 0.08, length);
    const rail = new THREE.Mesh(railGeo, woodMaterial);
    rail.position.set(side * width / 2, height + railHeight, 0);
    group.add(rail);

    // Barandilla intermedia
    const midRail = new THREE.Mesh(
      new THREE.BoxGeometry(railThickness, 0.05, length),
      woodMaterial
    );
    midRail.position.set(side * width / 2, height + railHeight * 0.5, 0);
    group.add(midRail);
  }

  // Pilares de soporte
  const pillarCount = Math.floor(length / 3) + 1;
  for (let p = 0; p < pillarCount; p++) {
    const pz = -length / 2 + p * (length / (pillarCount - 1 || 1));
    const pillarGeo = new THREE.BoxGeometry(0.3, height, 0.3);
    for (let side = -1; side <= 1; side += 2) {
      const pillar = new THREE.Mesh(pillarGeo, concreteMaterial);
      pillar.position.set(side * width / 3, height / 2, pz);
      pillar.castShadow = true;
      group.add(pillar);
    }
  }

  group.position.set(positionX, 0, positionZ);
  group.rotation.y = rotationY;

  if (scene) {
    scene.add(group);
  }

  return group;
}
