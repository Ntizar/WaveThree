# Guía de usuario — WaveThree

## Introducción

WaveThree es un visor marino 3D que permite explorar escenarios de oleaje, viento y batimetría en un entorno 3D interactivo. Es una herramienta técnica diseñada para ingenieros costeros, oceanógrafos y profesionales del sector marítimo.

## Instalación

```bash
git clone https://github.com/Ntizar/WaveThree.git
cd WaveThree
cd apps/web-viewer
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

## Interfaz principal

### Cabecera superior

- **Logo WaveThree**: enlace al repositorio GitHub
- **Indicador de versión**: muestra la versión actual del proyecto
- **Atajos de teclado**: referencia rápida de todas las teclas disponibles

### Panel de control (izquierda)

El panel contiene todos los controles del visor:

1. **Selector de escenarios**: lista de escenarios predefinidos
2. **Metadatos del escenario**: ubicación, fecha, parámetros actuales
3. **Sliders de oleaje**: Altura (Hs), Periodo (Tp), Dirección
4. **Slider de viento**: Velocidad del viento
5. **Selector de motor**: Gerstner (rápido) o Espectral (realista)
6. **Control de estructuras**: mostrar/ocultar diques y muelles

### Controles de navegación

- **Arrastrar**: rotar cámara (OrbitControls)
- **Scroll**: zoom in/out
- **Clic derecho + arrastrar**: panorámica

### FPS Counter

Indicador de rendimiento en la esquina superior derecha:
- 🟢 Verde: ≥50 FPS
- 🟡 Amarillo: 30-49 FPS
- 🔴 Rojo: <30 FPS

## Escenarios disponibles

### 1. Temporal enero 2026

Condiciones de temporal real en el Cantábrico.

- **Ubicación**: Cantábrico
- **Fecha**: 17/01/2026 12:00
- **Hs**: 3.2 m
- **Tp**: 8.7 s
- **Dirección**: 245° (SO)
- **Viento**: 17.5 m/s desde 240°

### 2. Mar de fondo atlántico

Swell largo proveniente del Atlántico, típico de costas gallegas.

- **Ubicación**: Costa gallega
- **Fecha**: Simulación
- **Hs**: 2.5 m
- **Tp**: 12.0 s
- **Dirección**: 270° (O)
- **Viento**: 5.0 m/s desde 250°

### 3. Día en calma

Condiciones de mar muy tranquila, ideal para validar el renderizado base.

- **Ubicación**: Mediterráneo
- **Fecha**: Simulación
- **Hs**: 0.5 m
- **Tp**: 4.0 s
- **Dirección**: 180° (S)
- **Viento**: 1.0 m/s desde 180°

### 4. Temporal extremo

Condiciones límite, huracán. Para validar el comportamiento en rangos extremos.

- **Ubicación**: Atlántico Norte
- **Fecha**: Simulación
- **Hs**: 7.0 m
- **Tp**: 14.0 s
- **Dirección**: 220° (SO)
- **Viento**: 35.0 m/s desde 220°

### 5. Puerto con dique

Escenario con estructuras costeras: dique en talud y muelle/espigón.

- **Ubicación**: Puerto artificial
- **Fecha**: Simulación
- **Hs**: 1.8 m
- **Tp**: 6.5 s
- **Dirección**: 200° (SSO)
- **Viento**: 8.0 m/s desde 190°

## Interpretación de parámetros

### Oleaje

| Parámetro | Símbolo | Unidad | Rango | Descripción |
|-----------|---------|--------|-------|-------------|
| Altura significativa | Hs | metros | 0-8 | Altura del tercio superior de olas |
| Periodo pico | Tp | segundos | 1-18 | Periodo de máxima energía del espectro |
| Dirección | Dir | grados | 0-360 | Dirección desde la que viene el oleaje |

### Viento

| Parámetro | Símbolo | Unidad | Rango | Descripción |
|-----------|---------|--------|-------|-------------|
| Velocidad | U₁₀ | m/s | 0-40 | Velocidad del viento a 10m sobre la superficie |

### Motores oceánicos

#### Gerstner

- **Rápido**: renderizado en tiempo real sin procesamiento previo
- **Visual**: ondas de Gerstner en shader, aspecto realista
- **Ideal para**: presentaciones, exploración rápida, validación visual

#### Espectral (JONSWAP)

- **Físico**: basado en el espectro JONSWAP (Joint North Sea Wave Project)
- **FFT 2D**: transformada inversa de Fourier en CPU para generar el campo de alturas
- **Ideal para**: análisis técnico, validación científica, producción de datos

## Uso del comparador

El comparador permite visualizar dos escenarios simultáneamente:

1. **Activar**: haz clic en el botón 🔀 Split en la barra superior
2. **Modos**:
   - **Split**: dos escenas lado a lado con línea divisoria arrastrable
   - **Crossfade**: transición suave entre escenarios con slider
   - **Toggle**: alternar entre escenarios con un clic
3. **Seleccionar escenarios**: usa los selectores A y B para elegir cada escenario
4. **Ajustar división**: arrastra la línea vertical en modo Split

## Exportar vistas

### Captura PNG

1. Haz clic en el botón **📷 Exportar** (esquina inferior derecha)
2. Selecciona **📸 Capturar PNG**
3. Se descargará un PNG con:
   - La escena renderizada
   - Watermark "WaveThree — Hecho con ❤️ por David Antizar"
   - Metadatos del escenario (ubicación, fecha, parámetros)

### Compartir vista

1. Haz clic en **📷 Exportar**
2. Selecciona **🔗 Compartir vista**
3. Se copia al portapapeles una URL con todos los parámetros actuales
4. Al abrir la URL, el visor cargará el mismo escenario y parámetros

## Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `1`-`4` | Seleccionar escenario por posición (1-4) |
| `R` | Resetear cámara a posición inicial |
| `E` | Exportar captura PNG |
| `S` | Alternar motor Gerstner ↔ Espectral |
| `B` | Mostrar/ocultar estructuras costeras |

## Resolución de problemas

### El visor no carga

1. Verifica que el servidor de desarrollo está corriendo (`npm run dev`)
2. Comprueba la consola del navegador (F12) para errores
3. Asegúrate de que los archivos de datos existen en `data/scenarios/`

### Rendimiento bajo

1. Si usas el motor espectral, espera a que termine la FFT (aparece "Calculando FFT…")
2. Reduce la resolución del navegador
3. Desactiva estructuras costeras con la tecla `B`

### Los sliders no responden

1. Asegúrate de que no estás dentro de un input al presionar teclas
2. Recarga la página si el panel está colapsado

## Soporte

Para reportar errores o sugerir mejoras:

- **GitHub Issues**: https://github.com/Ntizar/WaveThree/issues
- **Repositorio**: https://github.com/Ntizar/WaveThree

---

> Hecho con ❤️ por David Antizar
