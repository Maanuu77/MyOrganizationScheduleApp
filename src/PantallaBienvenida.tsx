// Onboarding de 3 pasos saltables: primeras etiquetas, tema y notificaciones.
// La app empieza vacía: aquí el usuario crea lo suyo (nada viene precargado).

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellRing, Check, Monitor, Moon, Plus, Sun } from 'lucide-react';
import { Logo } from './Logo';
import { Boton } from './Boton';
import { SelectorColor, PALETA } from './SelectorColor';
import { ChipEtiqueta } from './ChipEtiqueta';
import { etiquetasActivas, useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { etiquetas as dbEtiquetas, guardarAjustes } from './datos';
import {
  activarNotificaciones,
  notificacionDePrueba,
  type ResultadoActivacion,
} from './useNotificaciones';
import { t } from './textos';
import type { Tema } from './tipos';

const TOTAL = 3;

export function PantallaBienvenida() {
  const [paso, setPaso] = useState(1);
  const ajustes = useDatos((s) => s.ajustes);
  const etiquetas = useDatos((s) => s.etiquetas);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(PALETA[0]);
  const [notif, setNotif] = useState<ResultadoActivacion | null>(null);
  const [terminando, setTerminando] = useState(false);
  const activas = etiquetasActivas(etiquetas);

  const crearEtiqueta = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    setNombre('');
    // Siguiente color de la paleta para que cada etiqueta sea distinta
    setColor(PALETA[(PALETA.indexOf(color) + 3) % PALETA.length]);
    try {
      await dbEtiquetas.crear({
        nombre: limpio,
        color,
        icono: 'libro',
        duracionMin: 50,
        objetivoSemanalHoras: null,
        archivada: false,
        orden: activas.length,
      });
    } catch {
      avisar(t.comun.error, 'error');
    }
  };

  const elegirTema = (tema: Tema) =>
    guardarAjustes({ ...ajustes, tema }).catch(() => avisar(t.comun.error, 'error'));

  const terminar = async () => {
    setTerminando(true);
    try {
      await guardarAjustes({ ...useDatos.getState().ajustes, onboardingCompletado: true });
    } catch {
      avisar(t.comun.error, 'error');
      setTerminando(false);
    }
  };

  const siguiente = () => (paso < TOTAL ? setPaso(paso + 1) : void terminar());

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="tarjeta w-full max-w-lg p-7 shadow-elevada">
        <div className="mb-6 flex items-center justify-between">
          <Logo tamano={36} />
          <div className="flex items-center gap-1.5" aria-label={t.bienvenida.paso(paso, TOTAL)}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <motion.span
                key={i}
                className={`h-2 rounded-full ${i + 1 <= paso ? 'bg-acento' : 'bg-superficie-3'}`}
                animate={{ width: i + 1 === paso ? 28 : 8 }}
              />
            ))}
          </div>
        </div>
        <p className="text-xs font-bold tracking-wide text-texto-tenue uppercase">
          {t.bienvenida.paso(paso, TOTAL)}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={paso}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="min-h-[300px]"
          >
            {paso === 1 && (
              <div>
                <h1 className="mt-1 text-2xl font-extrabold">{t.bienvenida.etiquetasTitulo}</h1>
                <p className="mt-2 text-sm text-texto-suave">{t.bienvenida.etiquetasTexto}</p>
                <form
                  className="mt-5 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void crearEtiqueta();
                  }}
                >
                  <div className="flex gap-2">
                    <input
                      className="campo"
                      placeholder={t.comun.nombre}
                      aria-label={t.comun.nombre}
                      value={nombre}
                      maxLength={60}
                      onChange={(e) => setNombre(e.target.value)}
                      autoFocus
                    />
                    <Boton
                      type="submit"
                      variante="primario"
                      tamano="icono"
                      aria-label={t.comun.añadir}
                    >
                      <Plus size={18} />
                    </Boton>
                  </div>
                  <p className="text-xs text-texto-tenue">{t.bienvenida.etiquetasEjemplo}</p>
                  <SelectorColor etiqueta={t.comun.color} valor={color} alCambiar={setColor} />
                </form>
                {activas.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold text-exito">
                      {t.bienvenida.etiquetasCreadas(activas.length)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <AnimatePresence>
                        {activas.map((e) => (
                          <motion.span
                            key={e.id}
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                          >
                            <ChipEtiqueta etiqueta={e} />
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            )}

            {paso === 2 && (
              <div>
                <h1 className="mt-1 text-2xl font-extrabold">{t.bienvenida.temaTitulo}</h1>
                <p className="mt-2 text-sm text-texto-suave">{t.bienvenida.temaTexto}</p>
                <div
                  role="radiogroup"
                  aria-label={t.ajustes.tema}
                  className="mt-5 grid grid-cols-3 gap-3"
                >
                  {(
                    [
                      ['claro', Sun],
                      ['oscuro', Moon],
                      ['sistema', Monitor],
                    ] as const
                  ).map(([tema, Icono]) => (
                    <button
                      key={tema}
                      type="button"
                      role="radio"
                      aria-checked={ajustes.tema === tema}
                      onClick={() => elegirTema(tema)}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                        ajustes.tema === tema
                          ? 'border-acento bg-acento/8 shadow-media'
                          : 'border-borde hover:border-borde-fuerte'
                      }`}
                    >
                      <Icono
                        size={26}
                        className={ajustes.tema === tema ? 'text-acento' : 'text-texto-suave'}
                        aria-hidden
                      />
                      <span className="text-sm font-semibold">{t.ajustes.temas[tema]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {paso === 3 && (
              <div>
                <h1 className="mt-1 text-2xl font-extrabold">{t.bienvenida.notifTitulo}</h1>
                <p className="mt-2 text-sm text-texto-suave">{t.bienvenida.notifTexto}</p>
                <div className="mt-6 grid place-items-center gap-4 rounded-lg bg-superficie-2 p-6">
                  <motion.div
                    animate={notif ? {} : { rotate: [0, -12, 12, -8, 8, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
                    className="grid h-16 w-16 place-items-center rounded-full degradado-marca text-white shadow-media"
                  >
                    {notif === 'activadas' || notif === 'soloLocales' ? (
                      <Check size={28} />
                    ) : (
                      <BellRing size={28} />
                    )}
                  </motion.div>
                  {notif === 'activadas' || notif === 'soloLocales' ? (
                    <p className="text-sm font-semibold text-exito">
                      {t.bienvenida.notifActivadas}
                    </p>
                  ) : (
                    <Boton
                      variante="primario"
                      icono={<Bell size={16} />}
                      onClick={async () => {
                        const r = await activarNotificaciones();
                        setNotif(r);
                        if (r === 'activadas' || r === 'soloLocales') notificacionDePrueba();
                      }}
                    >
                      {t.bienvenida.notifActivar}
                    </Boton>
                  )}
                  {notif === 'denegadas' && (
                    <p className="text-center text-xs text-peligro">
                      {t.notificaciones.permisoDenegado}
                    </p>
                  )}
                  {notif === 'noSoportadas' && (
                    <p className="text-center text-xs text-texto-suave">
                      {t.bienvenida.notifNoSoportadas}
                    </p>
                  )}
                  {notif === 'soloLocales' && (
                    <p className="text-center text-xs text-texto-suave">
                      {t.notificaciones.sinVapid}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <Boton variante="fantasma" onClick={paso === 1 ? terminar : () => setPaso(paso - 1)}>
            {paso === 1 ? t.bienvenida.saltarTodo : t.comun.volver}
          </Boton>
          <div className="flex gap-2">
            {paso < TOTAL && (
              <Boton variante="fantasma" onClick={siguiente}>
                {t.comun.saltar}
              </Boton>
            )}
            <Boton variante="primario" onClick={siguiente} cargando={terminando}>
              {paso === TOTAL ? t.bienvenida.empezar : t.comun.continuar}
            </Boton>
          </div>
        </div>
      </div>
    </main>
  );
}
