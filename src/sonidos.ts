// Sonidos del contador generados con Web Audio (sin archivos de audio).
// Cada tipo de aviso tiene su propia melodía corta para reconocerlo sin mirar.

import { esNativo, vibrarNativo } from './nativo';

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
    return contexto;
  } catch {
    return null;
  }
}

/** Notas (frecuencia en Hz y duración en s) de cada sonido. */
const MELODIAS = {
  foco: [
    [523.25, 0.12],
    [659.25, 0.12],
    [783.99, 0.22],
  ],
  descanso: [
    [783.99, 0.14],
    [659.25, 0.14],
    [523.25, 0.26],
  ],
  fin: [
    [523.25, 0.12],
    [659.25, 0.12],
    [783.99, 0.12],
    [1046.5, 0.32],
  ],
  aviso: [
    [880, 0.1],
    [880, 0.18],
  ],
} as const;

export type TipoSonido = keyof typeof MELODIAS;

export function reproducir(tipo: TipoSonido, volumen = 0.7): void {
  const ctx = obtenerContexto();
  if (!ctx) return;
  let t = ctx.currentTime + 0.02;
  for (const [frecuencia, duracion] of MELODIAS[tipo]) {
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    ganancia.gain.setValueAtTime(0.0001, t);
    ganancia.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.35 * volumen), t + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(ganancia).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duracion + 0.02);
    t += duracion * 0.9;
  }
}

export function vibrar(patron: number[] = [180, 90, 180]): void {
  // En la app Android usamos la vibración nativa (el navegador del sistema puede ignorar la web)
  if (esNativo) {
    vibrarNativo(patron.reduce((suma, ms) => suma + ms, 0));
    return;
  }
  try {
    navigator.vibrate?.(patron);
  } catch {
    // Algunos navegadores no permiten vibrar: lo ignoramos
  }
}

/** El navegador solo deja sonar audio tras una interacción: "despertamos" el contexto al primer toque. */
export function prepararAudio(): void {
  const desbloquear = () => {
    obtenerContexto();
    window.removeEventListener('pointerdown', desbloquear);
    window.removeEventListener('keydown', desbloquear);
  };
  window.addEventListener('pointerdown', desbloquear);
  window.addEventListener('keydown', desbloquear);
}
