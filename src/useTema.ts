// Aplica el tema (claro/oscuro/sistema), el color de acento y la densidad al documento.
// Guarda una copia en localStorage SOLO para pintar el color correcto antes de que
// lleguen los ajustes de Firestore (evita el parpadeo blanco al abrir en modo oscuro).

import { useEffect } from 'react';
import { esNativo, estiloBarras } from './nativo';
import { useDatos } from './almacenDatos';
import { guardarLocal } from './almacenUI';
import { usePrefiereOscuro } from './useMedia';

export function useTema(): void {
  const { tema, colorAcento, densidad } = useDatos((s) => s.ajustes);
  const cargados = useDatos((s) => s.ajustesCargados);
  const sistemaOscuro = usePrefiereOscuro();

  useEffect(() => {
    const oscuro = tema === 'oscuro' || (tema === 'sistema' && sistemaOscuro);
    const raiz = document.documentElement;
    raiz.dataset.tema = oscuro ? 'oscuro' : 'claro';
    // En la app Android: iconos de la barra de estado claros u oscuros según el tema
    if (esNativo) estiloBarras(oscuro);
    raiz.dataset.densidad = densidad;
    raiz.style.setProperty('--mos-acento', colorAcento);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', oscuro ? '#0f0e1a' : '#f5f4fb');
    if (cargados) guardarLocal('mos-tema', { tema, colorAcento, densidad });
  }, [tema, colorAcento, densidad, sistemaOscuro, cargados]);
}
