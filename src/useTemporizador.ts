// Hooks del contador.
//  - useEstadoContador: datos para pintar (tiempo restante, fase, progreso…).
//  - useMotorContador: se monta una sola vez en el diseño general. Corrige el reloj,
//    avanza las fases cuando terminan, suena/vibra/notifica en cada cambio y avisa del
//    foco continuo excesivo.

import { useEffect, useRef, useState } from 'react';
import { useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { ahoraServidor, sincronizarReloj } from './relojServidor';
import {
  aPlano,
  avanzarSiToca,
  avisosDeFases,
  sincronizarRecordatoriosContador,
} from './temporizador';
import { esNativo, programarAvisos } from './nativo';
import { desfaseActual } from './relojServidor';
import { focoContinuoMs, mensajeFase, progresoFase, restanteMs, transcurridoMs } from './ciclos';
import { prepararAudio, reproducir, vibrar } from './sonidos';
import { mostrarNotificacionLocal } from './serviceWorker';
import { t } from './textos';

export function useEstadoContador() {
  const contador = useDatos((s) => s.contador);
  const [ahora, setAhora] = useState(() => ahoraServidor());

  useEffect(() => {
    setAhora(ahoraServidor());
    if (!contador || contador.estado !== 'enCurso') return;
    // Este intervalo solo refresca la pantalla; el tiempo real sale de las marcas guardadas
    const id = setInterval(() => setAhora(ahoraServidor()), 250);
    return () => clearInterval(id);
  }, [contador]);

  const plano = aPlano(contador);
  const activo = !!contador && contador.estado !== 'inactivo';
  const fase =
    contador && contador.indiceFase < contador.fases.length
      ? contador.fases[contador.indiceFase]
      : null;
  const siguiente = contador ? (contador.fases[contador.indiceFase + 1] ?? null) : null;
  return {
    contador,
    activo,
    fase,
    siguiente,
    restanteMs: plano ? Math.max(0, restanteMs(plano, ahora)) : 0,
    transcurridoMs: plano ? transcurridoMs(plano, ahora) : 0,
    progreso: plano ? progresoFase(plano, ahora) : 0,
    cicloTerminado:
      !!contador && contador.indiceFase >= contador.fases.length && contador.modo === 'ciclo',
    ahora,
  };
}

export function useMotorContador(): void {
  const uid = useDatos((s) => s.usuario?.uid);
  const contador = useDatos((s) => s.contador);
  const ajustesContador = useDatos((s) => s.ajustes.temporizador);
  const notificaciones = useDatos((s) => s.ajustes.notificaciones);
  const anterior = useRef<{ indice: number; estado: string; sesion: number | null } | null>(null);
  const avisadoFocoContinuo = useRef<string | null>(null);

  // Reloj del servidor: al entrar y cada 10 minutos
  useEffect(() => {
    if (!uid) return;
    prepararAudio();
    sincronizarReloj().catch((e) => console.warn('No se pudo medir el desfase del reloj', e));
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') sincronizarReloj().catch(() => undefined);
    }, 10 * 60_000);
    return () => clearInterval(id);
  }, [uid]);

  // Avance automático de fases y aviso de foco continuo
  useEffect(() => {
    if (!contador || contador.estado !== 'enCurso') return;
    const comprobar = () => {
      const plano = aPlano(contador);
      if (!plano) return;
      const ahora = ahoraServidor();
      if (contador.modo === 'ciclo' && restanteMs(plano, ahora) <= 0) {
        avanzarSiToca(ajustesContador.autoAvanzar).catch((e) =>
          console.warn('No se pudo avanzar la fase', e),
        );
      }
      const fase = contador.fases[contador.indiceFase];
      const continuo = focoContinuoMs(
        contador.tramos ?? [],
        fase?.tipo ?? null,
        transcurridoMs(plano, ahora),
      );
      const limite = ajustesContador.focoContinuoMaxMin * 60_000;
      const clave = `${contador.sesionInicioMs}-${contador.tramos?.length ?? 0}`;
      if (limite > 0 && continuo > limite && avisadoFocoContinuo.current !== clave) {
        avisadoFocoContinuo.current = clave;
        const texto = t.foco.focoContinuo(Math.round(continuo / 60_000));
        avisar(texto, 'info');
        if (ajustesContador.sonido) reproducir('aviso', ajustesContador.volumen);
        if (document.visibilityState !== 'visible')
          void mostrarNotificacionLocal(t.foco.titulo, texto, '/foco', 'mos-contador');
      }
    };
    comprobar();
    // Con la pestaña oculta el navegador ralentiza este intervalo, pero no importa:
    // el cálculo usa marcas de tiempo y se pone al día al volver.
    const id = setInterval(comprobar, 1000);
    document.addEventListener('visibilitychange', comprobar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', comprobar);
    };
  }, [
    contador,
    ajustesContador.autoAvanzar,
    ajustesContador.focoContinuoMaxMin,
    ajustesContador.sonido,
    ajustesContador.volumen,
  ]);

  // Cambios de fase: sonido, vibración, notificación y mensaje claro
  useEffect(() => {
    const previo = anterior.current;
    anterior.current = contador
      ? { indice: contador.indiceFase, estado: contador.estado, sesion: contador.sesionInicioMs }
      : null;
    if (!previo || !contador || previo.sesion !== contador.sesionInicioMs) return;
    const cambioIndice = contador.indiceFase !== previo.indice;
    const pasaAEsperar = contador.estado === 'esperando' && previo.estado !== 'esperando';
    if (!cambioIndice && !pasaAEsperar) return;

    const terminado = contador.indiceFase >= contador.fases.length;
    const fase = contador.fases[contador.indiceFase];
    const titulo = terminado
      ? t.foco.cicloTerminado
      : pasaAEsperar
        ? t.foco.esperando
        : mensajeFase(fase.tipo, fase.nombre);
    const cuerpo = terminado
      ? t.foco.cicloTerminadoTexto
      : `${fase.nombre} · ${Math.round(fase.duracionMs / 60_000)} min`;
    if (ajustesContador.sonido) {
      reproducir(
        terminado ? 'fin' : fase.tipo === 'foco' ? 'foco' : 'descanso',
        ajustesContador.volumen,
      );
    }
    if (ajustesContador.vibracion) vibrar();
    if (document.visibilityState === 'visible') avisar(`${titulo}`, terminado ? 'logro' : 'info');
    else if (notificaciones.tipos.faseTemporizador)
      void mostrarNotificacionLocal(titulo, cuerpo, '/foco', 'mos-contador');
  }, [
    contador,
    ajustesContador.sonido,
    ajustesContador.vibracion,
    ajustesContador.volumen,
    notificaciones.tipos.faseTemporizador,
  ]);

  // Recordatorios en el servidor para recibir los cambios de fase con la app cerrada
  const version = contador?.version ?? null;
  useEffect(() => {
    if (!uid) return;
    const activas = notificaciones.activas && notificaciones.tipos.faseTemporizador;
    const temporizador = setTimeout(() => {
      sincronizarRecordatoriosContador(
        activas ? contador : null,
        ajustesContador.autoAvanzar,
      ).catch((e) => console.warn('No se pudieron preparar los avisos del contador', e));
      // En la app Android, además, cada móvil programa sus propias alarmas de cambio de fase.
      // Las horas vienen en hora del servidor: las pasamos a la hora de este móvil.
      if (esNativo) {
        const avisos = avisosDeFases(activas ? contador : null, ajustesContador.autoAvanzar).map(
          (a) => ({
            id: `${a.refId}-${a.fireAt}`,
            fireAt: a.fireAt - desfaseActual(),
            titulo: a.titulo,
            cuerpo: a.cuerpo,
            url: '/foco',
          }),
        );
        programarAvisos('contador', avisos).catch((e) =>
          console.warn('No se pudieron programar las alarmas del contador', e),
        );
      }
    }, 800);
    return () => clearTimeout(temporizador);
    // Solo cuando cambia la versión del contador (no en cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    uid,
    version,
    notificaciones.activas,
    notificaciones.tipos.faseTemporizador,
    ajustesContador.autoAvanzar,
  ]);
}
