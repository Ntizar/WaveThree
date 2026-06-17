# ADR-001: Estrategia arquitectónica

**Fecha:** 2026-06-17
**Estado:** Aceptado
**Contexto:** Decidir la arquitectura base del proyecto WaveThree antes de comenzar la implementación.

## Decisión

Separar el sistema en cuatro capas independientes:

1. **Fuentes de datos** (GEBCO, SWAN, boyas, NetCDF)
2. **Preproceso** (Python/Node.js — recorte, conversión, generación de escenarios)
3. **Motor Three.js** (visualización GPU)
4. **Escena 3D final** (interfaz navegable)

## Consecuencias

- **Positivas:** el navegador no necesita resolver física compleja; los escenarios son autocontenidos; cada capa puede evolucionar independientemente
- **Negativas:** requiere un pipeline de preproceso; los datos actualizados necesitan regenerar escenarios
- **Riesgo:** que el preproceso se convierta en cuello de botella si no se automatiza

## Alternativas consideradas

1. **Simulación completa en navegador** — descartado por rendimiento y complejidad
2. **API backend con datos servidos dinámicamente** — viable a futuro, pero añade coste de infra innecesario para prototipo
3. **Un solo monolito visual** — descartado por mezclar responsabilidades

## Referencias

- Three.js WebGPU: https://threejs.org/docs/pages/WebGPU.html
- SWAN model: https://delftwaves.github.io/swan-docs/
- GEBCO: https://www.gebco.net