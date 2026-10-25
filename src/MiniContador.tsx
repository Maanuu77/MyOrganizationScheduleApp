// Indicador pequeño del contador en marcha (barra lateral o cabecera móvil). Lleva a la pantalla de foco.
import { Link } from 'react-router';
import { Pause, Play } from 'lucide-react';
import { useEstadoContador } from './useTemporizador';
import { relojTexto } from './fechas';
import { AnilloProgreso } from './AnilloProgreso';
import { t } from './textos';

export function MiniContador({ compacto }: { compacto?: boolean }) {
  const { activo, contador, fase, restanteMs, transcurridoMs, progreso, cicloTerminado } =
    useEstadoContador();
  if (!activo || !contador) return null;
  const pausado = contador.estado === 'pausado';
  const texto =
    contador.modo === 'cronometro'
      ? relojTexto(transcurridoMs)
      : cicloTerminado
        ? '✓'
        : relojTexto(restanteMs);
  const color = fase?.color ?? 'var(--mos-acento)';

  if (compacto) {
    return (
      <Link
        to="/foco"
        className="flex items-center gap-1.5 rounded-full border border-borde bg-superficie px-2.5 py-1 text-sm font-bold shadow-suave"
        aria-label={`${t.nav.foco}: ${texto}`}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
        <span className="numeros">{texto}</span>
      </Link>
    );
  }

  return (
    <Link
      to="/foco"
      className="tarjeta-plana mt-3 flex items-center gap-3 p-2.5 shadow-suave hover:shadow-media"
    >
      <AnilloProgreso progreso={progreso} tamano={40} grosor={5} color={color} suavidad={0.3}>
        {pausado ? <Pause size={13} /> : <Play size={13} />}
      </AnilloProgreso>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-texto-suave">
          {fase?.nombre ?? t.foco.cicloTerminado}
        </p>
        <p className="numeros text-lg leading-tight font-extrabold">{texto}</p>
      </div>
    </Link>
  );
}
