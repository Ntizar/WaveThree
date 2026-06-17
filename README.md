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

## Propósito

Construir un sistema web que convierta datos de estudios de mar y oleaje en una experiencia 3D útil, visualmente potente y técnicamente defendible.

## La tesis

No intentamos que Three.js "invente" el mar desde cero. Usamos Three.js para traducir a imagen navegable una base física y geoespacial que ya existe en modelos (SWAN), observaciones (boyas) y datos abiertos (GEBCO).

## Capacidades (roadmap)

| Fase | Capacidad | Estado |
|------|-----------|--------|
| 0 | Investigación y definición | 🟡 Planeado |
| 1 | MVP visual — ondas Gerstner, escena 3D básica | ⬜ |
| 2 | Datos reales — NetCDF, batimetría GEBCO, escenarios | ⬜ |
| 3 | Océano espectral — JONSWAP + iFFT + WebGPU | ⬜ |
| 4 | Costa y estructuras — diques, espuma, impacto visual | ⬜ |
| 5 | Producto técnico — comparador, exportación, documentación | ⬜ |

## Stack

| Capa | Tecnología |
|------|-----------|
| Render 3D | Three.js (WebGPU) |
| GPU moderna | WebGPU + TSL |
| Océano espectral | JONSWAP + iFFT (GPU compute) |
| MVP olas | Gerstner waves |
| Batimetría | GEBCO global grid |
| Modelo numérico | SWAN (datos precomputados) |
| Lectura NetCDF | netcdfjs |

## Arquitectura

```
┌─────────────┐    ┌────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Fuentes    │───>│ Preproceso │───>│  Motor Three.js │───>│ Escena 3D    │
│  de datos   │    │ (Python/   │    │  + WebGPU       │    │ navegable    │
│             │    │  Node.js)  │    │                 │    │              │
│ • GEBCO     │    │ • Recorte  │    │ • Olas Gerstner │    │ • Cámara     │
│ • SWAN      │    │ • Convers. │    │ • iFFT espectral│    │ • UI técnica │
│ • Boyas     │    │ • Escenario│    │ • Batimetría    │    │ • Capas info │
│ • NetCDF    │    │ • Tiles    │    │ • Estructuras   │    │ • Controles  │
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

## Zona piloto

El proyecto arranca con una zona piloto concreta (por definir en Fase 0) para validar el pipeline completo antes de escalar.

## Licencia

**Privado** — © 2026 David Antizar. Todos los derechos reservados.

---

> Hecho con ❤️ por David Antizar