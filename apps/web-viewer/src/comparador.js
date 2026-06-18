/**
 * Comparador de escenarios — WaveThree
 *
 * Permite visualizar dos escenarios lado a lado (split view) o
 * alternar entre ellos con fundido (crossfade).
 *
 * Uso:
 *   import { Comparador } from './comparador.js';
 *   const comp = new Comparador({ scene, camera, renderer, controls });
 *   comp.selectA(scenarioA);
 *   comp.selectB(scenarioB);
 *   comp.setMode('split');  // 'split' | 'crossfade' | 'toggle'
 */

import * as THREE from 'three';

// ── Clones de escena ──────────────────────────────────────────────────

function cloneSceneScene(scene, camera) {
  /**
   * Clona la escena original para un panel del comparador.
   * Se crean copias de la malla de océano y estructuras
   * con materiales independientes para poder animar por separado.
   */
  const clone = new THREE.Scene();

  // Copiar niebla
  if (scene.fog) clone.fog = scene.fog.clone();

  // Copiar objetos (solo meshes relevantes)
  scene.traverse((child) => {
    if (child.isMesh || child.isPoints || child.isLineSegments) {
      const copy = child.clone();
      // No copiar el grid de referencia (ruido visual)
      if (child.isGridHelper) return;
      clone.add(copy);
    }
  });

  return clone;
}

// ── Estado del comparador ─────────────────────────────────────────────

export class Comparador {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene — Escena Three.js principal
   * @param {THREE.Camera} opts.camera — Cámara
   * @param {THREE.WebGLRenderer} opts.renderer — Renderizador
   * @param {object} opts.controls — OrbitControls
   * @param {Function} opts.selectScenario — Función para cargar un escenario
   */
  constructor({ scene, camera, renderer, controls, selectScenario }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.selectScenario = selectScenario;

    this.mode = 'toggle'; // 'split' | 'crossfade' | 'toggle'
    this.splitRatio = 0.5; // 0..1 para split view

    this.scenarioA = null;
    this.scenarioB = null;
    this.activeScenario = 'A';

    // Crossfade
    this.crossfadeProgress = 0; // 0 = A, 1 = B
    this.crossfading = false;
    this.crossfadeSpeed = 1.5; // segundos

    // UI
    this.enabled = false;
    this.panel = null;
    this.overlay = null;

    // Render targets para split view
    this.rtA = null;
    this.rtB = null;
    this.cameraA = null;
    this.cameraB = null;

    // Clones de escena
    this.sceneA = null;
    this.sceneB = null;

    // Renderer temporal para split
    this.rendererA = null;
    this.rendererB = null;
  }

  // ── Inicialización ────────────────────────────────────────────────

  enable() {
    this.enabled = true;
    this._createSplitRenderers();
    this._createUI();
    console.log('🔀 Comparador activado');
  }

  disable() {
    this.enabled = false;
    this._removeSplitRenderers();
    this._removeUI();
    this.mode = 'toggle';
    console.log('🔀 Comparador desactivado');
  }

  // ── Render targets para split view ────────────────────────────────

  _createSplitRenderers() {
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;

    this.rtA = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    this.rtB = this.rtA.clone();

    // Cámaras duplicadas para split view
    this.cameraA = this.camera.clone();
    this.cameraB = this.camera.clone();
    this.cameraA.aspect = 0.5 * (this.camera.aspect);
    this.cameraB.aspect = 0.5 * (this.camera.aspect);
    this.cameraA.updateProjectionMatrix();
    this.cameraB.updateProjectionMatrix();

    // Renderizadores temporales
    this.rendererA = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.rendererA.setSize(w, h);
    this.rendererA.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.rendererA.domElement.style.position = 'fixed';
    this.rendererA.domElement.style.inset = '0';
    this.rendererA.domElement.style.zIndex = '5';
    this.rendererA.domElement.style.pointerEvents = 'none';
    document.body.appendChild(this.rendererA.domElement);

    this.rendererB = this.rendererA.clone();
    this.rendererB.domElement.style.display = 'none';
    document.body.appendChild(this.rendererB.domElement);
  }

  _removeSplitRenderers() {
    if (this.rendererA) {
      this.rendererA.domElement.remove();
      this.rendererA.dispose();
      this.rendererA = null;
    }
    if (this.rendererB) {
      this.rendererB.domElement.remove();
      this.rendererB.dispose();
      this.rendererB = null;
    }
    if (this.rtA) { this.rtA.dispose(); this.rtA = null; }
    if (this.rtB) { this.rtB.dispose(); this.rtB = null; }
    this.cameraA = null;
    this.cameraB = null;
  }

  // ── UI del comparador ─────────────────────────────────────────────

  _createUI() {
    // Overlay de modo
    this.overlay = document.createElement('div');
    this.overlay.id = 'comparador-overlay';
    this.overlay.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      z-index: 50; display: flex; gap: 6px; align-items: center;
      background: rgba(8, 16, 30, 0.85); backdrop-filter: blur(16px);
      border: 1px solid rgba(96, 165, 250, 0.15);
      border-radius: 12px; padding: 8px 16px;
      color: #c8d8e8; font-size: 12px; font-family: 'Segoe UI', system-ui, sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    `;

    // Botón modo
    const modeBtn = document.createElement('button');
    modeBtn.id = 'comparador-mode-btn';
    modeBtn.textContent = '🔀 Split';
    modeBtn.style.cssText = `
      background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96,165,250,0.2);
      color: #60a5fa; padding: 6px 12px; border-radius: 8px; cursor: pointer;
      font-size: 11px; font-weight: 600; transition: all 0.2s;
    `;
    modeBtn.addEventListener('click', () => {
      const modes = ['split', 'crossfade', 'toggle'];
      const idx = (modes.indexOf(this.mode) + 1) % modes.length;
      this.mode = modes[idx];
      modeBtn.textContent = `🔀 ${this.mode === 'split' ? 'Split' : this.mode === 'crossfade' ? 'Fundido' : 'Toggle'}`;
      this._updateSplitVisibility();
    });
    modeBtn.addEventListener('mouseenter', () => modeBtn.style.background = 'rgba(96,165,250,0.2)');
    modeBtn.addEventListener('mouseleave', () => modeBtn.style.background = 'rgba(96,165,250,0.1)');

    // Separador
    const sep = document.createElement('span');
    sep.textContent = '│';
    sep.style.cssText = 'color: #3a5a7a; margin: 0 4px;';

    // Escenario A
    this.selA = this._createScenarioSelect('A');
    // Separador
    const sep2 = document.createElement('span');
    sep2.textContent = ' vs ';
    sep2.style.cssText = 'color: #4a6a8a; font-weight: 600;';
    // Escenario B
    this.selB = this._createScenarioSelect('B');

    // Botón cerrar
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: none; color: #4a6a8a; cursor: pointer;
      font-size: 14px; padding: 4px 8px; border-radius: 6px; transition: color 0.2s;
    `;
    closeBtn.addEventListener('click', () => this.disable());
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#f87171');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#4a6a8a');

    this.overlay.appendChild(modeBtn);
    this.overlay.appendChild(sep);
    this.overlay.appendChild(this.selA);
    this.overlay.appendChild(sep2);
    this.overlay.appendChild(this.selB);
    this.overlay.appendChild(closeBtn);
    document.body.appendChild(this.overlay);

    // Línea divisoria para split view
    this.splitLine = document.createElement('div');
    this.splitLine.id = 'comparador-split-line';
    this.splitLine.style.cssText = `
      position: fixed; top: 0; bottom: 0; left: 50%; width: 2px;
      z-index: 40; background: linear-gradient(180deg,
        rgba(96,165,250,0.3), rgba(96,165,250,0.6), rgba(96,165,250,0.3));
      cursor: ew-resize; display: none;
    `;
    this._setupSplitDrag();
    document.body.appendChild(this.splitLine);

    // Etiquetas A / B
    this.labelA = this._createLabel('A');
    this.labelB = this._createLabel('B');
    document.body.appendChild(this.labelA);
    document.body.appendChild(this.labelB);

    // Slider de crossfade
    this.crossfadeSlider = document.createElement('input');
    this.crossfadeSlider.type = 'range';
    this.crossfadeSlider.min = '0';
    this.crossfadeSlider.max = '100';
    this.crossfadeSlider.value = '0';
    this.crossfadeSlider.style.cssText = `
      position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%);
      z-index: 50; width: 200px; display: none;
      -webkit-appearance: none; height: 4px;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      border-radius: 2px; outline: none;
    `;
    this.crossfadeSlider.addEventListener('input', (e) => {
      this.crossfadeProgress = parseInt(e.target.value) / 100;
    });
    document.body.appendChild(this.crossfadeSlider);

    // Etiqueta de escenario activo
    this.activeLabel = document.createElement('div');
    this.activeLabel.style.cssText = `
      position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
      z-index: 50; font-size: 11px; color: #4a6a8a;
      background: rgba(8,16,30,0.6); padding: 4px 12px; border-radius: 8px;
      display: none;
    `;
    document.body.appendChild(this.activeLabel);
  }

  _createScenarioSelect(label) {
    const sel = document.createElement('select');
    sel.id = `comparador-sel-${label}`;
    sel.style.cssText = `
      padding: 5px 8px; background: rgba(96,165,250,0.08);
      border: 1px solid rgba(96,165,250,0.15); border-radius: 6px;
      color: #c8d8e8; font-size: 11px; outline: none; cursor: pointer;
    `;
    sel.addEventListener('change', async (e) => {
      const id = e.target.value;
      if (id) {
        if (label === 'A') {
          this.scenarioA = id;
        } else {
          this.scenarioB = id;
        }
        await this._loadBoth();
      }
    });
    return sel;
  }

  _createLabel(label) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 50%; transform: translateY(-50%);
      z-index: 45; font-size: 24px; font-weight: 700;
      color: rgba(96,165,250,0.15); pointer-events: none;
      display: none;
    `;
    el.textContent = label;
    return el;
  }

  _setupSplitDrag() {
    let dragging = false;
    this.splitLine.addEventListener('mousedown', () => { dragging = true; });
    document.addEventListener('mouseup', () => { dragging = false; });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width);
      this.splitRatio = Math.max(0.15, Math.min(0.85, x));
      this.splitLine.style.left = `${this.splitRatio * 100}%`;
    });
  }

  _updateSplitVisibility() {
    const show = this.mode === 'split';
    this.splitLine.style.display = show ? 'block' : 'none';
    this.labelA.style.display = show ? 'block' : 'none';
    this.labelB.style.display = show ? 'block' : 'none';
    this.crossfadeSlider.style.display = this.mode === 'crossfade' ? 'block' : 'none';

    if (show) {
      this.labelA.style.left = '12px';
      this.labelB.style.left = `${this.splitRatio * 100}%`;
      this.splitLine.style.left = `${this.splitRatio * 100}%`;
    }
  }

  _removeUI() {
    if (this.overlay) this.overlay.remove();
    if (this.splitLine) this.splitLine.remove();
    if (this.labelA) this.labelA.remove();
    if (this.labelB) this.labelB.remove();
    if (this.crossfadeSlider) this.crossfadeSlider.remove();
    if (this.activeLabel) this.activeLabel.remove();
    this.overlay = null;
    this.splitLine = null;
    this.labelA = null;
    this.labelB = null;
    this.crossfadeSlider = null;
    this.activeLabel = null;
  }

  // ── Carga de escenarios ───────────────────────────────────────────

  async _loadBoth() {
    if (!this.scenarioA || !this.scenarioB) return;

    // Cargar ambos escenarios en paralelo
    const [scA, scB] = await Promise.all([
      this.selectScenario(this.scenarioA),
      this.selectScenario(this.scenarioB),
    ]);

    // En modo toggle, mostrar A
    if (this.mode === 'toggle') {
      this.activeScenario = 'A';
      this.activeLabel.textContent = `Escenario A: ${this.scenarioA}`;
      this.activeLabel.style.display = 'block';
      setTimeout(() => { this.activeLabel.style.display = 'none'; }, 2000);
    }
  }

  // ── Selección de escenarios ───────────────────────────────────────

  async selectA(id) {
    this.scenarioA = id;
    await this.selectScenario(id);
    if (this.selA) this.selA.value = id;
  }

  async selectB(id) {
    this.scenarioB = id;
    if (this.selB) this.selB.value = id;
    if (this.mode !== 'toggle') {
      await this._loadBoth();
    }
  }

  // ── Toggle entre escenarios ───────────────────────────────────────

  toggle() {
    if (this.mode !== 'toggle') return;
    this.activeScenario = this.activeScenario === 'A' ? 'B' : 'A';

    // Cargar el escenario activo
    const id = this.activeScenario === 'A' ? this.scenarioA : this.scenarioB;
    if (id) {
      this.selectScenario(id);
      this.activeLabel.textContent = `Escenario ${this.activeScenario}: ${id}`;
      this.activeLabel.style.display = 'block';
      setTimeout(() => { this.activeLabel.style.display = 'none'; }, 1500);
    }
  }

  // ── Render loop ───────────────────────────────────────────────────

  render(time) {
    if (!this.enabled) return;

    if (this.mode === 'split') {
      this._renderSplit(time);
    } else if (this.mode === 'crossfade') {
      this._renderCrossfade(time);
    }
    // toggle: nada especial, se maneja con toggle()
  }

  _renderSplit(time) {
    if (!this.rendererA || !this.rtA || !this.rtB) return;

    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    const ratio = this.splitRatio;

    // Renderizar lado A
    this.rendererA.setSize(w, h);
    this.rendererA.setRenderTarget(this.rtA);
    this.rendererA.clear();

    // Renderizar lado B
    this.rendererA.setRenderTarget(this.rtB);
    this.rendererA.clear();

    // Renderizar al canvas principal con composición split
    this.rendererA.setRenderTarget(null);
    this.rendererA.clear();

    // Dibujar panel A (izquierda)
    this.rendererA.render(this.scene, this.camera);

    // Dibujar panel B (derecha) — necesitamos renderizar B por separado
    // Como solo tenemos un renderer, usamos el material del RT como textura
    const splitShader = new THREE.ShaderMaterial({
      uniforms: {
        textureA: { value: this.rtA.texture },
        textureB: { value: this.rtB.texture },
        splitPos: { value: ratio },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D textureA;
        uniform sampler2D textureB;
        uniform float splitPos;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          uv.x = mix(uv.x / splitPos, (uv.x - splitPos) / (1.0 - splitPos),
            step(splitPos, uv.x));
          gl_FragColor = texture2D(textureA, uv);
        }
      `,
    });

    const splitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      splitShader
    );
    this.rendererA.add(splitMesh);
    this.rendererA.render(this.rendererA.scene || new THREE.Scene(), this.camera);
    this.rendererA.remove(splitMesh);

    // Línea divisoria
    this.splitLine.style.left = `${ratio * 100}%`;
  }

  _renderCrossfade(time) {
    // Crossfade: interpolación suave entre escenarios
    if (this.crossfading) {
      this.crossfadeProgress += (1 / 60) * this.crossfadeSpeed;
      if (this.crossfadeProgress >= 1) {
        this.crossfadeProgress = 1;
        this.crossfading = false;
        this.activeScenario = 'B';
      }
      this.crossfadeSlider.value = Math.round(this.crossfadeProgress * 100);
    }

    // Actualizar slider manualmente
    if (!this.crossfading) {
      this.crossfadeProgress = parseInt(this.crossfadeSlider.value) / 100;
    }
  }

  // ── Métodos públicos ──────────────────────────────────────────────

  setMode(mode) {
    this.mode = mode;
    this._updateSplitVisibility();
  }

  getMode() {
    return this.mode;
  }

  dispose() {
    this.disable();
  }
}
