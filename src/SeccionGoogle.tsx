// Sección de Ajustes para conectar Google Calendar, elegir calendarios y sincronizar.
import { useEffect, useState } from 'react';
import { CalendarSync, Link2, Unlink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDatos } from './almacenDatos';
import { avisar, useUI } from './almacenUI';
import { Seccion, Campo } from './Campos';
import { Boton } from './Boton';
import { guardarIntegracionGoogle } from './datos';
import {
  TokenCaducado,
  conectarGoogle,
  desconectarGoogle,
  listarCalendarios,
  sincronizarAhora,
  tokenVigente,
  type CalendarioGoogle,
} from './googleCalendar';
import { t } from './textos';

export function SeccionGoogle() {
  const integracion = useDatos((s) => s.integracionGoogle);
  const tokenGuardado = useUI((s) => s.tokenGoogle);
  const [calendarios, setCalendarios] = useState<CalendarioGoogle[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const token = tokenGuardado && tokenGuardado.expiraMs > Date.now() ? tokenGuardado.token : null;

  useEffect(() => {
    if (!token) return;
    listarCalendarios(token)
      .then(setCalendarios)
      .catch(() =>
        setCalendarios([{ id: 'primary', nombre: 'Principal', principal: true, escribible: true }]),
      );
  }, [token]);

  const conectar = async () => {
    setOcupado(true);
    try {
      await conectarGoogle();
    } catch (e) {
      console.error(e);
      avisar(t.comun.error, 'error');
    } finally {
      setOcupado(false);
    }
  };

  const sincronizar = async () => {
    if (!integracion) return;
    setOcupado(true);
    try {
      const tk = tokenVigente() ?? (await conectarGoogle());
      const r = await sincronizarAhora(tk, integracion);
      avisar(t.google.resultado(r.importados, r.exportados), 'exito');
    } catch (e) {
      console.error(e);
      avisar(e instanceof TokenCaducado ? t.google.tokenCaducado : t.comun.error, 'error');
    } finally {
      setOcupado(false);
    }
  };

  const elegir = (campo: 'calendarioImportarId' | 'calendarioExportarId', valor: string) =>
    integracion && guardarIntegracionGoogle({ ...integracion, [campo]: valor || null });

  return (
    <Seccion titulo={t.ajustes.google} icono={<CalendarSync size={18} />}>
      <p className="text-sm text-texto-suave">{t.google.descripcion}</p>
      {!integracion?.conectado ? (
        <Boton
          variante="primario"
          icono={<Link2 size={16} />}
          onClick={conectar}
          cargando={ocupado}
        >
          {t.google.conectar}
        </Boton>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-exito">
            {t.google.conectado(integracion.email ?? '')}
          </p>
          {!token && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-superficie-2 p-3 text-sm text-texto-suave">
              {t.google.tokenCaducado}
              <Boton variante="suave" tamano="sm" onClick={conectar} cargando={ocupado}>
                {t.google.conectar}
              </Boton>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta={t.google.importarDe}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={integracion.calendarioImportarId ?? ''}
                  onChange={(e) => elegir('calendarioImportarId', e.target.value)}
                  disabled={!token && !integracion.calendarioImportarId}
                >
                  <option value="">{t.google.noImportar}</option>
                  {integracion.calendarioImportarId &&
                    !calendarios.some((c) => c.id === integracion.calendarioImportarId) && (
                      <option value={integracion.calendarioImportarId}>
                        {integracion.calendarioImportarId}
                      </option>
                    )}
                  {calendarios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo etiqueta={t.google.exportarA}>
              {(id) => (
                <select
                  id={id}
                  className="campo"
                  value={integracion.calendarioExportarId ?? ''}
                  onChange={(e) => elegir('calendarioExportarId', e.target.value)}
                  disabled={!token && !integracion.calendarioExportarId}
                >
                  <option value="">{t.google.noExportar}</option>
                  {integracion.calendarioExportarId &&
                    !calendarios.some((c) => c.id === integracion.calendarioExportarId) && (
                      <option value={integracion.calendarioExportarId}>
                        {integracion.calendarioExportarId}
                      </option>
                    )}
                  {calendarios
                    .filter((c) => c.escribible)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              )}
            </Campo>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="primario"
              icono={<CalendarSync size={16} />}
              onClick={sincronizar}
              cargando={ocupado}
              disabled={!integracion.calendarioImportarId && !integracion.calendarioExportarId}
            >
              {ocupado ? t.google.sincronizando : t.google.sincronizar}
            </Boton>
            <Boton
              variante="fantasma"
              icono={<Unlink size={16} />}
              onClick={() => desconectarGoogle()}
            >
              {t.google.desconectar}
            </Boton>
          </div>
          {integracion.ultimaSincronizacionMs && (
            <p className="text-xs text-texto-tenue">
              {t.google.ultima(
                formatDistanceToNow(integracion.ultimaSincronizacionMs, {
                  addSuffix: true,
                  locale: es,
                }),
              )}
            </p>
          )}
          <p className="text-xs text-texto-tenue">{t.google.limitacion}</p>
        </div>
      )}
    </Seccion>
  );
}
