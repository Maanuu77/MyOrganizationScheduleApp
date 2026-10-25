// Genera los iconos PNG de la PWA (192, 512 y maskable) a partir del diseño del logotipo.
// No usa librerías externas: dibuja píxel a píxel y codifica el PNG con zlib.
// Uso: node scripts/generar-iconos.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const C1 = [0x6d, 0x5c, 0xf0];
const C2 = [0xff, 0x6b, 0x4a];

// Devuelve el color [r,g,b,a] de un punto (x,y) en coordenadas 0..512 del logotipo.
function colorLogo(x, y, maskable) {
  const radioEsquina = maskable ? 0 : 116;
  // ¿Está dentro del cuadrado redondeado?
  const cx = Math.min(Math.max(x, radioEsquina), 512 - radioEsquina);
  const cy = Math.min(Math.max(y, radioEsquina), 512 - radioEsquina);
  if (radioEsquina > 0 && Math.hypot(x - cx, y - cy) > radioEsquina) return [0, 0, 0, 0];
  if (x < 0 || y < 0 || x > 512 || y > 512) return [0, 0, 0, 0];
  const t = (x + y) / 1024;
  const fondo = [0, 1, 2].map((i) => C1[i] + (C2[i] - C1[i]) * t);
  // En el icono maskable el dibujo se reduce al 76 % para respetar la zona segura.
  const escala = maskable ? 0.76 : 1;
  const lx = (x - 256) / escala + 256;
  const ly = (y - 256) / escala + 256;
  const d = Math.hypot(lx - 256, ly - 256);
  if (d <= 40) return [255, 255, 255, 255];
  // Ángulo desde arriba en sentido horario (0..360)
  let angulo = (Math.atan2(lx - 256, -(ly - 256)) * 180) / Math.PI;
  if (angulo < 0) angulo += 360;
  const enAnillo = Math.abs(d - 150) <= 22 && angulo <= 270;
  const extremos = [
    [256, 106],
    [106, 256],
  ];
  const enExtremo = extremos.some(([ex, ey]) => Math.hypot(lx - ex, ly - ey) <= 22);
  if (enAnillo || enExtremo) return [255, 255, 255, 255];
  return [...fondo, 255];
}

function crc32(buf) {
  let c;
  const tabla = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = tabla[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function bloque(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function generar(tamano, maskable, ruta, redondo = false) {
  const muestras = 4; // supermuestreo para suavizar bordes
  const filas = [];
  for (let py = 0; py < tamano; py++) {
    const fila = Buffer.alloc(1 + tamano * 4);
    for (let px = 0; px < tamano; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < muestras; sy++) {
        for (let sx = 0; sx < muestras; sx++) {
          const x = ((px + (sx + 0.5) / muestras) / tamano) * 512;
          const y = ((py + (sy + 0.5) / muestras) / tamano) * 512;
          // En la versión redonda recortamos el cuadrado en un círculo
          const fuera = redondo && Math.hypot(x - 256, y - 256) > 256;
          const [r, g, b, a] = fuera ? [0, 0, 0, 0] : colorLogo(x, y, maskable);
          acc[0] += r * a;
          acc[1] += g * a;
          acc[2] += b * a;
          acc[3] += a;
        }
      }
      const n = muestras * muestras;
      const alfa = acc[3] / n;
      const o = 1 + px * 4;
      fila[o] = alfa ? acc[0] / acc[3] : 0;
      fila[o + 1] = alfa ? acc[1] / acc[3] : 0;
      fila[o + 2] = alfa ? acc[2] / acc[3] : 0;
      fila[o + 3] = alfa;
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamano, 0);
  ihdr.writeUInt32BE(tamano, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(Buffer.concat(filas))),
    bloque('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(ruta, png);
  console.log('Generado', ruta);
}

// Iconos de la app Android para versiones sin icono adaptativo (Android 7)
const DENSIDADES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [densidad, tamano] of Object.entries(DENSIDADES)) {
  const carpeta = `android/app/src/main/res/mipmap-${densidad}`;
  generar(tamano, false, `${carpeta}/ic_launcher.png`);
  generar(tamano, false, `${carpeta}/ic_launcher_round.png`, true);
}

generar(192, false, 'public/iconos/icono-192.png');
generar(512, false, 'public/iconos/icono-512.png');
generar(512, true, 'public/iconos/icono-maskable-512.png');
generar(180, true, 'public/iconos/apple-touch-icon.png');
