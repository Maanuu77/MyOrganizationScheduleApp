// Descarga de archivos generados en el navegador (CSV y JSON).
import { compartirArchivo, esNativo } from './nativo';

export function descargar(nombre: string, contenido: string, tipo: string): void {
  // En el móvil se guarda el archivo y se abre el menú de compartir (Drive, correo, WhatsApp…)
  if (esNativo) {
    void compartirArchivo(nombre, contenido).catch((e) => console.warn('No se pudo compartir', e));
    return;
  }
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
