# Documentación técnica — WaveThree

## Índice

1. [Arquitectura general](#arquitectura-general)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Módulos principales](#módulos-principales)
4. [API de los módulos](#api-de-los-módulos)
5. [Pipeline de datos](#pipeline-de-datos)
6. [Añadir nuevos escenarios](#añadir-nuevos-scenarios)
7. [Extender el pipeline de datos](#extender-el-pipeline-de-datos)
8. [Extender el visor](#extender-el-visor)

---

## Arquitectura general

WaveThree sigue una arquitectura modular de pipeline de datos → motor de renderizado → visor interactivo:

```
┌──────────────────────────────────────────────────────────────────┐
│                        FUENTES DE DATOS                          │
│  GEBCO  │  SWAN  │  Boyas  │  NetCDF  │  JSON (escenarios)      │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      PREPROCESAMIENTO                            │
│  apps/preprocessing/                                             │
│  • gebco-extract.js  — Recorte y conversión de GEBCO             │
│  • scenario-gen.js   — Generación de escenarios JSON             │
│  • demo-bathy.js     — Batimetría sintética de demo              │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                        MOTOR 3D                                  │
│  src/                                                            │
│  • ocean/        — Motores oceánicos (Gerstner, Espectral)       │
│  • bathymetry/   — Carga y renderizado de batimetría             │
│  • structures/   — Estructuras costeras (dique, muelle)          │
│  • scene/        — Configuración de escena Three.js              │
│  • loaders/      — Carga de datos (JSON, NetCDF, bin)            │
│  • ui/           — Componentes UI (ExportPanel)                  │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                        VISOR                                     │
│  apps/web-viewer/                                                │
│  • main.js       — Punto de entrada, orquestación                │
│  • index.html    — Estructura HTML, CSS                          │
│  • comparador.js — Vista comparador de escenarios                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Estructura del proyecto

```
WaveThree/
├── apps/
│   └── web-viewer/                  # Visor web
│       ├── index.html               # HTML principal
│       ├── vite.config.js           # Config Vite
│       └── src/
│           ├── main.js              # Punto de entrada
│           └── comparador.js        # Comparador de escenarios
├── src/
│   ├── ocean/
│   │   ├── index.js                 # Exportaciones
│   │   ├── gerstner.js              # Motor Gerstner (shader)
│   │   ├── spectral-ocean.js        # Motor espectral JONSWAP
│   │   ├── spectrum.js              # Espectro JONSWAP
│   │   └── fft.js                   # FFT 2D CPU
│   ├── bathymetry/
│   │   ├── index.js                 # Carga y creación de mesh
│   │   └── bathymetry-shader.js     # Shader de batimetría
│   ├── structures/
│   │   ├── index.js                 # Dique y muelle
│   │   ├── foam.js                  # Sistema de espuma
│   │   └── splash.js                # Sistema de spray
│   ├── scene/
│   │   └── setup.js                 # Escena Three.js base
│   ├── loaders/
│   │   └── index.js                 # Scenarios, NetCDF, bin
│   └── ui/
│       ├── index.js                 # Exportaciones UI
│       └── ExportPanel.js           # Panel de exportación PNG
├── data/
│   └── scenarios/                   # Escenarios JSON
│       ├── temporal_2026_01_17_1200.json
│       ├── swell_atlantic.json
│       ├── calm_day.json
│       ├── storm_extreme.json
│       └── port_scene.json
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── sources/
│   ├── user-guide.md                # Guía de usuario
│   └── technical-docs.md            # Esta documentación
├── README.md
└── package.json
```

---

## Módulos principales

### 1. Motor Gerstner (`src/ocean/gerstner.js`)

Implementa ondas de Gerstner en un shader de fragmento personalizado.

**Características:**
- Geometría de plano subdividido (128x128 segmentos)
- Vertex shader que aplica desplazamiento de Gerstner
- Fragment shader con iluminación Phong y color oceánico
- Actualización por frame con parámetros modificables

**API:**
```javascript
import { createGerstnerOcean } from '../../../src/ocean/gerstner.js';

const ocean = createGerstnerOcean({
  amplitude: 3.2,    // Altura significativa (m)
  frequency: 0.4,    // Frecuencia (Hz = 1/Tp)
  speed: 0.5,        // Velocidad de propagación
  direction: 245,    // Dirección (grados)
  windSpeed: 17.5,   // Velocidad viento (m/s)
});

// Actualizar en el loop de animación
ocean.update(elapsedTime, params);
```

### 2. Motor Espectral (`src/ocean/spectral-ocean.js`)

Implementa un océano basado en el espectro JONSWAP con iFFT 2D en CPU.

**Características:**
- Espectro JONSWAP con factor de pico γ = 3.3
- FFT 2D inversa para generar campo de alturas
- Campo de velocidades derivado del espectro
- Actualización por frame con parámetros modificables

**API:**
```javascript
import { createSpectralOcean } from '../../../src/ocean/spectral-ocean.js';

const spectralOcean = createSpectralOcean({
  hs: 3.2,           // Altura significativa (m)
  tp: 8.7,           // Periodo pico (s)
  dir: 245,          // Dirección (grados)
  N: 128,            // Resolución de la malla
  L: 64,             // Longitud del dominio (m)
  windSpeed: 17.5,   // Velocidad viento (m/s)
  windDir: 245,      // Dirección viento (grados)
});

spectralOcean.update(elapsedTime, {
  amplitude: 3.2,
  frequency: 0.4,
  direction: 245,
  windSpeed: 17.5,
});
```

### 3. Batimetría (`src/bathymetry/index.js`)

Carga datos de batimetría desde un archivo binario y crea un mesh 3D.

**Características:**
- Carga de archivos .bin (float32)
- Mapeo de profundidad a color con shader personalizado
- Soporte para escalas X, Z y vertical independientes

**API:**
```javascript
import { loadAndCreateBathymetry } from '../../../src/bathymetry/index.js';

const mesh = await loadAndCreateBathymetry('/demo-bathymetry.bin', {
  segW: 128,           // Segmentos en X
  segH: 128,           // Segmentos en Z
  scaleX: 100,         // Escala X (m)
  scaleZ: 100,         // Escala Z (m)
  verticalScale: 0.3,  // Escala vertical
  maxDepth: 300,       // Profundidad máxima (m)
  scene,               // Escena Three.js
});
```

### 4. Estructuras costeras (`src/structures/index.js`)

Crea geometría de diques en talud y muelles/espigones.

**API — Dique:**
```javascript
import { createBreakwater } from '../../../src/structures/index.js';

const breakwater = createBreakwater({
  length: 45,        // Longitud del dique (m)
  height: 5,         // Altura sobre el nivel del mar (m)
  baseWidth: 10,     // Ancho de la base (m)
  topWidth: 2.5,     // Ancho de la coronación (m)
  positionX: -15,    // Posición X
  positionZ: -38,    // Posición Z
  positionY: -1,     // Posición Y
  scene: structuresGroup,
});
```

**API — Muelle:**
```javascript
import { createPier } from '../../../src/structures/index.js';

const pier = createPier({
  length: 22,        // Longitud del muelle (m)
  width: 3,          // Ancho (m)
  height: 1.5,       // Altura sobre el nivel del mar (m)
  positionX: 20,     // Posición X
  positionZ: -30,    // Posición Z
  rotationY: -0.3,   // Rotación (rad)
  scene: structuresGroup,
});
```

### 5. ExportPanel (`src/ui/ExportPanel.js`)

Panel flotante para exportar capturas PNG y compartir URLs con estado.

**API:**
```javascript
import { ExportPanel } from '../../../src/ui/ExportPanel.js';

const exportPanel = new ExportPanel({
  renderer,              // THREE.WebGLRenderer
  getState: () => ({     // Función que devuelve el estado actual
    scenarioId: state.scenarioId,
    params: state.params,
    oceanMode: state.oceanMode,
  }),
  scenarioMeta: meta,    // Metadatos del escenario
  baseURL: window.location.origin,
});

exportPanel.mount();           // Montar en el DOM
exportPanel.updateScenarioMeta(meta);  // Actualizar metadatos
exportPanel.unmount();         // Desmontar
```

**Métodos internos:**
- `_exportPNG()` — Captura la escena y descarga PNG con watermark
- `_shareURL()` — Copia al portapapeles la URL con parámetros actuales
- `_toggleMenu()` — Muestra/oculta el menú desplegable

### 6. Comparador (`apps/web-viewer/src/comparador.js`)

Sistema de comparación de escenarios con modos split, crossfade y toggle.

**API:**
```javascript
import { Comparador } from './comparador.js';

const comparador = new Comparador({
  scene, camera, renderer, controls,
  selectScenario,  // Función para cargar un escenario
});

comparador.enable();           // Activar UI
comparador.selectA('scenario_a');  // Seleccionar escenario A
comparador.selectB('scenario_b');  // Seleccionar escenario B
comparador.setMode('split');   // 'split' | 'crossfade' | 'toggle'
comparador.render(time);       // Llamar en el loop de animación
comparador.disable();          // Desactivar
comparador.dispose();          // Liberar recursos
```

**Modos:**
- **Split**: dos escenas lado a lado con línea divisoria arrastrable
- **Crossfade**: transición suave entre escenarios con slider de progreso
- **Toggle**: alternar entre escenarios con un clic

---

## API de los módulos

### loadScenariosList()

```javascript
import { loadScenariosList } from '../../../src/loaders/index.js';

const scenarios = await loadScenariosList();
// → [{ id, label, location, time }, ...]
```

### scenarioToWaveParams()

```javascript
import { scenarioToWaveParams } from '../../../src/loaders/index.js';

const params = scenarioToWaveParams(scenario);
// → { amplitude, frequency, direction, windSpeed, windDir }
```

### loadScenario()

```javascript
import { loadScenario } from '../../../src/loaders/index.js';

const scenario = await loadScenario('data/scenarios/temporal_2026_01_17_1200.json');
// → { id, label, location, time, wave: { hs, tp, dir }, wind: { speed, dir } }
```

---

## Pipeline de datos

### Flujo completo

```
[GEBCO .grd] ──> gebco-extract.js ──> [bathymetry.bin]
                                                      │
[SWAN output] ──> scenario-generator.js ──> [scenario.json]
                                                      │
[NetCDF] ──────> netcdfjs (browser) ──> [scenario.json]
                                                      │
                                                      ▼
                                              [Three.js Scene]
```

### Formato de escenario JSON

```json
{
  "id": "temporal_2026_01_17_1200",
  "label": "Temporal enero 2026",
  "location": "Cantábrico",
  "time": "2026-01-17T12:00:00Z",
  "wave": {
    "hs": 3.2,
    "tp": 8.7,
    "dir": 245,
    "notes": ""
  },
  "wind": {
    "speed": 17.5,
    "dir": 240,
    "notes": ""
  },
  "bathymetry": null,
  "structure": null
}
```

### Validación

Los escenarios se validan contra un schema con campos requeridos:
- `id` (string), `label` (string), `location` (string), `time` (string)
- `wave.hs` (number, 0-25), `wave.tp` (number, 0-30), `wave.dir` (number, 0-360)
- `wind.speed` (number, 0-60), `wind.dir` (number)

---

## Añadir nuevos escenarios

### Paso 1: Crear el archivo JSON

Crea un archivo `data/scenarios/mi_escenario.json` con el formato descrito arriba.

### Paso 2: Añadir al loader

En `src/loaders/index.js`, añade el ID a `knownScenarios`:

```javascript
const knownScenarios = [
  'temporal_2026_01_17_1200',
  'swell_atlantic',
  'calm_day',
  'storm_extreme',
  'port_scene',
  'mi_escenario',  // ← Añadir aquí
];
```

### Paso 3: Actualizar el selector

El selector se populate automáticamente desde `loadScenariosList()`. Solo necesitas añadir el archivo JSON.

---

## Extender el pipeline de datos

### Añadir nueva fuente de datos

1. **Crear un loader** en `src/loaders/` siguiendo el patrón de `loadScenario()`:
   ```javascript
   export async function loadMySource(url) {
     const response = await fetch(url);
     const data = await response.json();
     return normalizeMyData(data);
   }
   ```

2. **Añadir a la lista de escenarios** en `src/loaders/index.js`

3. **Conectar al visor** en `apps/web-viewer/src/main.js`

### Añadir nuevo motor oceánico

1. **Crear el módulo** en `src/ocean/` siguiendo el patrón de `gerstner.js`:
   ```javascript
   export function createNewOcean(params) {
     // Crear geometría
     // Crear shader material
     // Crear mesh
     return {
       mesh,
       update(time, params) {
         // Actualizar uniforms
       },
     };
   }
   ```

2. **Importar en main.js** y añadir al toggle de modos

3. **Añadir slider** en el panel UI si es necesario

### Añadir nueva estructura costera

1. **Crear la geometría** en `src/structures/` siguiendo el patrón de `createBreakwater()`
2. **Exportar** desde `src/structures/index.js`
3. **Instanciar** en `main.js` dentro de `initStructures()`

---

## Extender el visor

### Añadir nueva UI

1. **Crear componente** en `src/ui/` siguiendo el patrón de `ExportPanel.js`
2. **Exportar** desde `src/ui/index.js`
3. **Importar y montar** en `apps/web-viewer/src/main.js`

### Añadir atajos de teclado

Añadir en el `keydown` listener de `main.js`:

```javascript
if (e.key === 'x' || e.key === 'X') {
  // Acción personalizada
}
```

### Añadir nueva vista

1. **Crear módulo** en `apps/web-viewer/src/`
2. **Importar y montar** en `main.js`
3. **Añadir UI** en `index.html` si es necesario

---

## Notas de desarrollo

### Variables globales del estado

```javascript
const state = {
  scenarioId: null,       // ID del escenario actual
  scenarioMeta: null,     // Metadatos completos del escenario
  oceanMode: 'gerstner',  // 'gerstner' | 'spectral'
  showStructures: true,   // Visibilidad de estructuras
  params: {
    amplitude: 0,         // Hs (altura significativa)
    frequency: 0.4,       // 1/Tp (frecuencia)
    speed: 0.5,           // Velocidad de propagación
    direction: 245,       // Dirección (grados)
    windSpeed: 17.5,      // Velocidad viento (m/s)
  },
};
```

### Ciclo de renderizado

```javascript
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // 1. Actualizar océano
  ocean.update(t, params);

  // 2. Actualizar partículas (espuma, spray)
  foamSystem.update(dt, waveHeight, structurePos);
  spraySystem.update(dt, waveHeight, structurePos);

  // 3. Actualizar controles
  controls.update();

  // 4. Renderizar
  renderer.render(scene, camera);

  // 5. FPS counter
  updateFPS(t);
}
```

---

> Hecho con ❤️ por David Antizar
