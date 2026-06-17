# Fase 0 — Investigación y definición de WaveThree

**Fecha:** 2026-06-17
**Estado:** ✅ Completada

## 1. Zona piloto seleccionada

### Costa Cantábrica — Gijón (Asturias)

| Parámetro | Valor |
|-----------|-------|
| Coordenadas boya Gijón | 43.50°N, 5.50°O (aproximado) |
| Profundidad | ~50-80 m en plataforma |
| Oleaje típico | Hs 1.5-3.5 m, Tp 8-12 s |
| Tipo de costa | Acantilados + playas + puerto |

**Motivos de la elección:**
- Boya de Puertos del Estado con datos históricos abiertos
- Batimetría variada (plataforma → costa)
- Oleaje significativo del NW (bueno para visualización)
- Puerto de El Musel con estructuras costeras interesantes
- Datos GEBCO disponibles para la zona

## 2. Mapa de fuentes de datos

| Fuente | Tipo | Formato | Acceso | Licencia |
|--------|------|---------|--------|----------|
| **GEBCO_2026** | Batimetría global | NetCDF (.nc), GeoTIFF, Esri ASCII | download.gebco.net | Libre (GEBCO) |
| **Boya Gijón (Puertos del Estado)** | Oleaje (Hs, Tp, Dir), viento | CSV, NetCDF | portus.puertos.es | Abierta |
| **SWAN** | Modelo de oleaje costero | NetCDF, ASCII | swanmodel.sourceforge.io | GNU GPL |
| **Puertos del Estado - SIMAR** | Reanálisis de oleaje | NetCDF | portus.puertos.es | Abierta |
| **EMODnet** | Batimetría detallada | NetCDF, XYZ | emodnet.ec.europa.eu | CC-BY |

## 3. Pipeline de datos definido

### 3.1 Batimetría (GEBCO)

```
GEBCO global .nc
    → recorte espacial (43.2-43.7°N, 5.2-6.0°O)
    → remuestreo (15 arcsec → resolución equilibrada)
    → exportar a Float32 binary heightmap
    → generar textura de profundidad para shader
```

### 3.2 Datos de oleaje (Boya / SWAN)

```
NetCDF de boya o SWAN
    → extraer serie temporal (Hs, Tp, Dir, Wind)
    → agrupar por estado de mar significativo
    → generar JSON de escenario autocontenido
    → almacenar en data/scenarios/
```

### 3.3 Escenarios de ejemplo a preparar

| Escenario | Hs | Tp | Dir | Viento | Descripción |
|-----------|----|----|-----|--------|-------------|
| Temporal invierno | 3.2 | 8.7 | 245° | SW 17.5 m/s | Temporal NW típico |
| Mar de fondo | 1.8 | 12.5 | 310° | N 5 m/s | Swell atlántico |
| Calma | 0.5 | 4.2 | 180° | S 3 m/s | Día plano |
| Temporal extremo | 6.0 | 14.2 | 300° | NW 25 m/s | Borrasca profunda |

## 4. Decisiones técnicas de la Fase 0

| Decisión | Opción | Motivo |
|----------|--------|--------|
| **Zona piloto** | Gijón (Cantábrico) | Boya real, datos abiertos, batimetría variada |
| **Formato batimetría** | Float32 binary | Compacto, lectura directa con fetch + ArrayBuffer |
| **Formato escenarios** | JSON autocontenido | Portable, sin dependencias NetCDF en runtime |
| **Preproceso** | Node.js scripts | Mismo lenguaje que el visor, ecosistema netcdfjs |
| **Estructuras costa** | GLB/GLTF | Formato estándar Three.js |

## 5. Backlog técnico priorizado

### Hito 1 (Fase 1) — MVP visual ✅ (en progreso vía crons)
- [x] Escena Three.js con cámara, luces, renderizador
- [x] Ondas Gerstner con vertex shader
- [x] Panel UI con sliders de Hs, Tp, Dir
- [ ] Mejora visual: color, espuma, iluminación dinámica
- [ ] Selector de escenarios predefinidos
- [ ] GitHub Pages desplegado

### Hito 2 (Fase 2) — Datos reales
- [ ] Descargar primer tile GEBCO de zona piloto
- [ ] Script de conversión GEBCO → heightmap bin
- [ ] Visualización de batimetría en 3D
- [ ] Carga de escenario real desde JSON

### Hito 3 (Fase 3) — Océano espectral
- [ ] Implementar JONSWAP spectrum
- [ ] Implementar iFFT en GPU
- [ ] Migrar de Gerstner a espectral
- [ ] Perfiles de rendimiento WebGPU vs WebGL

### Hito 4 (Fase 4) — Costa y estructuras
- [ ] Modelo 3D de dique/espigón
- [ ] Efectos de impacto visual
- [ ] Espuma dinámica en costa

### Hito 5 (Fase 5) — Producto técnico
- [ ] Comparador de escenarios
- [ ] Exportación de vistas
- [ ] Documentación final

## 6. Referencias de la Fase 0

- GEBCO Gridded Bathymetry: https://www.gebco.net/data-products/gridded-bathymetry-data/
- Puertos del Estado - Portus: https://www.puertos.es/es-es/oceanografia/Paginas/portus.aspx
- SWAN model: https://delftwaves.github.io/swan-docs/
- netcdfjs: https://www.jsdelivr.com/package/npm/netcdf
- Three.js WebGPU: https://threejs.org/docs/pages/WebGPU.html