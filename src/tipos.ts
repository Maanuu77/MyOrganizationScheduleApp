// Tipos compartidos de todos los documentos de Firestore y de las estructuras internas de la app.
// Todo cuelga de users/{uid}/... (ver firestore.rules).
//
// Convención de fechas:
//  - Los instantes se guardan como milisegundos UTC (campos terminados en "Ms").
//  - Los días "de calendario" (sin hora) se guardan como texto 'YYYY-MM-DD' en la zona del usuario.
//  - Las horas del día sin fecha se guardan como texto 'HH:mm'.
//  - Cada documento con fechas guarda también la zona horaria (`zonaHoraria`) con la que se creó.

import type { Timestamp } from 'firebase/firestore';

/** Campos comunes que tiene cualquier documento de una colección del usuario. */
export interface DocumentoBase {
  id: string;
  creadoEnMs: number;
  actualizadoEnMs: number;
}

// ---------------------------------------------------------------------------
// Ajustes (users/{uid}/settings/general)
// ---------------------------------------------------------------------------

export type Tema = 'claro' | 'oscuro' | 'sistema';
export type Densidad = 'compacta' | 'normal' | 'comoda';
export type PantallaInicio =
  'hoy' | 'semana' | 'calendario' | 'tareas' | 'rutinas' | 'estadisticas';
export type TipoNotificacion =
  | 'inicioBloque'
  | 'faseTemporizador'
  | 'pasoRutina'
  | 'fechaLimite'
  | 'resumenDiario'
  | 'sobrecarga';

export interface Ajustes {
  tema: Tema;
  colorAcento: string;
  densidad: Densidad;
  pantallaInicio: PantallaInicio;
  /** 1 = lunes, 0 = domingo */
  inicioSemana: 0 | 1;
  formato24h: boolean;
  zonaHoraria: string;
  duracionPorDefectoMin: number;
  sueno: { activo: boolean; inicio: string; fin: string };
  umbrales: {
    focoDiarioMaxHoras: number;
    sesionesSeguidasMax: number;
    descansoMinimoMin: number;
    diasAvisoFechaLimite: number;
  };
  temporizador: {
    sonido: boolean;
    vibracion: boolean;
    volumen: number;
    focoContinuoMaxMin: number;
    autoAvanzar: boolean;
  };
  notificaciones: {
    activas: boolean;
    antelacionMin: number;
    tipos: Record<TipoNotificacion, boolean>;
    silencio: { activo: boolean; inicio: string; fin: string };
    resumenDiarioHora: string;
  };
  onboardingCompletado: boolean;
  actualizadoEnMs: number;
}

// ---------------------------------------------------------------------------
// Etiquetas (users/{uid}/tags)
// ---------------------------------------------------------------------------

export interface Etiqueta extends DocumentoBase {
  nombre: string;
  color: string;
  icono: string;
  duracionMin: number;
  objetivoSemanalHoras: number | null;
  archivada: boolean;
  orden: number;
}

// ---------------------------------------------------------------------------
// Recurrencia (compartida por eventos, rutinas y tareas)
// ---------------------------------------------------------------------------

export type FinRecurrencia =
  | { tipo: 'nunca' }
  | { tipo: 'fecha'; hasta: string } // 'YYYY-MM-DD' incluido
  | { tipo: 'veces'; veces: number };

export type ReglaMensual =
  | { modo: 'diasMes'; dias: number[] } // p. ej. [1, 15]
  | { modo: 'ordinal'; ordinal: 1 | 2 | 3 | 4 | -1; diaSemana: number }; // -1 = último

export interface ReglaRecurrencia {
  frecuencia: 'diaria' | 'semanal' | 'mensual';
  /** Cada cuántos días/semanas/meses se repite (1 = siempre). */
  intervalo: number;
  /** Para 'semanal': días de la semana (0 = domingo … 6 = sábado). */
  diasSemana?: number[];
  /** Para 'mensual'. Si falta se usa el mismo día del mes del inicio. */
  mensual?: ReglaMensual;
  fin: FinRecurrencia;
}

// ---------------------------------------------------------------------------
// Eventos del calendario (users/{uid}/events) y excepciones (eventExceptions)
// ---------------------------------------------------------------------------

export type TipoBloque = 'evento' | 'sesion' | 'protegido' | 'rutina';

export interface OrigenGoogle {
  calendarioId: string;
  eventoId: string;
  actualizadoMs: number;
}

export interface Evento extends DocumentoBase {
  tipo: TipoBloque;
  titulo: string;
  inicioMs: number;
  finMs: number;
  todoElDia: boolean;
  zonaHoraria: string;
  etiquetaId: string | null;
  color: string | null;
  notas: string;
  recurrencia: ReglaRecurrencia | null;
  /** Solo para sesiones: plantilla de ciclo asociada. */
  cicloId: string | null;
  /** Tarea vinculada (al arrastrar una tarea al calendario). */
  tareaId: string | null;
  completarTareaAlCompletar: boolean;
  /** Para bloques de tipo rutina. */
  rutinaId: string | null;
  /** Para eventos no recurrentes: si se ha cumplido. */
  completado: boolean;
  /** Si viene de una plantilla semanal, su id (permite deshacer la aplicación). */
  plantillaId: string | null;
  origenGoogle: OrigenGoogle | null;
}

export interface ExcepcionEvento extends DocumentoBase {
  eventoId: string;
  /** Inicio original de la ocurrencia que se modifica o cancela. */
  inicioOriginalMs: number;
  cancelada: boolean;
  completado: boolean;
  cambios: {
    inicioMs?: number;
    finMs?: number;
    titulo?: string;
    notas?: string;
    etiquetaId?: string | null;
  };
}

/** Una aparición concreta de un evento en el calendario (resultado de expandir la recurrencia). */
export interface Ocurrencia {
  clave: string;
  evento: Evento;
  inicioMs: number;
  finMs: number;
  inicioOriginalMs: number;
  titulo: string;
  etiquetaId: string | null;
  notas: string;
  esRecurrente: boolean;
  completado: boolean;
  excepcion: ExcepcionEvento | null;
}

// ---------------------------------------------------------------------------
// Plantilla semanal (users/{uid}/weekTemplates)
// ---------------------------------------------------------------------------

export interface BloquePlantilla {
  id: string;
  diaSemana: number; // 0 = domingo
  horaInicio: string; // 'HH:mm'
  duracionMin: number;
  tipo: TipoBloque;
  titulo: string;
  etiquetaId: string | null;
  cicloId: string | null;
}

export interface PlantillaSemanal extends DocumentoBase {
  nombre: string;
  bloques: BloquePlantilla[];
}

// ---------------------------------------------------------------------------
// Tareas (users/{uid}/tasks)
// ---------------------------------------------------------------------------

export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';

export type Planificacion =
  | { tipo: 'dia'; fecha: string }
  | { tipo: 'semana'; semana: string } // lunes/domingo de inicio de la semana 'YYYY-MM-DD'
  | { tipo: 'sinFecha' };

export interface Subtarea {
  id: string;
  titulo: string;
  hecha: boolean;
}

export interface RepeticionTarea {
  frecuencia: 'diaria' | 'semanal' | 'mensual';
  intervalo: number;
  diasSemana?: number[];
}

export interface Tarea extends DocumentoBase {
  titulo: string;
  etiquetaId: string | null;
  prioridad: Prioridad;
  fechaLimiteMs: number | null;
  planificacion: Planificacion;
  estimacionMin: number | null;
  subtareas: Subtarea[];
  notas: string;
  repeticion: RepeticionTarea | null;
  completada: boolean;
  completadaEnMs: number | null;
  orden: number;
}

// ---------------------------------------------------------------------------
// Ciclos de estudio (users/{uid}/cycleTemplates)
// ---------------------------------------------------------------------------

export type TipoFase = 'foco' | 'descansoCorto' | 'descansoLargo' | 'personalizada';

export interface Fase {
  id: string;
  tipo: TipoFase;
  nombre: string;
  color: string;
  duracionMin: number;
}

export interface PlantillaCiclo extends DocumentoBase {
  nombre: string;
  /** Fases de una vuelta, en orden. */
  fases: Fase[];
  /** Cuántas vueltas se repite la lista de fases. */
  repeticiones: number;
  /** Cada N fases de foco, el descanso corto siguiente se convierte en largo. null = nunca. */
  descansoLargoCada: number | null;
  descansoLargoMin: number;
}

/** Fase ya "desplegada" del ciclo: lo que ejecuta realmente el contador. */
export interface FaseExpandida {
  tipo: TipoFase;
  nombre: string;
  color: string;
  duracionMs: number;
  /** Solo en las rutinas: paso al que corresponde y su etiqueta y tarea (para registrar el tiempo). */
  pasoId?: string;
  etiquetaId?: string | null;
  tareaId?: string | null;
}

// ---------------------------------------------------------------------------
// Contador (users/{uid}/timerState/actual) — documento único sincronizado
// ---------------------------------------------------------------------------

export type EstadoTemporizador = 'inactivo' | 'enCurso' | 'pausado' | 'esperando';

export interface TramoSesion {
  tipo: TipoFase;
  /** Posición de la fase en la lista (para saber a qué paso de una rutina pertenece). */
  indiceFase?: number;
  inicioMs: number;
  finMs: number;
  /** Tiempo real de la fase, sin contar las pausas. */
  duracionMs: number;
}

export interface EstadoContador {
  estado: EstadoTemporizador;
  modo: 'ciclo' | 'cronometro';
  fases: FaseExpandida[];
  indiceFase: number;
  /** Inicio de la fase actual (marca del servidor). */
  inicioFase: Timestamp | null;
  /** Duración de la fase actual (incluye los +5 min añadidos). */
  duracionFaseMs: number;
  /** Tiempo total en pausa dentro de la fase actual. */
  pausaAcumuladaMs: number;
  /** Momento en que se pausó (marca del servidor), si está en pausa. */
  pausadoEn: Timestamp | null;
  etiquetaId: string | null;
  tareaId: string | null;
  eventoId: string | null;
  cicloId: string | null;
  /** Si la sesión la lanzó una rutina de estudio. */
  rutinaId: string | null;
  sesionInicioMs: number | null;
  interrupciones: number;
  /** Tramos ya terminados de la sesión (para el registro final). */
  tramos: TramoSesion[];
  /** Dispositivo que hizo el último cambio. */
  actualizadoPor: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Registros de sesión (users/{uid}/sessionLogs)
// ---------------------------------------------------------------------------

export interface RegistroSesion extends DocumentoBase {
  etiquetaId: string | null;
  tareaId: string | null;
  eventoId: string | null;
  inicioMs: number;
  finMs: number;
  focoRealMs: number;
  descansosMs: number;
  interrupciones: number;
  fasesCompletadas: number;
  nota: string;
  valoracion: number | null;
  modo: 'ciclo' | 'cronometro';
}

// ---------------------------------------------------------------------------
// Rutinas (users/{uid}/routines) y ejecuciones (routineRuns)
// ---------------------------------------------------------------------------

/**
 * Una rutina es una sucesión de pasos con un objetivo (p. ej. «Teoría 50 min → descanso →
 * Psicotécnicos 20 min»). Se ejecuta en el contador como si fuera un ciclo, pero cada fase
 * tiene su nombre, su etiqueta y su tarea.
 */
export interface PasoRutina {
  id: string;
  nombre: string;
  duracionMin: number;
  etiquetaId: string | null;
  tareaId: string | null;
  /** Descanso que va después de este paso (0 = sin descanso). En el último paso no se usa. */
  descansoMin: number;
}

export interface ProgramacionRutina {
  /** Días de la semana en que toca (vacío = solo cuando tú la empieces). */
  diasSemana: number[];
  /** Hora de inicio 'HH:mm' (opcional). */
  hora: string | null;
}

export interface Rutina extends DocumentoBase {
  nombre: string;
  color: string;
  pasos: PasoRutina[];
  /** Descanso que se pone por defecto entre pasos al añadir uno nuevo. */
  descansoPorDefectoMin: number;
  programacion: ProgramacionRutina;
  avisos: { activo: boolean; minutosAntes: number };
  mostrarEnCalendario: boolean;
  /** Evento recurrente que la representa en el calendario (si mostrarEnCalendario). */
  eventoCalendarioId: string | null;
  archivada: boolean;
}

export interface EjecucionRutina extends DocumentoBase {
  rutinaId: string;
  fecha: string; // 'YYYY-MM-DD'
  inicioMs: number;
  finMs: number | null;
  pasosHechos: string[];
  pasosTotales: number;
  completada: boolean;
  /** Paso por el que va el modo guiado y cuándo empezó (para seguir en otro dispositivo). */
  indicePaso: number;
  inicioPasoMs: number | null;
}

// ---------------------------------------------------------------------------
// Recordatorios (users/{uid}/reminders) y dispositivos (devices)
// ---------------------------------------------------------------------------

export interface Recordatorio {
  id: string;
  uid: string;
  tipo: TipoNotificacion;
  refId: string;
  fireAt: number;
  titulo: string;
  cuerpo: string;
  url: string;
  enviado: boolean;
  creadoEnMs: number;
}

export interface Dispositivo {
  id: string;
  token: string | null;
  nombre: string;
  plataforma: string;
  tiposDesactivados: TipoNotificacion[];
  creadoEnMs: number;
  ultimoUsoMs: number;
}

// ---------------------------------------------------------------------------
// Integraciones (users/{uid}/integrations/googleCalendar)
// ---------------------------------------------------------------------------

export interface IntegracionGoogle {
  conectado: boolean;
  email: string | null;
  calendarioImportarId: string | null;
  calendarioExportarId: string | null;
  ultimaSincronizacionMs: number | null;
  actualizadoEnMs: number;
}

// ---------------------------------------------------------------------------
// Avisos de sobrecarga y conflictos (se calculan en el cliente, no se guardan)
// ---------------------------------------------------------------------------

export type TipoAviso =
  'solape' | 'focoExcesivo' | 'sesionesSeguidas' | 'fechaLimiteSinTiempo' | 'sueno';

export interface AvisoCarga {
  id: string;
  tipo: TipoAviso;
  severidad: 'info' | 'aviso' | 'grave';
  titulo: string;
  detalle: string;
  fecha: string; // 'YYYY-MM-DD'
  claves: string[]; // claves de ocurrencias implicadas
  tareaId?: string;
}
