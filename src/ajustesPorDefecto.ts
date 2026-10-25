// Valores iniciales de los ajustes. No son datos del usuario: solo preferencias razonables
// que se pueden cambiar todas desde la pantalla de Ajustes.

import type { Ajustes } from './tipos';

export function ajustesPorDefecto(zonaHoraria: string): Ajustes {
  return {
    tema: 'sistema',
    colorAcento: '#5B4BDB',
    densidad: 'normal',
    pantallaInicio: 'hoy',
    inicioSemana: 1,
    formato24h: true,
    zonaHoraria,
    duracionPorDefectoMin: 60,
    sueno: { activo: false, inicio: '23:30', fin: '07:30' },
    umbrales: {
      focoDiarioMaxHoras: 8,
      sesionesSeguidasMax: 3,
      descansoMinimoMin: 10,
      diasAvisoFechaLimite: 3,
    },
    temporizador: {
      sonido: true,
      vibracion: true,
      volumen: 0.7,
      focoContinuoMaxMin: 120,
      autoAvanzar: true,
    },
    notificaciones: {
      activas: false,
      antelacionMin: 10,
      tipos: {
        inicioBloque: true,
        faseTemporizador: true,
        pasoRutina: true,
        fechaLimite: true,
        resumenDiario: true,
        sobrecarga: true,
      },
      silencio: { activo: true, inicio: '23:00', fin: '07:00' },
      resumenDiarioHora: '08:00',
    },
    onboardingCompletado: false,
    actualizadoEnMs: 0,
  };
}

/**
 * Mezcla los ajustes guardados con los valores por defecto, para que una versión
 * nueva de la app con ajustes nuevos no falle con documentos antiguos.
 */
export function completarAjustes(
  guardados: Partial<Ajustes> | undefined,
  zonaHoraria: string,
): Ajustes {
  const base = ajustesPorDefecto(zonaHoraria);
  if (!guardados) return base;
  return {
    ...base,
    ...guardados,
    sueno: { ...base.sueno, ...guardados.sueno },
    umbrales: { ...base.umbrales, ...guardados.umbrales },
    temporizador: { ...base.temporizador, ...guardados.temporizador },
    notificaciones: {
      ...base.notificaciones,
      ...guardados.notificaciones,
      tipos: { ...base.notificaciones.tipos, ...guardados.notificaciones?.tipos },
      silencio: { ...base.notificaciones.silencio, ...guardados.notificaciones?.silencio },
    },
  };
}
