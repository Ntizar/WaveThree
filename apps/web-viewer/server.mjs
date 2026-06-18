/**
 * WaveThree — Servidor de producción para NaN.builders
 * Sirve el build de Vite (dist/) en el puerto que indique NaN
 */

import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3500;
const DIST = path.join(__dirname, 'dist');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bin': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.hdr': 'image/vnd.radiance',
};

function serve(req, res) {
  let url = decodeURIComponent(req.url);
  if (url === '/') url = '/index.html';
  
  const filePath = path.join(DIST, url);
  
  // SPA: si no existe archivo, servir index.html para rutas del visor
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const idx = path.join(DIST, 'index.html');
    if (fs.existsSync(idx)) {
      const content = fs.readFileSync(idx);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(content);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 — No encontrado');
  }
  
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

const server = createServer(serve);
server.listen(PORT, () => {
  console.log(`🌊 WaveThree server corriendo en :${PORT}`);
  console.log(`   Sirviendo ${DIST}`);
});