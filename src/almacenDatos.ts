// Almacén (Zustand) con los datos del usuario tal y como llegan de Firestore en tiempo real.
// Firestore es la fuente de verdad: este almacén solo es una copia en memoria para pintar rápido.

import { create } from 'zustand';
import type {
  Ajustes,
  Dispositivo,
  EjecucionRutina,
  Etiqueta,
  EstadoContador,
  Evento,
  ExcepcionEvento,
  IntegracionGoogle,
  PlantillaCiclo,
  PlantillaSemanal,
  RegistroSesion,
  Rutina,
  Tarea,
} from './tipos';
import { ajustesPorDefecto } from './ajustesPorDefecto';
import { zonaDelDispositivo } from './fechas';

export interface Usuario {
  uid: string;
  email: string | null;
  nombre: string | null;
  foto: string | null;
}

export interface EstadoDatos {
  usuario: Usuario | null;
  cargandoSesion: boolean;
  /** true cuando han llegado los ajustes y las colecciones principales. */
  datosListos: boolean;
  ajustesCargados: boolean;
  /** Si el documento de ajustes ya existe en Firestore. */
  ajustesExisten: boolean;
  ajustes: Ajustes;
  etiquetas: Etiqueta[];
  eventos: Evento[];
  excepciones: ExcepcionEvento[];
  tareas: Tarea[];
  ciclos: PlantillaCiclo[];
  registros: RegistroSesion[];
  rutinas: Rutina[];
  ejecuciones: EjecucionRutina[];
  plantillas: PlantillaSemanal[];
  dispositivos: Dispositivo[];
  integracionGoogle: IntegracionGoogle | null;
  contador: EstadoContador | null;
  /** Error de permisos u otro problema al escuchar Firestore. */
  errorSincronizacion: string | null;
  poner: (parcial: Partial<EstadoDatos>) => void;
  reiniciar: () => void;
}

/** Tema guardado localmente para pintar bien antes de que lleguen los ajustes reales. */
function temaLocal(): Partial<Ajustes> {
  try {
    return JSON.parse(localStorage.getItem('mos-tema') ?? '{}') as Partial<Ajustes>;
  } catch {
    return {};
  }
}

const vacio = () => ({
  datosListos: false,
  ajustesCargados: false,
  ajustesExisten: false,
  ajustes: { ...ajustesPorDefecto(zonaDelDispositivo()), ...temaLocal() },
  etiquetas: [],
  eventos: [],
  excepciones: [],
  tareas: [],
  ciclos: [],
  registros: [],
  rutinas: [],
  ejecuciones: [],
  plantillas: [],
  dispositivos: [],
  integracionGoogle: null,
  contador: null,
  errorSincronizacion: null,
});

export const useDatos = create<EstadoDatos>((set) => ({
  usuario: null,
  cargandoSesion: true,
  ...vacio(),
  poner: (parcial) => set(parcial),
  reiniciar: () => set(vacio()),
}));

/** Etiquetas no archivadas, ordenadas. */
export function etiquetasActivas(lista: Etiqueta[]): Etiqueta[] {
  return lista
    .filter((e) => !e.archivada)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
}

/** Busca una etiqueta por id (o null). */
export function buscarEtiqueta(lista: Etiqueta[], id: string | null | undefined): Etiqueta | null {
  if (!id) return null;
  return lista.find((e) => e.id === id) ?? null;
}
