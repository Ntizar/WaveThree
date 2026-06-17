/**
 * FFT 2D en CPU — Butterfly radix-2 (Cooley-Tukey)
 *
 * Datos complejos representados como Float32Array con valores
 * real e imag alternados: [r0, i0, r1, i1, r2, i2, ...]
 *
 * Referencia: Cooley & Tukey (1965), "An algorithm for the
 * machine calculation of complex Fourier series"
 */

// ── Constantes ────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;

// ── FFT 1D (radix-2 butterfly, in-place) ─────────────────────────────

/**
 * FFT 1D in-place sobre un Float32Array entrelazado (real, imag).
 * N debe ser potencia de 2.
 *
 * @param {Float32Array} data - [r0, i0, r1, i1, ...]
 * @param {number} N - longitud (potencia de 2)
 * @param {boolean} inverse - si true, FFT inversa (dividir por N al final)
 */
function fft1d(data, N, inverse = false) {
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      // swap i, j
      const tmpR = data[i * 2];
      const tmpI = data[i * 2 + 1];
      data[i * 2] = data[j * 2];
      data[i * 2 + 1] = data[j * 2 + 1];
      data[j * 2] = tmpR;
      data[j * 2 + 1] = tmpI;
    }
    let k = N >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly stages
  let size = 2;
  while (size <= N) {
    const halfSize = size >> 1;
    const angleStep = TWO_PI / size;
    const sign = inverse ? 1 : -1;

    for (let k = 0; k < N; k += size) {
      for (let w = 0; w < halfSize; w++) {
        const angle = angleStep * w * sign;
        const wReal = Math.cos(angle);
        const wImag = Math.sin(angle);

        const evenR = data[(k + w) * 2];
        const evenI = data[(k + w) * 2 + 1];
        const oddR = data[(k + w + halfSize) * 2];
        const oddI = data[(k + w + halfSize) * 2 + 1];

        // Twiddle factor multiplication: (wReal + i*wImag) * (oddR + i*oddI)
        const tReal = wReal * oddR - wImag * oddI;
        const tImag = wReal * oddI + wImag * oddR;

        data[(k + w) * 2] = evenR + tReal;
        data[(k + w) * 2 + 1] = evenI + tImag;
        data[(k + w + halfSize) * 2] = evenR - tReal;
        data[(k + w + halfSize) * 2 + 1] = evenI - tImag;
      }
    }
    size <<= 1;
  }

  // Inverse: divide by N
  if (inverse) {
    const invN = 1 / N;
    for (let i = 0; i < N * 2; i += 2) {
      data[i] *= invN;
      data[i + 1] *= invN;
    }
  }
}

// ── FFT 2D (filas + columnas) ────────────────────────────────────────

/**
 * FFT 2D in-place.
 *
 * Algoritmo: FFT 1D sobre cada fila, luego FFT 1D sobre cada columna.
 *
 * @param {Float32Array} data - [r0, i0, r1, i1, ...] (N×N entrelazado)
 * @param {number} N - dimensión (potencia de 2)
 * @param {boolean} inverse - si true, FFT inversa
 */
export function fft2d(data, N, inverse = false) {
  // Paso 1: FFT en filas
  for (let row = 0; row < N; row++) {
    const offset = row * N;
    const rowData = new Float32Array(N * 2);
    for (let col = 0; col < N; col++) {
      rowData[col * 2] = data[offset + col * 2];
      rowData[col * 2 + 1] = data[offset + col * 2 + 1];
    }
    fft1d(rowData, N, inverse);
    for (let col = 0; col < N; col++) {
      data[offset + col * 2] = rowData[col * 2];
      data[offset + col * 2 + 1] = rowData[col * 2 + 1];
    }
  }

  // Paso 2: FFT en columnas
  for (let col = 0; col < N; col++) {
    const colData = new Float32Array(N * 2);
    for (let row = 0; row < N; row++) {
      const offset = row * N;
      colData[row * 2] = data[offset + col * 2];
      colData[row * 2 + 1] = data[offset + col * 2 + 1];
    }
    fft1d(colData, N, inverse);
    for (let row = 0; row < N; row++) {
      const offset = row * N;
      data[offset + col * 2] = colData[row * 2];
      data[offset + col * 2 + 1] = colData[row * 2 + 1];
    }
  }
}

// ── FFT Shift ────────────────────────────────────────────────────────

/**
 * Desplaza el DC (componente de frecuencia cero) al centro de la imagen.
 * Útil para visualización del espectro.
 *
 * Operación in-place.
 *
 * @param {Float32Array} data - datos complejos entrelazados
 * @param {number} N - dimensión
 */
export function fftShift(data, N) {
  const halfN = N >> 1;
  const shifted = new Float32Array(data.length);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      // Mapeo: cuadrante (i,j) → (i+halfN, j+halfN) módulo N
      const si = (i + halfN) % N;
      const sj = (j + halfN) % N;

      const srcOff = (i * N + j) * 2;
      const dstOff = (si * N + sj) * 2;

      shifted[dstOff] = data[srcOff];
      shifted[dstOff + 1] = data[srcOff + 1];
    }
  }

  // Copiar de vuelta
  for (let i = 0; i < data.length; i++) {
    data[i] = shifted[i];
  }
}

// ── IFFT Shift (inverso de fftShift) ──────────────────────────────────

/**
 * Invierte un fftShift: devuelve el DC a la esquina superior izquierda.
 *
 * @param {Float32Array} data - datos complejos entrelazados
 * @param {number} N - dimensión
 */
export function ifftShift(data, N) {
  // fftShift es auto-inverso: aplicarlo dos veces = identidad
  fftShift(data, N);
}
