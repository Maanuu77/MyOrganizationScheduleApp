// Almacén (Zustand) del estado de la interfaz: avisos emergentes, diálogos, vista del calendario…
// Nada de esto se guarda en Firestore. Solo algunas preferencias locales van a localStorage.

import { create } from 'zustand';
import type { Ocurrencia, Tarea, TipoBloque } from './tipos';

export type VistaCalendario = 'dia' | 'semana' | 'mes' | 'agenda';
export type AlcanceCambio = 'solo' | 'siguientes' | 'todos';

export interface Toast {
  id: number;
  texto: string;
  tipo: 'info' | 'exito' | 'error' | 'logro';
  accion?: { texto: string; ejecutar: () => void };
}

export interface PeticionConfirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  peligro?: boolean;
  resolver: (ok: boolean) => void;
}

/** Datos para abrir el editor de bloques. */
export interface BorradorBloque {
  inicioMs: number;
  finMs: number;
  tipo?: TipoBloque;
  etiquetaId?: string | null;
  tareaId?: string | null;
  titulo?: string;
  cicloId?: string | null;
}

export interface EstadoUI {
  toasts: Toast[];
  confirmacion: PeticionConfirmacion | null;
  peticionAlcance: {
    permitirSiguientes: boolean;
    permitirSolo: boolean;
    resolver: (a: AlcanceCambio | null) => void;
  } | null;
  vista: VistaCalendario;
  fechaMs: number;
  panelHoy: boolean;
  hojaHoy: boolean;
  editorBloque: { ocurrencia: Ocurrencia | null; borrador: BorradorBloque | null } | null;
  editorTarea: { tarea: Tarea | null; borrador?: Partial<Tarea> } | null;
  moverA: { ocurrencia: Ocurrencia } | null;
  mostrarAtajos: boolean;
  tokenGoogle: { token: string; expiraMs: number } | null;

  avisar: (texto: string, tipo?: Toast['tipo'], accion?: Toast['accion']) => void;
  quitarToast: (id: number) => void;
  confirmar: (p: Omit<PeticionConfirmacion, 'resolver'>) => Promise<boolean>;
  pedirAlcance: (opciones?: {
    permitirSiguientes?: boolean;
    permitirSolo?: boolean;
  }) => Promise<AlcanceCambio | null>;
  poner: (parcial: Partial<EstadoUI>) => void;
}

/** Lee una preferencia local de interfaz (nunca datos del usuario). */
function leerLocal<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : (JSON.parse(v) as T);
  } catch {
    return porDefecto;
  }
}

export function guardarLocal(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento local (modo privado): no pasa nada, es solo una preferencia
  }
}

let contadorToasts = 0;

export const useUI = create<EstadoUI>((set, get) => ({
  toasts: [],
  confirmacion: null,
  peticionAlcance: null,
  vista: leerLocal<VistaCalendario>('mos-vista', 'semana'),
  fechaMs: Date.now(),
  panelHoy: leerLocal('mos-panel-hoy', true),
  hojaHoy: false,
  editorBloque: null,
  editorTarea: null,
  moverA: null,
  mostrarAtajos: false,
  tokenGoogle: null,

  avisar: (texto, tipo = 'info', accion) => {
    const id = ++contadorToasts;
    set({ toasts: [...get().toasts.slice(-3), { id, texto, tipo, accion }] });
    setTimeout(() => get().quitarToast(id), accion ? 7000 : 4000);
  },
  quitarToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  confirmar: (p) =>
    new Promise<boolean>((resolver) => {
      set({
        confirmacion: {
          ...p,
          resolver: (ok) => {
            set({ confirmacion: null });
            resolver(ok);
          },
        },
      });
    }),

  pedirAlcance: (opciones = {}) =>
    new Promise<AlcanceCambio | null>((resolver) => {
      set({
        peticionAlcance: {
          permitirSiguientes: opciones.permitirSiguientes ?? true,
          permitirSolo: opciones.permitirSolo ?? true,
          resolver: (a) => {
            set({ peticionAlcance: null });
            resolver(a);
          },
        },
      });
    }),

  poner: (parcial) => {
    if (parcial.vista) guardarLocal('mos-vista', parcial.vista);
    if (parcial.panelHoy !== undefined) guardarLocal('mos-panel-hoy', parcial.panelHoy);
    set(parcial);
  },
}));

/** Atajo para mostrar un aviso desde cualquier sitio (también fuera de componentes). */
export const avisar = (...args: Parameters<EstadoUI['avisar']>) => useUI.getState().avisar(...args);
export const confirmar = (p: Omit<PeticionConfirmacion, 'resolver'>) =>
  useUI.getState().confirmar(p);
