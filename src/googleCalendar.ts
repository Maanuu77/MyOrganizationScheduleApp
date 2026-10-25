// Integración con Google Calendar (sincronización manual con el botón "Sincronizar ahora").
//
// - El permiso se pide con Firebase Auth (ventana de Google) con el alcance calendar.events.
//   En el navegador solo recibimos un token de acceso que caduca en 1 hora y NO hay token de
//   refresco: por eso la sincronización es manual y hay que reconectar si caduca.
// - Importar: eventos de un calendario elegido → eventos de la app con id determinista
//   (gcal-...) y `origenGoogle`, así nunca se duplican.
// - Exportar: cada ocurrencia de la app → evento de Google con la propiedad extendida privada
//   mosId (id de la ocurrencia). Así sabemos cuál es cuál y no duplicamos.
// - Conflictos: gana el último cambio (comparando la fecha de actualización de cada lado).

import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { addDays } from 'date-fns';
import { obtenerAuth } from './firebase';
import { useDatos } from './almacenDatos';
import { useUI } from './almacenUI';
import {
  COLECCIONES,
  borrar,
  eventos as dbEventos,
  excepciones as dbExcepciones,
  guardarIntegracionGoogle,
  refDoc,
  limpiar,
} from './datos';
import { setDoc } from 'firebase/firestore';
import { eventoVacio } from './operaciones';
import { expandirOcurrencias } from './recurrencia';
import { claveDia, zonaDelDispositivo } from './fechas';
import { esNativo, googleNativo } from './nativo';
import type { Evento, ExcepcionEvento, IntegracionGoogle } from './tipos';

const API = 'https://www.googleapis.com/calendar/v3';
const ALCANCES = [
  'https://www.googleapis.com/auth/calendar.events',
  // Solo para listar los calendarios y poder elegir uno (lectura)
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

export class TokenCaducado extends Error {}

export interface CalendarioGoogle {
  id: string;
  nombre: string;
  principal: boolean;
  escribible: boolean;
}

interface EventoGoogle {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** Pide permiso para Google Calendar y guarda el token de acceso en memoria. */
export async function conectarGoogle(): Promise<string> {
  const usuario = obtenerAuth().currentUser;
  if (!usuario) throw new Error('Sin sesión');
  let token: string | null | undefined;
  if (esNativo) {
    // En la app Android pedimos los permisos con el selector de cuentas nativo
    token = (await googleNativo(ALCANCES)).accessToken;
  } else {
    const proveedor = new GoogleAuthProvider();
    ALCANCES.forEach((a) => proveedor.addScope(a));
    proveedor.setCustomParameters({ login_hint: usuario.email ?? '' });
    const resultado = await reauthenticateWithPopup(usuario, proveedor);
    token = GoogleAuthProvider.credentialFromResult(resultado)?.accessToken;
  }
  if (!token) throw new Error('Google no devolvió un token');
  useUI.getState().poner({ tokenGoogle: { token, expiraMs: Date.now() + 55 * 60_000 } });
  const previa = useDatos.getState().integracionGoogle;
  await guardarIntegracionGoogle({
    conectado: true,
    email: usuario.email,
    calendarioImportarId: previa?.calendarioImportarId ?? null,
    calendarioExportarId: previa?.calendarioExportarId ?? null,
    ultimaSincronizacionMs: previa?.ultimaSincronizacionMs ?? null,
    actualizadoEnMs: Date.now(),
  });
  return token;
}

export async function desconectarGoogle(): Promise<void> {
  useUI.getState().poner({ tokenGoogle: null });
  await guardarIntegracionGoogle({
    conectado: false,
    email: null,
    calendarioImportarId: null,
    calendarioExportarId: null,
    ultimaSincronizacionMs: null,
    actualizadoEnMs: Date.now(),
  });
}

/** Token vigente o null si hay que volver a conectar. */
export function tokenVigente(): string | null {
  const tk = useUI.getState().tokenGoogle;
  return tk && tk.expiraMs > Date.now() ? tk.token : null;
}

async function llamar<T>(token: string, ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opciones.headers,
    },
  });
  if (respuesta.status === 401) {
    useUI.getState().poner({ tokenGoogle: null });
    throw new TokenCaducado('Token caducado');
  }
  if (respuesta.status === 204) return undefined as T;
  if (!respuesta.ok) throw new Error(`Google Calendar respondió ${respuesta.status}`);
  return (await respuesta.json()) as T;
}

export async function listarCalendarios(token: string): Promise<CalendarioGoogle[]> {
  const datos = await llamar<{
    items?: Array<{ id: string; summary: string; primary?: boolean; accessRole: string }>;
  }>(token, '/users/me/calendarList?minAccessRole=reader');
  return (datos.items ?? []).map((c) => ({
    id: c.id,
    nombre: c.summary,
    principal: !!c.primary,
    escribible: c.accessRole === 'owner' || c.accessRole === 'writer',
  }));
}

/** Todos los eventos (con paginación) de un calendario en un rango. */
async function listarEventos(
  token: string,
  calendarioId: string,
  desde: number,
  hasta: number,
  extra = '',
): Promise<EventoGoogle[]> {
  const lista: EventoGoogle[] = [];
  let pagina: string | undefined;
  do {
    const parametros = new URLSearchParams({
      timeMin: new Date(desde).toISOString(),
      timeMax: new Date(hasta).toISOString(),
      singleEvents: 'true',
      maxResults: '2500',
      showDeleted: 'false',
    });
    if (pagina) parametros.set('pageToken', pagina);
    const datos = await llamar<{ items?: EventoGoogle[]; nextPageToken?: string }>(
      token,
      `/calendars/${encodeURIComponent(calendarioId)}/events?${parametros}${extra}`,
    );
    lista.push(...(datos.items ?? []));
    pagina = datos.nextPageToken;
  } while (pagina);
  return lista;
}

/** Id de documento estable para un evento importado (sin caracteres raros). */
function idImportado(calendarioId: string, eventoId: string): string {
  let hash = 0;
  for (const c of calendarioId) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return `gcal-${Math.abs(hash).toString(36)}-${eventoId}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 300);
}

function tiemposDe(
  g: EventoGoogle,
): { inicioMs: number; finMs: number; todoElDia: boolean } | null {
  if (g.start?.dateTime && g.end?.dateTime) {
    return {
      inicioMs: Date.parse(g.start.dateTime),
      finMs: Date.parse(g.end.dateTime),
      todoElDia: false,
    };
  }
  if (g.start?.date && g.end?.date) {
    const [a, m, d] = g.start.date.split('-').map(Number);
    const [a2, m2, d2] = g.end.date.split('-').map(Number);
    return {
      inicioMs: new Date(a, m - 1, d).getTime(),
      finMs: new Date(a2, m2 - 1, d2).getTime(),
      todoElDia: true,
    };
  }
  return null;
}

function cuerpoGoogle(
  titulo: string,
  notas: string,
  inicioMs: number,
  finMs: number,
  todoElDia: boolean,
  mosId?: string,
) {
  const zona = zonaDelDispositivo();
  return {
    summary: titulo,
    description: notas || undefined,
    start: todoElDia
      ? { date: claveDia(inicioMs) }
      : { dateTime: new Date(inicioMs).toISOString(), timeZone: zona },
    end: todoElDia
      ? { date: claveDia(finMs) }
      : { dateTime: new Date(finMs).toISOString(), timeZone: zona },
    ...(mosId ? { extendedProperties: { private: { mosApp: '1', mosId } } } : {}),
  };
}

export interface ResultadoSincronizacion {
  importados: number;
  exportados: number;
}

/** Sincroniza en los dos sentidos según los calendarios elegidos. */
export async function sincronizarAhora(
  token: string,
  integracion: IntegracionGoogle,
): Promise<ResultadoSincronizacion> {
  const ahora = Date.now();
  const desde = addDays(ahora, -30).getTime();
  const hasta = addDays(ahora, 90).getTime();
  let importados = 0;
  let exportados = 0;

  // ---------------- Importar ----------------
  const idImp = integracion.calendarioImportarId;
  if (idImp) {
    const deGoogle = (await listarEventos(token, idImp, desde, hasta)).filter(
      (g) => g.status !== 'cancelled' && !g.extendedProperties?.private?.mosApp,
    );
    const { eventos } = useDatos.getState();
    const vistos = new Set<string>();
    for (const g of deGoogle) {
      const tiempos = tiemposDe(g);
      if (!tiempos) continue;
      const id = idImportado(idImp, g.id);
      vistos.add(id);
      const actualizadoGoogle = g.updated ? Date.parse(g.updated) : 0;
      const local = eventos.find((e) => e.id === id);
      if (!local) {
        await setDoc(
          refDoc(COLECCIONES.eventos, id),
          limpiar({
            ...eventoVacio({
              ...tiempos,
              titulo: g.summary || '(Sin título)',
              notas: g.description ?? '',
            }),
            // Guardamos cuándo lo sincronizamos: así distinguimos cambios posteriores en cada lado
            origenGoogle: { calendarioId: idImp, eventoId: g.id, actualizadoMs: ahora },
            creadoEnMs: ahora,
            actualizadoEnMs: ahora,
          }),
        );
        importados++;
      } else if (
        actualizadoGoogle > (local.origenGoogle?.actualizadoMs ?? 0) &&
        actualizadoGoogle > local.actualizadoEnMs
      ) {
        // Cambió en Google después que en la app: gana Google
        await dbEventos.actualizar(id, {
          ...tiempos,
          titulo: g.summary || '(Sin título)',
          notas: g.description ?? '',
          origenGoogle: { calendarioId: idImp, eventoId: g.id, actualizadoMs: Date.now() },
        });
        importados++;
      } else if (
        local.actualizadoEnMs >
        Math.max(actualizadoGoogle, local.origenGoogle?.actualizadoMs ?? 0) + 2000
      ) {
        // Cambió en la app después: lo llevamos a Google (si el calendario lo permite)
        try {
          const g2 = await llamar<EventoGoogle>(
            token,
            `/calendars/${encodeURIComponent(idImp)}/events/${encodeURIComponent(g.id)}`,
            {
              method: 'PATCH',
              body: JSON.stringify(
                cuerpoGoogle(
                  local.titulo,
                  local.notas,
                  local.inicioMs,
                  local.finMs,
                  local.todoElDia,
                ),
              ),
            },
          );
          const enGoogle = g2?.updated ? Date.parse(g2.updated) : 0;
          await dbEventos.actualizar(id, {
            origenGoogle: {
              calendarioId: idImp,
              eventoId: g.id,
              actualizadoMs: Math.max(enGoogle, Date.now()),
            },
          });
        } catch (e) {
          if (e instanceof TokenCaducado) throw e;
          // Calendario de solo lectura: se queda la versión de la app
        }
      }
    }
    // Lo que se borró en Google se borra también en la app
    for (const e of eventos) {
      if (
        e.origenGoogle?.calendarioId === idImp &&
        e.inicioMs >= desde &&
        e.inicioMs < hasta &&
        !vistos.has(e.id)
      ) {
        await borrar(COLECCIONES.eventos, e.id);
      }
    }
  }

  // ---------------- Exportar ----------------
  const idExp = integracion.calendarioExportarId;
  if (idExp) {
    const { eventos, excepciones } = useDatos.getState();
    const propios = eventos.filter((e) => !e.origenGoogle);
    const ocurrencias = expandirOcurrencias(propios, excepciones, desde, hasta).slice(0, 800);
    const existentes = await listarEventos(
      token,
      idExp,
      desde,
      hasta,
      '&privateExtendedProperty=mosApp%3D1',
    );
    const porMosId = new Map(
      existentes.map((g) => [g.extendedProperties?.private?.mosId ?? '', g]),
    );
    const deseados = new Set<string>();
    for (const o of ocurrencias) {
      deseados.add(o.clave);
      const g = porMosId.get(o.clave);
      const actualizadoApp = Math.max(o.evento.actualizadoEnMs, o.excepcion?.actualizadoEnMs ?? 0);
      const cuerpo = cuerpoGoogle(
        o.titulo,
        o.notas,
        o.inicioMs,
        o.finMs,
        o.evento.todoElDia,
        o.clave,
      );
      if (!g) {
        await llamar(token, `/calendars/${encodeURIComponent(idExp)}/events`, {
          method: 'POST',
          body: JSON.stringify(cuerpo),
        });
        exportados++;
        continue;
      }
      const actualizadoGoogle = g.updated ? Date.parse(g.updated) : 0;
      const tiempos = tiemposDe(g);
      const igual =
        tiempos &&
        tiempos.inicioMs === o.inicioMs &&
        tiempos.finMs === o.finMs &&
        (g.summary ?? '') === o.titulo;
      if (igual) continue;
      if (actualizadoApp >= actualizadoGoogle) {
        await llamar(
          token,
          `/calendars/${encodeURIComponent(idExp)}/events/${encodeURIComponent(g.id)}`,
          { method: 'PATCH', body: JSON.stringify(cuerpo) },
        );
        exportados++;
      } else if (tiempos) {
        // Se editó en Google más tarde: aplicamos el cambio en la app
        await aplicarCambioDesdeGoogle(o.evento, o.inicioOriginalMs, o.excepcion, {
          ...tiempos,
          titulo: g.summary ?? o.titulo,
        });
        importados++;
      }
    }
    // Ocurrencias que ya no existen en la app → se borran de Google
    for (const g of existentes) {
      const mosId = g.extendedProperties?.private?.mosId;
      if (mosId && !deseados.has(mosId)) {
        await llamar(
          token,
          `/calendars/${encodeURIComponent(idExp)}/events/${encodeURIComponent(g.id)}`,
          { method: 'DELETE' },
        );
      }
    }
  }

  await guardarIntegracionGoogle({
    ...integracion,
    ultimaSincronizacionMs: Date.now(),
    actualizadoEnMs: Date.now(),
  });
  return { importados, exportados };
}

async function aplicarCambioDesdeGoogle(
  evento: Evento,
  inicioOriginalMs: number,
  excepcion: ExcepcionEvento | null,
  cambios: { inicioMs: number; finMs: number; titulo: string },
): Promise<void> {
  if (!evento.recurrencia) {
    await dbEventos.actualizar(evento.id, {
      inicioMs: cambios.inicioMs,
      finMs: cambios.finMs,
      titulo: cambios.titulo,
    });
    return;
  }
  await dbExcepciones.guardar(
    {
      eventoId: evento.id,
      inicioOriginalMs,
      cancelada: false,
      completado: excepcion?.completado ?? false,
      cambios: {
        ...excepcion?.cambios,
        inicioMs: cambios.inicioMs,
        finMs: cambios.finMs,
        titulo: cambios.titulo,
      },
    },
    excepcion,
  );
}
