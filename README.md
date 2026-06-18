# WaveThree 🌊

**Visor marino 3D con Three.js, WebGPU y datos oceanográficos**

WaveThree convierte datos reales de oleaje, batimetría y viento en experiencias 3D navegables en el navegador. No es un juego de agua "bonita": es un sistema técnico que une modelos numéricos costeros (SWAN), datos abiertos (GEBCO, boyas, NetCDF) y renderizado GPU para crear visualizaciones defendibles tanto visual como técnicamente.

```text
      ____  _       __     __  _                     _
     / __ \| |      \ \   / / | |                   | |
    | |  | | |       \ \_/ /__| | ___  ___ ___ _ __ | |___
    | |  | | |        \   // _` |/ _ \/ __/ _ \ '_ \| / __|
    | |__| | |____     | || (_| |  __/ (_|  __/ | | | \__ \
     \___\_\______|    |_| \__,_|\___|\___\___|_| |_|_|___/
```

## 📸 Vista previa

![WaveThree Visor](https://raw.githubusercontent.com/Ntizar/WaveThree/main/screenshot-placeholder.png)

> Captura del visor con el escenario "Temporal enero 2026" — modo Gerstner, con estructuras costeras.

## Propósito

Construir un sistema web que convierta datos de estudios de mar y oleaje en una experiencia 3D útil, visualmente potente y técnicamente defendible.

## La tesis

No intentamos que Three.js "invente" el mar desde cero. Usamos Three.js para traducir a imagen navegable una base física y geoespacial que ya existe en modelos (SWAN), observaciones (boyas) y datos abiertos (GEBCO).

## Estado actual — Fase 5 ✅

| Fase | Capacidad | Estado |
|------|-----------|--------|
| 0 | Investigación y definición | ✅ Completada |
| 1 | MVP visual — ondas Gerstner, escena 3D básica | ✅ Completada |
| 2 | Datos reales — NetCDF, batimetría GEBCO, escenarios | ✅ Completada |
| 3 | Océano espectral — JONSWAP + iFFT + WebGPU | ✅ Completada |
| 4 | Costa y estructuras — diques, espuma, impacto visual | ✅ Completada |
| 5 | Producto técnico — comparador, exportación, documentación | ✅ **Completada** |

### Qué incluye la Fase 5

- **Comparador de escenarios** (`apps/web-viewer/src/comparador.js`): vista split, crossfade y toggle entre dos escenarios
- **Exportación PNG** (`src/ui/ExportPanel.js`): captura de escena con watermark y metadatos, botón compartir que copia URL con estado
- **Cabecera y footer**: logo WaveThree, enlace GitHub, atajos de teclado visibles
- **Atajos de teclado**: `1-4` escenarios, `R` reset cámara, `E` exportar, `S` motor, `B` estructuras
- **Responsive**: panel colapsable, adaptación landscape/portrait
- **Documentación completa**: README actualizado, guía de usuario, docs técnicos

## Capacidades

### Escenarios predefinidos

| Escenario | Descripción | Hs | Tp | Dirección |
|-----------|-------------|-----|-----|-----------|
| Temporal enero 2026 | Cantábrico, temporal real | 3.2 m | 8.7 s | 245° |
| Mar de fondo atlántico | Swell largo del Atlántico | 2.5 m | 12.0 s | 270° |
| Día en calma | Mar tranquila | 0.5 m | 4.0 s | 180° |
| Temporal extremo | Huracán, condiciones límite | 7.0 m | 14.0 s | 220° |
| Puerto con dique | Escenario con estructuras costeras | 1.8 m | 6.5 s | 200° |

### Motores oceánicos

- **Gerstner**: Ondas de Gerstner en shader — rápido, visualmente atractivo
- **Espectral**: JONSWAP + FFT 2D CPU — físicamente realista, espectro de energía

### Estructuras costeras

- **Dique en talud**: geometría trapezoidal con espuma de impacto
- **Muelle/espigón**: estructura con spray dinámico

## Stack

| Capa | Tecnología |
|------|-----------|
| Render 3D | Three.js (WebGL) |
| Olas Gerstner | Shader personalizado |
| Océano espectral | JONSWAP + iFFT 2D CPU |
| Batimetría | GEBCO global grid (extract) |
| Modelo numérico | SWAN (datos precomputados) |
| Lectura NetCDF | netcdfjs |
| Build | Vite |

## Arquitectura

```
┌─────────────┐    ┌────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Fuentes    │───>│ Preproceso │───>│  Motor Three.js │───>│ Escena 3D    │
│  de datos   │    │ (Python/   │    │  + WebGL        │    │ navegable    │
│             │    │  Node.js)  │    │                 │    │              │
│ • GEBCO     │    │ • Recorte  │    │ • Olas Gerstner │    │ • Cámara     │
│ • SWAN      │    │ • Convers. │    │ • iFFT espectral│    │ • UI técnica │
│ • Boyas     │    │ • Escenario│    │ • Batimetría    │    │ • Capas info │
│ • NetCDF    │    │ • Tiles    │    │ • Estructuras   │    │ • Controles  │
│             │    │            │    │ • Comparador    │    │ • Exportar   │
│             │    │            │    │ • ExportPanel   │    │ • Atajos     │
└─────────────┘    └────────────┘    └─────────────────┘    └──────────────┘
```

## Primeros pasos

```bash
# Clonar
git clone https://github.com/Ntizar/WaveThree.git
cd WaveThree

# Instalar dependencias (web-viewer)
cd apps/web-viewer
npm install
npm run dev
```

## Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `1`-`9` | Seleccionar escenario por posición |
| `R` | Resetear cámara a posición inicial |
| `E` | Exportar captura PNG |
| `S` | Alternar motor Gerstner ↔ Espectral |
| `B` | Mostrar/ocultar estructuras costeras |

## Uso del comparador

El comparador permite visualizar dos escenarios lado a lado:

1. Abre el menú de exportar (botón 📷)
2. Selecciona modo "Split" para vista dividida
3. Arrastra la línea divisoria para ajustar la proporción
4. Selecciona escenarios diferentes en cada panel

## Exportar vistas

1. Haz clic en el botón **📷 Exportar** (esquina inferior)
2. Selecciona **Capturar PNG** para descargar una imagen con watermark
3. Selecciona **Compartir vista** para copiar la URL con los parámetros actuales

## Zona piloto

El proyecto arranca con una zona piloto concreta (por definir en Fase 0) para validar el pipeline completo antes de escalar.

## Documentación

- [Guía de usuario](docs/user-guide.md) — Cómo usar el visor
- [Documentación técnica](docs/technical-docs.md) — Arquitectura y API de módulos
- [Decisiones de arquitectura](docs/decisions/) — ADRs del proyecto
- [Arquitectura](docs/architecture/) — Diagramas y estructura

## Licencia

**Privado** — © 2026 David Antizar. Todos los derechos reservados.

---

> Hecho con ❤️ por David Antizar
