// Mantiene la colección `reminders` al día: cada vez que cambian bloques, tareas, rutinas o
// ajustes, recalcula los recordatorios de los próximos 14 días y aplica solo las diferencias.
// La Cloud Function `enviarRecordatorios` los envía como push cuando llega su hora.

import { useEffect } from 'react';
import { addDays, startOfDay } from 'date-fns';
import { useDatos } from './almacenDatos';
import { COLECCIONES, enLotes, recordatoriosPendientes, refDoc, uidActual } from './datos';
import {
  diferenciaRecordatorios,
  generarRecordatorios,
  DIAS_VENTANA,
  type RecordatorioNuevo,
} from './recordatorios';
import { expandirOcurrencias } from './recurrencia';
import { esNativo, programarAvisos } from './nativo';
import type { AvisoCarga } from './tipos';

/** Últimos recordatorios calculados: los usa también el aviso en primer plano. */
let ultimosDeseados: RecordatorioNuevo[] = [];
export const recordatoriosCalculados = () => ultimosDeseados;

export function useRecordatorios(avisos: AvisoCarga[]): void {
  const uid = useDatos((s) => s.usuario?.uid);
  const eventos = useDatos((s) => s.eventos);
  const excepciones = useDatos((s) => s.excepciones);
  const tareas = useDatos((s) => s.tareas);
  const rutinas = useDatos((s) => s.rutinas);
  const notificaciones = useDatos((s) => s.ajustes.notificaciones);
  const formato24h = useDatos((s) => s.ajustes.formato24h);

  useEffect(() => {
    if (!uid) return;
    // Esperamos un poco para agrupar varios cambios seguidos en una sola escritura
    const temporizador = setTimeout(async () => {
      try {
        const ahora = Date.now();
        const desde = startOfDay(ahora).getTime();
        const ocurrencias = expandirOcurrencias(
          eventos,
          excepciones,
          desde,
          addDays(desde, DIAS_VENTANA + 1).getTime(),
        );
        const deseados = generarRecordatorios({
          uid: uidActual(),
          ajustes: { notificaciones, formato24h },
          ocurrencias,
          tareas,
          rutinas,
          avisos,
          ahoraMs: ahora,
        });
        ultimosDeseados = deseados;
        // En la app Android el propio móvil programa estas notificaciones (sin servidor)
        if (esNativo) {
          await programarAvisos(
            'recordatorios',
            deseados.map((r) => ({
              id: r.id,
              fireAt: r.fireAt,
              titulo: r.titulo,
              cuerpo: r.cuerpo,
              url: r.url,
            })),
          ).catch((e) => console.warn('No se pudieron programar las notificaciones', e));
        }
        const existentes = (await recordatoriosPendientes()).filter(
          (r) => r.tipo !== 'faseTemporizador',
        );
        const { crear, borrar } = diferenciaRecordatorios(existentes as never, deseados);
        if (!crear.length && !borrar.length) return;
        await enLotes(
          [
            ...borrar.map((id) => ({ id, borrar: true as const })),
            ...crear.map((r) => ({ id: r.id, datos: r })),
          ],
          (lote, op) => {
            if ('borrar' in op) lote.delete(refDoc(COLECCIONES.recordatorios, op.id));
            else {
              const { id: _id, ...datos } = op.datos;
              lote.set(refDoc(COLECCIONES.recordatorios, op.id), {
                ...datos,
                creadoEnMs: Date.now(),
              });
            }
          },
        );
      } catch (e) {
        console.warn('No se pudieron actualizar los recordatorios', e);
      }
    }, 3000);
    return () => clearTimeout(temporizador);
  }, [uid, eventos, excepciones, tareas, rutinas, notificaciones, formato24h, avisos]);
}
