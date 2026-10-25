// Pantalla de inicio de sesión con Google.
import { useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, ChartColumn, Lock, Timer } from 'lucide-react';
import { Logo } from './Logo';
import { Boton } from './Boton';
import { entrarConGoogle } from './useSincronizacion';
import { t } from './textos';

const ICONOS = [CalendarDays, Timer, ChartColumn];

/** Logotipo de Google (colores oficiales del botón de acceso). */
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export function PantallaAcceso() {
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async () => {
    setEntrando(true);
    setError(null);
    try {
      await entrarConGoogle();
    } catch (e) {
      console.error(e);
      setError(t.acceso.error);
      setEntrando(false);
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      {/* Fondo decorativo con los colores de la marca */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-acento/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 -bottom-40 h-[26rem] w-[26rem] rounded-full bg-acento-2/20 blur-3xl"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="tarjeta relative w-full max-w-md p-8 shadow-elevada"
      >
        <div className="mb-6 flex items-center gap-3">
          <Logo tamano={52} />
          <div>
            <p className="font-titulos text-lg leading-tight font-extrabold">MyOrganization</p>
            <p className="font-titulos text-lg leading-tight font-extrabold text-texto-suave">
              Schedule
            </p>
          </div>
        </div>
        <h1 className="text-3xl font-extrabold">
          <span className="texto-degradado">{t.acceso.titulo}</span>
        </h1>
        <p className="mt-2 text-sm text-texto-suave">{t.acceso.subtitulo}</p>

        <ul className="mt-6 space-y-3">
          {t.acceso.puntos.map((punto, i) => {
            const Icono = ICONOS[i];
            return (
              <motion.li
                key={punto}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.1 }}
                className="flex items-center gap-3 text-sm font-medium"
              >
                <span className="grid h-8 w-8 place-items-center rounded-md bg-acento/12 text-acento">
                  <Icono size={16} aria-hidden />
                </span>
                {punto}
              </motion.li>
            );
          })}
        </ul>

        <Boton
          variante="secundario"
          tamano="lg"
          className="mt-8 w-full justify-center"
          onClick={entrar}
          cargando={entrando}
          icono={<LogoGoogle />}
        >
          {entrando ? t.acceso.entrando : t.acceso.entrarGoogle}
        </Boton>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-peligro">
            {error}
          </p>
        )}
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-texto-tenue">
          <Lock size={12} aria-hidden /> {t.acceso.privacidad}
        </p>
      </motion.div>
    </main>
  );
}
