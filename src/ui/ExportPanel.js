/**
 * ExportPanel — Exportar vista y compartir URL
 *
 * Botón "Exportar vista" que captura la escena Three.js y descarga PNG.
 * Incluye watermark "WaveThree — Hecho con ❤️ por David Antizar".
 * Botón "Compartir" que copia URL con estado actual (query params).
 *
 * Uso:
 *   import { ExportPanel } from './ExportPanel.js';
 *   const panel = new ExportPanel({ renderer, getState, scenarioMeta });
 *   panel.mount();
 */

export class ExportPanel {
  /**
   * @param {object} opts
   * @param {THREE.WebGLRenderer} opts.renderer — Renderizador Three.js
   * @param {Function} opts.getState — Devuelve el estado actual del visor
   * @param {object} [opts.scenarioMeta] — Metadatos del escenario actual
   * @param {string} [opts.baseURL] — URL base para compartir (default: window.location.origin)
   */
  constructor({ renderer, getState, scenarioMeta, baseURL }) {
    this.renderer = renderer;
    this.getState = getState;
    this.scenarioMeta = scenarioMeta;
    this.baseURL = baseURL || window.location.origin;

    this.active = false;
    this.button = null;
    this.menu = null;
  }

  // ── Montar en el DOM ──────────────────────────────────────────────

  mount() {
    if (this.active) return;

    // Botón flotante de exportar
    this.button = document.createElement('button');
    this.button.id = 'export-btn';
    this.button.innerHTML = '📷 Exportar';
    this.button.style.cssText = `
      position: fixed; bottom: 24px; right: 160px; z-index: 10;
      background: rgba(8, 16, 30, 0.7); backdrop-filter: blur(8px);
      border: 1px solid rgba(96, 165, 250, 0.15);
      border-radius: 10px; padding: 10px 16px;
      color: #7a9aba; cursor: pointer;
      font-size: 12px; transition: all 0.2s;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    this.button.addEventListener('mouseenter', () => {
      this.button.style.background = 'rgba(96,165,250,0.15)';
      this.button.style.color = '#60a5fa';
    });
    this.button.addEventListener('mouseleave', () => {
      this.button.style.background = 'rgba(8,16,30,0.7)';
      this.button.style.color = '#7a9aba';
    });
    this.button.addEventListener('click', () => this._toggleMenu());
    document.body.appendChild(this.button);

    // Menú desplegable
    this.menu = document.createElement('div');
    this.menu.id = 'export-menu';
    this.menu.style.cssText = `
      position: fixed; bottom: 72px; right: 160px; z-index: 11;
      background: rgba(8, 16, 30, 0.9); backdrop-filter: blur(16px);
      border: 1px solid rgba(96, 165, 250, 0.15);
      border-radius: 12px; padding: 12px;
      color: #c8d8e8; font-size: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      display: none; min-width: 200px;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    // Opción: Exportar PNG
    const exportBtn = this._createMenuItem('📸 Capturar PNG', () => this._exportPNG());
    // Opción: Compartir URL
    const shareBtn = this._createMenuItem('🔗 Compartir vista', () => this._shareURL());

    this.menu.appendChild(exportBtn);
    this.menu.appendChild(shareBtn);
    document.body.appendChild(this.menu);

    // Cerrar al hacer click fuera
    document.addEventListener('click', (e) => {
      if (this.menu && this.menu.style.display === 'block' &&
          !this.menu.contains(e.target) && !this.button.contains(e.target)) {
        this.menu.style.display = 'none';
      }
    });

    this.active = true;
    console.log('📷 ExportPanel activado');
  }

  unmount() {
    if (this.button) this.button.remove();
    if (this.menu) this.menu.remove();
    this.active = false;
  }

  _createMenuItem(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      width: 100%; padding: 8px 12px;
      background: rgba(96,165,250,0.06);
      border: 1px solid rgba(96,165,250,0.1);
      border-radius: 8px; color: #c8d8e8;
      font-size: 12px; cursor: pointer;
      text-align: left; transition: all 0.15s;
      margin-bottom: 6px;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(96,165,250,0.15)';
      btn.style.borderColor = 'rgba(96,165,250,0.25)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(96,165,250,0.06)';
      btn.style.borderColor = 'rgba(96,165,250,0.1)';
    });
    btn.addEventListener('click', () => {
      onClick();
      this.menu.style.display = 'none';
    });
    return btn;
  }

  _toggleMenu() {
    if (this.menu.style.display === 'block') {
      this.menu.style.display = 'none';
    } else {
      this.menu.style.display = 'block';
    }
  }

  // ── Exportar PNG ──────────────────────────────────────────────────

  _exportPNG() {
    const canvas = this.renderer.domElement;
    const renderer = this.renderer;

    // Capturar frame actual
    renderer.render(renderer.scene, renderer.camera);

    // Crear canvas con watermark
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    const padding = 40;
    const watermarkHeight = 50;
    const totalHeight = canvas.height + watermarkHeight + padding * 2;
    const totalWidth = canvas.width + padding * 2;

    exportCanvas.width = totalWidth;
    exportCanvas.height = totalHeight;

    // Fondo
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Imagen capturada
    ctx.drawImage(canvas, padding, padding);

    // Watermark
    ctx.fillStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'WaveThree — Hecho con ❤️ por David Antizar',
      totalWidth / 2,
      totalHeight - 15
    );

    // Metadata del escenario
    if (this.scenarioMeta) {
      const meta = this.scenarioMeta;
      ctx.fillStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      const dateStr = new Date(meta.time || Date.now()).toLocaleString('es-ES');
      ctx.fillText(
        `${meta.location || 'Escenario'} · ${dateStr} · Hs: ${meta.wave?.hs || '?'}m · Tp: ${meta.wave?.tp || '?'}s`,
        padding + 10,
        totalHeight - 15
      );
    }

    // Descargar
    const link = document.createElement('a');
    link.download = `wavethree-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();

    console.log('📸 PNG exportado');
  }

  // ── Compartir URL ─────────────────────────────────────────────────

  _shareURL() {
    const state = this.getState();
    const params = new URLSearchParams();

    if (state.scenarioId) params.set('scenario', state.scenarioId);
    if (state.params) {
      if (state.params.amplitude) params.set('hs', state.params.amplitude);
      if (state.params.frequency) params.set('tp', (1 / state.params.frequency).toFixed(1));
      if (state.params.direction) params.set('dir', state.params.direction);
      if (state.params.windSpeed) params.set('wind', state.params.windSpeed);
    }
    if (state.oceanMode) params.set('mode', state.oceanMode);

    const url = `${this.baseURL}${window.location.pathname}?${params.toString()}`;

    // Copiar al portapapeles
    navigator.clipboard.writeText(url).then(() => {
      this._showToast('✅ URL copiada al portapapeles');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this._showToast('✅ URL copiada al portapapeles');
    });
  }

  _showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 120px; right: 160px; z-index: 100;
      background: rgba(8, 16, 30, 0.9); backdrop-filter: blur(16px);
      border: 1px solid rgba(96, 165, 250, 0.2);
      border-radius: 10px; padding: 10px 16px;
      color: #60a5fa; font-size: 12px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      animation: fadeInOut 2s ease forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2100);
  }

  // ── Actualizar metadatos ───────────────────────────────────────────

  updateScenarioMeta(meta) {
    this.scenarioMeta = meta;
  }
}
