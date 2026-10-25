// Ajustes: apariencia, pantalla de inicio, calendario, avisos, contador, notificaciones,
// Google Calendar y gestión de datos (exportar, importar, cerrar sesión y borrar cuenta).

import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Database,
  Gauge,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Smartphone,
  Sun,
  Timer,
  Trash2,
  Upload,
  Download,
  CalendarDays,
  House,
} from 'lucide-react';
import { deleteDoc, setDoc } from 'firebase/firestore';
import {
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { esNativo, googleNativo } from './nativo';
import { AjustesNotificacionesNativas } from './AjustesNotificacionesNativas';
import { useDatos } from './almacenDatos';
import { avisar, confirmar } from './almacenUI';
import {
  COLECCIONES,
  actualizarAjustes,
  borrarTodosLosDatos,
  esCopiaValida,
  exportarTodo,
  importarTodo,
  refDoc,
} from './datos';
import { obtenerAuth } from './firebase';
import { cerrarSesion } from './useSincronizacion';
import { activarNotificaciones, notificacionDePrueba } from './useNotificaciones';
import { idDispositivo } from './relojServidor';
import { reproducir } from './sonidos';
import { descargar } from './descargas';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { Campo, Interruptor, Seccion, Segmentado } from './Campos';
import { SelectorColor } from './SelectorColor';
import { SeccionGoogle } from './SeccionGoogle';
import { claveDia, zonaDelDispositivo } from './fechas';
import { t } from './textos';
import type { Ajustes, Densidad, PantallaInicio, Tema, TipoNotificacion } from './tipos';

/** Campo numérico que guarda al salir del campo (para no escribir en cada tecla). */
function CampoNumero({
  etiqueta,
  valor,
  min,
  max,
  paso = 1,
  alGuardar,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso?: number;
  alGuardar: (n: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  const confirmarValor = () => {
    const n = Math.min(max, Math.max(min, Number(texto)));
    if (Number.isFinite(n) && n !== valor) alGuardar(n);
    else setTexto(String(valor));
  };
  return (
    <Campo etiqueta={etiqueta}>
      {(id) => (
        <input
          id={id}
          type="number"
          className="campo"
          min={min}
          max={max}
          step={paso}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmarValor}
          onKeyDown={(e) => e.key === 'Enter' && confirmarValor()}
        />
      )}
    </Campo>
  );
}

function zonasHorarias(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
      'timeZone',
    );
  } catch {
    return [zonaDelDispositivo()];
  }
}

export function PantallaAjustes() {
  const ajustes = useDatos((s) => s.ajustes);
  const usuario = useDatos((s) => s.usuario);
  const dispositivos = useDatos((s) => s.dispositivos);
  const [borrando, setBorrando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const esteDispositivo = idDispositivo();
  const permiso = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  const zonaDispositivo = zonaDelDispositivo();

  const cambiar = (parcial: Partial<Ajustes>) =>
    actualizarAjustes(parcial).catch(() => avisar(t.comun.error, 'error'));
  const cambiarNotif = (parcial: Partial<Ajustes['notificaciones']>) =>
    cambiar({ notificaciones: { ...ajustes.notificaciones, ...parcial } });
  const cambiarContador = (parcial: Partial<Ajustes['temporizador']>) =>
    cambiar({ temporizador: { ...ajustes.temporizador, ...parcial } });
  const cambiarUmbrales = (parcial: Partial<Ajustes['umbrales']>) =>
    cambiar({ umbrales: { ...ajustes.umbrales, ...parcial } });

  const activarAqui = async () => {
    const r = await activarNotificaciones();
    if (r === 'activadas') {
      avisar(t.notificaciones.activadas, 'exito');
      notificacionDePrueba();
    } else if (r === 'soloLocales') {
      avisar(t.notificaciones.sinVapid, 'info');
      notificacionDePrueba();
    } else if (r === 'denegadas') avisar(t.notificaciones.permisoDenegado, 'error');
    else avisar(t.bienvenida.notifNoSoportadas, 'error');
  };

  const exportar = async () => {
    const copia = await exportarTodo();
    descargar(
      `myorganizationschedule-${claveDia(new Date())}.json`,
      JSON.stringify(copia, null, 2),
      'application/json',
    );
  };

  const importar = async (fichero: File) => {
    try {
      const datos = JSON.parse(await fichero.text());
      if (!esCopiaValida(datos)) {
        avisar(t.errores.importacion, 'error');
        return;
      }
      if (
        !(await confirmar({
          titulo: t.ajustes.importarTodo,
          mensaje: t.ajustes.importarTexto,
          textoConfirmar: t.comun.importar,
        }))
      )
        return;
      const n = await importarTodo(datos);
      avisar(t.ajustes.importado(n), 'exito');
    } catch (e) {
      console.error(e);
      avisar(t.errores.importacion, 'error');
    }
  };

  const borrarCuenta = async () => {
    const ok = await confirmar({
      titulo: t.ajustes.borrarCuenta,
      mensaje: t.ajustes.borrarCuentaTexto,
      textoConfirmar: t.ajustes.borrarCuentaConfirmar,
      peligro: true,
    });
    if (!ok) return;
    const auth = obtenerAuth();
    const u = auth.currentUser;
    if (!u) return;
    setBorrando(true);
    try {
      // Firebase exige un inicio de sesión reciente para borrar la cuenta
      if (esNativo) {
        const { idToken } = await googleNativo();
        await reauthenticateWithCredential(u, GoogleAuthProvider.credential(idToken));
      } else {
        await reauthenticateWithPopup(u, new GoogleAuthProvider());
      }
      avisar(t.ajustes.borrando);
      await borrarTodosLosDatos(u.uid);
      await deleteUser(u);
    } catch (e) {
      console.error(e);
      avisar(t.comun.error, 'error');
      setBorrando(false);
    }
  };

  const alternarTipoDispositivo = (
    idDisp: string,
    tipo: TipoNotificacion,
    desactivados: TipoNotificacion[],
  ) => {
    const nuevos = desactivados.includes(tipo)
      ? desactivados.filter((x) => x !== tipo)
      : [...desactivados, tipo];
    void setDoc(
      refDoc(COLECCIONES.dispositivos, idDisp),
      { tiposDesactivados: nuevos },
      { merge: true },
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Cabecera titulo={t.ajustes.titulo} />
      <div className="space-y-4">
        <Seccion titulo={t.ajustes.apariencia} icono={<Palette size={18} />}>
          <div>
            <p className="etiqueta-campo">{t.ajustes.tema}</p>
            <Segmentado
              etiqueta={t.ajustes.tema}
              valor={ajustes.tema}
              alCambiar={(tema: Tema) => cambiar({ tema })}
              opciones={[
                { valor: 'claro', texto: t.ajustes.temas.claro, icono: <Sun size={14} /> },
                { valor: 'oscuro', texto: t.ajustes.temas.oscuro, icono: <Moon size={14} /> },
                { valor: 'sistema', texto: t.ajustes.temas.sistema, icono: <Monitor size={14} /> },
              ]}
            />
          </div>
          <div>
            <p className="etiqueta-campo">{t.ajustes.acento}</p>
            <SelectorColor
              etiqueta={t.ajustes.acento}
              valor={ajustes.colorAcento}
              alCambiar={(colorAcento) => cambiar({ colorAcento })}
            />
          </div>
          <div>
            <p className="etiqueta-campo">{t.ajustes.densidad}</p>
            <Segmentado
              etiqueta={t.ajustes.densidad}
              valor={ajustes.densidad}
              alCambiar={(densidad: Densidad) => cambiar({ densidad })}
              opciones={(Object.keys(t.ajustes.densidades) as Densidad[]).map((d) => ({
                valor: d,
                texto: t.ajustes.densidades[d],
              }))}
            />
          </div>
        </Seccion>

        <Seccion titulo={t.ajustes.inicio} icono={<House size={18} />}>
          <select
            className="campo"
            aria-label={t.ajustes.inicio}
            value={ajustes.pantallaInicio}
            onChange={(e) => cambiar({ pantallaInicio: e.target.value as PantallaInicio })}
          >
            {(Object.keys(t.ajustes.pantallas) as PantallaInicio[]).map((p) => (
              <option key={p} value={p}>
                {t.ajustes.pantallas[p]}
              </option>
            ))}
          </select>
        </Seccion>

        <Seccion titulo={t.ajustes.calendario} icono={<CalendarDays size={18} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta={t.ajustes.inicioSemana}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={ajustes.inicioSemana}
                  onChange={(e) => cambiar({ inicioSemana: Number(e.target.value) as 0 | 1 })}
                >
                  <option value={1}>{t.ajustes.lunes}</option>
                  <option value={0}>{t.ajustes.domingo}</option>
                </select>
              )}
            </Campo>
            <Campo etiqueta={t.ajustes.formato}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={ajustes.formato24h ? '24' : '12'}
                  onChange={(e) => cambiar({ formato24h: e.target.value === '24' })}
                >
                  <option value="24">{t.ajustes.f24}</option>
                  <option value="12">{t.ajustes.f12}</option>
                </select>
              )}
            </Campo>
            <Campo
              etiqueta={t.ajustes.zona}
              ayuda={
                ajustes.zonaHoraria !== zonaDispositivo
                  ? t.ajustes.zonaAviso(zonaDispositivo)
                  : undefined
              }
            >
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={ajustes.zonaHoraria}
                  onChange={(e) => cambiar({ zonaHoraria: e.target.value })}
                >
                  {zonasHorarias().map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <CampoNumero
              etiqueta={`${t.ajustes.duracionDefecto} (min)`}
              valor={ajustes.duracionPorDefectoMin}
              min={5}
              max={720}
              paso={5}
              alGuardar={(n) => cambiar({ duracionPorDefectoMin: n })}
            />
          </div>
          <Interruptor
            etiqueta={t.ajustes.sueno}
            descripcion={t.ajustes.suenoAyuda}
            activo={ajustes.sueno.activo}
            alCambiar={(activo) => cambiar({ sueno: { ...ajustes.sueno, activo } })}
          />
          {ajustes.sueno.activo && (
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta={t.comun.inicio}>
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    className="campo"
                    value={ajustes.sueno.inicio}
                    onChange={(e) =>
                      e.target.value &&
                      cambiar({ sueno: { ...ajustes.sueno, inicio: e.target.value } })
                    }
                  />
                )}
              </Campo>
              <Campo etiqueta={t.comun.fin}>
                {(id) => (
                  <input
                    id={id}
                    type="time"
                    className="campo"
                    value={ajustes.sueno.fin}
                    onChange={(e) =>
                      e.target.value &&
                      cambiar({ sueno: { ...ajustes.sueno, fin: e.target.value } })
                    }
                  />
                )}
              </Campo>
            </div>
          )}
        </Seccion>

        <Seccion titulo={t.ajustes.umbrales} icono={<Gauge size={18} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoNumero
              etiqueta={t.ajustes.focoMax}
              valor={ajustes.umbrales.focoDiarioMaxHoras}
              min={1}
              max={24}
              paso={0.5}
              alGuardar={(n) => cambiarUmbrales({ focoDiarioMaxHoras: n })}
            />
            <CampoNumero
              etiqueta={t.ajustes.seguidasMax}
              valor={ajustes.umbrales.sesionesSeguidasMax}
              min={1}
              max={20}
              alGuardar={(n) => cambiarUmbrales({ sesionesSeguidasMax: n })}
            />
            <CampoNumero
              etiqueta={t.ajustes.descansoMin}
              valor={ajustes.umbrales.descansoMinimoMin}
              min={0}
              max={120}
              alGuardar={(n) => cambiarUmbrales({ descansoMinimoMin: n })}
            />
            <CampoNumero
              etiqueta={t.ajustes.diasLimite}
              valor={ajustes.umbrales.diasAvisoFechaLimite}
              min={1}
              max={30}
              alGuardar={(n) => cambiarUmbrales({ diasAvisoFechaLimite: n })}
            />
          </div>
        </Seccion>

        <Seccion titulo={t.ajustes.contador} icono={<Timer size={18} />}>
          <Interruptor
            etiqueta={t.ajustes.sonido}
            activo={ajustes.temporizador.sonido}
            alCambiar={(sonido) => cambiarContador({ sonido })}
          />
          {ajustes.temporizador.sonido && (
            <div className="flex items-center gap-3">
              <label htmlFor="volumen" className="text-sm text-texto-suave">
                {t.ajustes.volumen}
              </label>
              <input
                id="volumen"
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                className="flex-1 accent-[var(--mos-acento)]"
                defaultValue={ajustes.temporizador.volumen}
                onMouseUp={(e) =>
                  cambiarContador({ volumen: Number((e.target as HTMLInputElement).value) })
                }
                onTouchEnd={(e) =>
                  cambiarContador({ volumen: Number((e.target as HTMLInputElement).value) })
                }
                onKeyUp={(e) =>
                  cambiarContador({ volumen: Number((e.target as HTMLInputElement).value) })
                }
              />
              <Boton
                variante="suave"
                tamano="sm"
                onClick={() => reproducir('foco', ajustes.temporizador.volumen)}
              >
                {t.ajustes.probarSonido}
              </Boton>
            </div>
          )}
          <Interruptor
            etiqueta={t.ajustes.vibracion}
            activo={ajustes.temporizador.vibracion}
            alCambiar={(vibracion) => cambiarContador({ vibracion })}
          />
          <Interruptor
            etiqueta={t.ajustes.autoAvanzar}
            activo={ajustes.temporizador.autoAvanzar}
            alCambiar={(autoAvanzar) => cambiarContador({ autoAvanzar })}
          />
          <CampoNumero
            etiqueta={t.ajustes.focoContinuo}
            valor={ajustes.temporizador.focoContinuoMaxMin}
            min={0}
            max={600}
            paso={5}
            alGuardar={(n) => cambiarContador({ focoContinuoMaxMin: n })}
          />
        </Seccion>

        <Seccion titulo={t.ajustes.notificaciones} icono={<Bell size={18} />}>
          {esNativo ? (
            <AjustesNotificacionesNativas alActivar={activarAqui} />
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-superficie-2 p-3">
              <Smartphone size={18} className="text-acento" aria-hidden />
              <span className="flex-1 text-sm font-semibold">{t.ajustes.esteDispositivo}</span>
              {permiso === 'granted' &&
              dispositivos.find((d) => d.id === esteDispositivo)?.token ? (
                <span className="text-sm font-semibold text-exito">
                  {t.ajustes.dispositivoActivo}
                </span>
              ) : (
                <Boton variante="primario" tamano="sm" onClick={activarAqui}>
                  {t.ajustes.activarDispositivo}
                </Boton>
              )}
            </div>
          )}
          <Interruptor
            etiqueta={t.ajustes.notifActivas}
            activo={ajustes.notificaciones.activas}
            alCambiar={(activas) => cambiarNotif({ activas })}
          />
          {ajustes.notificaciones.activas && (
            <>
              <div className="grid gap-x-6 sm:grid-cols-2">
                {(Object.keys(t.ajustes.tipos) as TipoNotificacion[]).map((tipo) => (
                  <Interruptor
                    key={tipo}
                    etiqueta={t.ajustes.tipos[tipo]}
                    activo={ajustes.notificaciones.tipos[tipo]}
                    alCambiar={(v) =>
                      cambiarNotif({ tipos: { ...ajustes.notificaciones.tipos, [tipo]: v } })
                    }
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoNumero
                  etiqueta={t.ajustes.antelacion}
                  valor={ajustes.notificaciones.antelacionMin}
                  min={0}
                  max={240}
                  alGuardar={(n) => cambiarNotif({ antelacionMin: n })}
                />
                <Campo etiqueta={t.ajustes.resumenHora}>
                  {(id) => (
                    <input
                      id={id}
                      type="time"
                      className="campo"
                      value={ajustes.notificaciones.resumenDiarioHora}
                      onChange={(e) =>
                        e.target.value && cambiarNotif({ resumenDiarioHora: e.target.value })
                      }
                    />
                  )}
                </Campo>
              </div>
              <Interruptor
                etiqueta={t.ajustes.silencio}
                activo={ajustes.notificaciones.silencio.activo}
                alCambiar={(activo) =>
                  cambiarNotif({ silencio: { ...ajustes.notificaciones.silencio, activo } })
                }
              />
              {ajustes.notificaciones.silencio.activo && (
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta={t.comun.inicio}>
                    {(id) => (
                      <input
                        id={id}
                        type="time"
                        className="campo"
                        value={ajustes.notificaciones.silencio.inicio}
                        onChange={(e) =>
                          e.target.value &&
                          cambiarNotif({
                            silencio: {
                              ...ajustes.notificaciones.silencio,
                              inicio: e.target.value,
                            },
                          })
                        }
                      />
                    )}
                  </Campo>
                  <Campo etiqueta={t.comun.fin}>
                    {(id) => (
                      <input
                        id={id}
                        type="time"
                        className="campo"
                        value={ajustes.notificaciones.silencio.fin}
                        onChange={(e) =>
                          e.target.value &&
                          cambiarNotif({
                            silencio: { ...ajustes.notificaciones.silencio, fin: e.target.value },
                          })
                        }
                      />
                    )}
                  </Campo>
                </div>
              )}
              <div>
                <p className="etiqueta-campo">{t.ajustes.dispositivos}</p>
                {dispositivos.length === 0 ? (
                  <p className="text-sm text-texto-suave">{t.ajustes.sinDispositivos}</p>
                ) : (
                  <ul className="space-y-2">
                    {dispositivos.map((d) => (
                      <li key={d.id} className="rounded-md border border-borde p-3">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm font-semibold">
                            {d.nombre || d.id}{' '}
                            {d.id === esteDispositivo && (
                              <span className="text-xs text-acento">
                                ({t.ajustes.esteDispositivo.toLowerCase()})
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-xs ${d.token ? 'text-exito' : 'text-texto-tenue'}`}
                          >
                            {d.token ? 'Push' : '—'}
                          </span>
                          <Boton
                            variante="fantasma"
                            tamano="sm"
                            onClick={() => deleteDoc(refDoc(COLECCIONES.dispositivos, d.id))}
                          >
                            {t.ajustes.quitarDispositivo}
                          </Boton>
                        </div>
                        {d.token && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(Object.keys(t.ajustes.tipos) as TipoNotificacion[]).map((tipo) => {
                              const activo = !(d.tiposDesactivados ?? []).includes(tipo);
                              return (
                                <button
                                  key={tipo}
                                  type="button"
                                  aria-pressed={activo}
                                  onClick={() =>
                                    alternarTipoDispositivo(d.id, tipo, d.tiposDesactivados ?? [])
                                  }
                                  className={`chip ${activo ? 'border-acento/40 bg-acento/10 text-acento' : 'line-through opacity-60'}`}
                                >
                                  {t.ajustes.tipos[tipo]}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </Seccion>

        <SeccionGoogle />

        <Seccion titulo={t.ajustes.datos} icono={<Database size={18} />}>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" icono={<Download size={16} />} onClick={exportar}>
              {t.ajustes.exportarTodo}
            </Boton>
            <Boton
              variante="secundario"
              icono={<Upload size={16} />}
              onClick={() => archivo.current?.click()}
            >
              {t.ajustes.importarTodo}
            </Boton>
            <input
              ref={archivo}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
                e.target.value = '';
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-borde pt-3">
            <Boton
              variante="secundario"
              icono={<LogOut size={16} />}
              onClick={() => cerrarSesion()}
            >
              {t.ajustes.cerrarSesion}
            </Boton>
            <Boton
              variante="peligro"
              icono={<Trash2 size={16} />}
              onClick={borrarCuenta}
              cargando={borrando}
            >
              {t.ajustes.borrarCuenta}
            </Boton>
          </div>
          <p className="text-xs text-texto-tenue">
            {usuario?.email} · {t.ajustes.version} {__VERSION_APP__}
          </p>
        </Seccion>
      </div>
    </div>
  );
}
