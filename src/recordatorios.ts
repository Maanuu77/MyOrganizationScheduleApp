// Genera la lista de recordatorios (notificaciones futuras) que deberían existir según los datos.
// La app compara esta lista con la colección `reminders` y crea, actualiza o borra lo necesario;
// la Cloud Function programada se encarga de enviarlos cuando llega su `fireAt`.

import { addDays, startOfDay } from 'date-fns';
import type {
  Ajustes,
  AvisoCarga,
  Ocurrencia,
  Recordatorio,
  Rutina,
  Tarea,
  TipoNotificacion,
} from './tipos';
import { MS_HORA, MS_MINUTO, claveDia, conHora, enFranja, formatear } from './fechas';
import { rutinaTocaEnDia } from './rutinas';

/** Días hacia delante para los que se preparan recordatorios. Se regeneran cada vez que se abre la app. */
export const DIAS_VENTANA = 14;
const MAXIMO = 400;

export type RecordatorioNuevo = Omit<Recordatorio, 'creadoEnMs'>;

interface Entrada {
  uid: string;
  ajustes: Pick<Ajustes, 'notificaciones' | 'formato24h'>;
  ocurrencias: Ocurrencia[];
  tareas: Tarea[];
  rutinas: Rutina[];
  avisos: AvisoCarga[];
  ahoraMs: number;
}

/** Id de documento estable: así regenerar no crea duplicados. */
export function idRecordatorio(tipo: TipoNotificacion, refId: string, fireAt: number): string {
  return `${tipo}__${refId}__${fireAt}`.replace(/[/\s]/g, '-').slice(0, 300);
}

export function generarRecordatorios(e: Entrada): RecordatorioNuevo[] {
  const { notificaciones } = e.ajustes;
  if (!notificaciones.activas) return [];
  const limite = e.ahoraMs + DIAS_VENTANA * 24 * MS_HORA;
  const hora = (ms: number) => formatear(ms, e.ajustes.formato24h ? 'HH:mm' : 'h:mm a');
  const lista: RecordatorioNuevo[] = [];

  const añadir = (
    tipo: TipoNotificacion,
    refId: string,
    fireAt: number,
    titulo: string,
    cuerpo: string,
    url: string,
  ) => {
    if (!notificaciones.tipos[tipo]) return;
    if (fireAt <= e.ahoraMs || fireAt > limite) return;
    if (
      notificaciones.silencio.activo &&
      enFranja(fireAt, notificaciones.silencio.inicio, notificaciones.silencio.fin)
    )
      return;
    lista.push({
      id: idRecordatorio(tipo, refId, fireAt),
      uid: e.uid,
      tipo,
      refId,
      fireAt,
      titulo,
      cuerpo,
      url,
      enviado: false,
    });
  };

  // Inicio de bloque
  for (const o of e.ocurrencias) {
    if (o.evento.todoElDia || o.evento.tipo === 'protegido') continue;
    const fireAt = o.inicioMs - notificaciones.antelacionMin * MS_MINUTO;
    const cuando =
      notificaciones.antelacionMin > 0 ? `En ${notificaciones.antelacionMin} min` : 'Ahora';
    añadir(
      'inicioBloque',
      o.clave,
      fireAt,
      `${o.titulo}`,
      `${cuando} · ${hora(o.inicioMs)}–${hora(o.finMs)}`,
      `/calendario?fecha=${claveDia(o.inicioMs)}`,
    );
  }

  // Fechas límite: un día antes y una hora antes
  for (const t of e.tareas) {
    if (t.completada || t.fechaLimiteMs === null) continue;
    añadir(
      'fechaLimite',
      `${t.id}-24h`,
      t.fechaLimiteMs - 24 * MS_HORA,
      `Mañana vence: ${t.titulo}`,
      `Fecha límite ${formatear(t.fechaLimiteMs, "EEEE d 'a las' HH:mm")}`,
      '/tareas',
    );
    añadir(
      'fechaLimite',
      `${t.id}-1h`,
      t.fechaLimiteMs - MS_HORA,
      `Vence en 1 hora: ${t.titulo}`,
      'Último empujón 💪',
      '/tareas',
    );
  }

  // Rutinas: aviso de inicio y pasos con hora y aviso activado
  for (let d = startOfDay(e.ahoraMs); d.getTime() < limite; d = addDays(d, 1)) {
    for (const r of e.rutinas) {
      if (!rutinaTocaEnDia(r, d)) continue;
      if (r.avisos.activo && r.programacion.hora) {
        const inicio = conHora(d, r.programacion.hora).getTime();
        añadir(
          'pasoRutina',
          `${r.id}-${claveDia(d)}`,
          inicio - r.avisos.minutosAntes * MS_MINUTO,
          `Rutina: ${r.nombre}`,
          `Empieza a las ${hora(inicio)}`,
          `/rutinas/${r.id}/empezar`,
        );
      }
      for (const p of r.pasos) {
        if (!p.aviso || !p.hora) continue;
        const ms = conHora(d, p.hora).getTime();
        añadir(
          'pasoRutina',
          `${r.id}-${p.id}-${claveDia(d)}`,
          ms,
          `${r.nombre}: ${p.titulo}`,
          p.descripcion || 'Es la hora de este paso',
          `/rutinas/${r.id}/empezar`,
        );
      }
    }
  }

  // Resumen diario y avisos de sobrecarga del día, a la hora elegida
  for (let d = startOfDay(e.ahoraMs); d.getTime() < limite; d = addDays(d, 1)) {
    const clave = claveDia(d);
    const fireAt = conHora(d, notificaciones.resumenDiarioHora).getTime();
    const bloques = e.ocurrencias.filter(
      (o) => claveDia(o.inicioMs) === clave && o.evento.tipo !== 'protegido',
    );
    const tareas = e.tareas.filter(
      (t) => !t.completada && t.planificacion.tipo === 'dia' && t.planificacion.fecha === clave,
    );
    if (bloques.length || tareas.length) {
      const primero = bloques.find((b) => !b.evento.todoElDia);
      añadir(
        'resumenDiario',
        clave,
        fireAt,
        'Tu día de hoy',
        `${bloques.length} ${bloques.length === 1 ? 'bloque' : 'bloques'} y ${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}${primero ? ` · empieza a las ${hora(primero.inicioMs)} con «${primero.titulo}»` : ''}`,
        '/hoy',
      );
    }
    const delDia = e.avisos.filter((a) => a.fecha === clave);
    if (delDia.length) {
      añadir(
        'sobrecarga',
        clave,
        fireAt + MS_MINUTO,
        `${delDia.length} ${delDia.length === 1 ? 'aviso' : 'avisos'} en tu planificación`,
        delDia[0].titulo + (delDia.length > 1 ? ' y más' : ''),
        '/avisos',
      );
    }
  }

  return lista.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAXIMO);
}

/** Diferencia entre lo que hay y lo que debería haber. */
export function diferenciaRecordatorios(
  existentes: Array<Pick<Recordatorio, 'id' | 'fireAt' | 'titulo' | 'cuerpo' | 'tipo'>>,
  deseados: RecordatorioNuevo[],
): { crear: RecordatorioNuevo[]; borrar: string[] } {
  const actuales = new Map(existentes.map((r) => [r.id, r]));
  const nuevos = new Map(deseados.map((r) => [r.id, r]));
  const crear = deseados.filter((d) => {
    const a = actuales.get(d.id);
    return !a || a.titulo !== d.titulo || a.cuerpo !== d.cuerpo;
  });
  const borrar = existentes
    .filter((r) => r.tipo !== 'faseTemporizador' && !nuevos.has(r.id))
    .map((r) => r.id);
  return { crear, borrar };
}
