// Estructura común de la app: barra lateral en escritorio, navegación inferior en móvil,
// panel fijo de "Hoy" en pantallas grandes y los editores globales (bloques y tareas).

import { useEffect, useState } from 'react';
import { esNativo, prepararNavegacionNativa } from './nativo';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  Ellipsis,
  House,
  Keyboard,
  ListTodo,
  PanelRightClose,
  PanelRightOpen,
  Repeat,
  Settings,
  Tag,
  Timer,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { t } from './textos';
import { Logo } from './Logo';
import { useDatos } from './almacenDatos';
import { useUI } from './almacenUI';
import { useAvisosCarga } from './useCalendarioDatos';
import { useEsEscritorioGrande, useEsMovil } from './useMedia';
import { PanelHoy } from './PanelHoy';
import { Modal } from './Modal';
import { EditorBloque } from './EditorBloque';
import { EditorTarea } from './EditorTarea';
import { DialogoMoverA } from './DialogoFechaHora';
import { MiniContador } from './MiniContador';
import { DialogoAtajos } from './DialogoAtajos';
import { useAtajosGlobales } from './useAtajos';
import { useMotorContador } from './useTemporizador';
import { useRecordatorios } from './useRecordatorios';
import { useAvisosEnPrimerPlano } from './useNotificaciones';

interface ElementoNav {
  ruta: string;
  texto: string;
  icono: LucideIcon;
}

const PRINCIPALES: ElementoNav[] = [
  { ruta: '/hoy', texto: t.nav.hoy, icono: House },
  { ruta: '/calendario', texto: t.nav.calendario, icono: CalendarDays },
  { ruta: '/tareas', texto: t.nav.tareas, icono: ListTodo },
  { ruta: '/foco', texto: t.nav.foco, icono: Timer },
  { ruta: '/rutinas', texto: t.nav.rutinas, icono: Repeat },
  { ruta: '/estadisticas', texto: t.nav.estadisticas, icono: ChartColumn },
];

const SECUNDARIOS: ElementoNav[] = [
  { ruta: '/etiquetas', texto: t.nav.etiquetas, icono: Tag },
  { ruta: '/ciclos', texto: t.nav.ciclos, icono: Workflow },
  { ruta: '/plantilla', texto: t.nav.plantilla, icono: CalendarRange },
  { ruta: '/avisos', texto: t.nav.avisos, icono: Bell },
  { ruta: '/ajustes', texto: t.nav.ajustes, icono: Settings },
];

const MOVIL: ElementoNav[] = [PRINCIPALES[0], PRINCIPALES[1], PRINCIPALES[3], PRINCIPALES[2]];

function Insignia({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-peligro px-1.5 text-[11px] font-bold text-white">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function Diseno() {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const esMovil = useEsMovil();
  const esGrande = useEsEscritorioGrande();
  const usuario = useDatos((s) => s.usuario);
  const panelHoy = useUI((s) => s.panelHoy);
  const hojaHoy = useUI((s) => s.hojaHoy);
  const poner = useUI((s) => s.poner);
  const avisos = useAvisosCarga();
  const [menuMas, setMenuMas] = useState(false);

  // Motores globales: avance del contador, recordatorios y avisos con la app abierta
  useMotorContador();
  useRecordatorios(avisos);
  useAvisosEnPrimerPlano();
  useAtajosGlobales();

  // App Android: botón "atrás" del sistema y toques en las notificaciones
  useEffect(() => (esNativo ? prepararNavegacionNativa(navegar) : undefined), [navegar]);

  const enHoy = ubicacion.pathname === '/hoy';
  const mostrarPanelHoy = esGrande && panelHoy && !enHoy;
  const graves = avisos.filter((a) => a.severidad !== 'info').length;

  const claseEnlace = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-acento/12 text-acento'
        : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'
    }`;

  return (
    <div className="flex min-h-dvh">
      {/* Enlace para saltar la navegación con teclado */}
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-acento px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>

      {!esMovil && (
        <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-borde bg-superficie/70 px-3 py-4 backdrop-blur">
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <Logo tamano={34} />
            <div className="leading-tight">
              <p className="font-titulos text-[15px] font-extrabold">MyOrganization</p>
              <p className="text-xs font-semibold text-texto-tenue">Schedule</p>
            </div>
          </div>
          <nav
            aria-label={t.nav.principal}
            className="flex flex-1 flex-col gap-0.5 overflow-y-auto"
          >
            {PRINCIPALES.map((e) => (
              <NavLink key={e.ruta} to={e.ruta} className={claseEnlace}>
                <e.icono size={18} aria-hidden />
                {e.texto}
              </NavLink>
            ))}
            <div className="my-3 h-px bg-borde" />
            {SECUNDARIOS.map((e) => (
              <NavLink key={e.ruta} to={e.ruta} className={claseEnlace}>
                <e.icono size={18} aria-hidden />
                {e.texto}
                {e.ruta === '/avisos' && <Insignia n={graves} />}
              </NavLink>
            ))}
          </nav>
          <MiniContador />
          <div className="mt-3 flex items-center gap-2 border-t border-borde px-2 pt-3">
            {usuario?.foto ? (
              <img
                src={usuario.foto}
                alt=""
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-acento/15 text-sm font-bold text-acento">
                {(usuario?.nombre ?? '?').charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{usuario?.nombre}</p>
              <p className="truncate text-xs text-texto-tenue">{usuario?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => poner({ mostrarAtajos: true })}
              className="grid h-8 w-8 place-items-center rounded-md text-texto-tenue hover:bg-superficie-2"
              aria-label={t.atajos.titulo}
              title={t.atajos.titulo}
            >
              <Keyboard size={16} />
            </button>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {esMovil && (
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-borde bg-fondo/85 px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 backdrop-blur">
            <Logo tamano={28} />
            <span className="font-titulos text-base font-extrabold">{t.app.nombreCorto}</span>
            <div className="ml-auto flex items-center gap-1">
              <MiniContador compacto />
              <button
                type="button"
                onClick={() => navegar('/avisos')}
                className="relative grid h-9 w-9 place-items-center rounded-full text-texto-suave hover:bg-superficie-2"
                aria-label={`${t.nav.avisos} (${graves})`}
              >
                <Bell size={19} />
                {graves > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-peligro" />
                )}
              </button>
            </div>
          </header>
        )}

        <main
          id="contenido"
          className={`flex-1 ${esMovil ? 'px-4 pt-4 pb-28' : 'px-6 py-6 lg:px-8'}`}
        >
          <motion.div
            key={ubicacion.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[1400px]"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Panel fijo de Hoy (pantallas grandes) */}
      {esGrande && !enHoy && (
        <AnimatePresence initial={false}>
          {mostrarPanelHoy ? (
            <motion.aside
              key="panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="sticky top-0 h-dvh shrink-0 overflow-hidden border-l border-borde bg-superficie/60 backdrop-blur"
              aria-label={t.nav.hoy}
            >
              <div className="desplazable h-full w-[340px] overflow-y-auto p-4">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => poner({ panelHoy: false })}
                    className="grid h-8 w-8 place-items-center rounded-md text-texto-tenue hover:bg-superficie-2"
                    aria-label={t.nav.cerrarHoy}
                  >
                    <PanelRightClose size={17} />
                  </button>
                </div>
                <PanelHoy compacto />
              </div>
            </motion.aside>
          ) : (
            <motion.button
              key="abrir"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => poner({ panelHoy: true })}
              className="fixed top-4 right-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-borde bg-superficie shadow-media hover:bg-superficie-2"
              aria-label={t.nav.abrirHoy}
              title={t.nav.abrirHoy}
            >
              <PanelRightOpen size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* Botón flotante y hoja de Hoy en móvil y tablet */}
      {!esGrande && !enHoy && (
        <button
          type="button"
          onClick={() => poner({ hojaHoy: true })}
          className={`fixed right-4 z-30 grid h-12 w-12 place-items-center rounded-full degradado-marca text-white shadow-elevada ${
            // En el calendario móvil hay una hoja de etiquetas abajo: subimos el botón por encima
            esMovil
              ? ubicacion.pathname.startsWith('/calendario') ||
                ubicacion.pathname.startsWith('/semana')
                ? 'bottom-36'
                : 'bottom-24'
              : 'bottom-6'
          }`}
          aria-label={t.nav.abrirHoy}
        >
          <CalendarCheck size={20} />
        </button>
      )}
      <Modal
        abierto={hojaHoy}
        alCerrar={() => poner({ hojaHoy: false })}
        titulo={t.nav.hoy}
        ancho="md"
      >
        <PanelHoy compacto />
      </Modal>

      {/* Navegación inferior en móvil */}
      {esMovil && (
        <nav
          aria-label={t.nav.principal}
          className="pb-seguro fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/92 backdrop-blur"
        >
          <div className="grid grid-cols-5">
            {MOVIL.map((e) => (
              <NavLink
                key={e.ruta}
                to={e.ruta}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-acento' : 'text-texto-tenue'}`
                }
              >
                <e.icono size={21} aria-hidden />
                {e.texto}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMenuMas(true)}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-texto-tenue"
            >
              <Ellipsis size={21} aria-hidden />
              {t.nav.mas}
            </button>
          </div>
        </nav>
      )}
      <Modal abierto={menuMas} alCerrar={() => setMenuMas(false)} titulo={t.nav.mas} ancho="sm">
        <div className="grid grid-cols-3 gap-2">
          {[PRINCIPALES[4], PRINCIPALES[5], ...SECUNDARIOS].map((e) => (
            <NavLink
              key={e.ruta}
              to={e.ruta}
              onClick={() => setMenuMas(false)}
              className="flex flex-col items-center gap-1.5 rounded-lg bg-superficie-2 p-3 text-center text-xs font-semibold text-texto-suave hover:text-texto"
            >
              <e.icono size={22} className="text-acento" aria-hidden />
              {e.texto}
            </NavLink>
          ))}
        </div>
      </Modal>

      <EditorBloque />
      <EditorTarea />
      <DialogoMoverA />
      <DialogoAtajos />
    </div>
  );
}
