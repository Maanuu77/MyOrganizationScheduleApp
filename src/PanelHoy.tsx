// Panel de "Hoy" siempre a mano: fijo en escritorio grande y como hoja en móvil.
import { capitalizar, formatear } from './fechas';
import { AgendaDelDia, AhoraYDespues, RutinasDelDia, TareasDelDia, useHoy } from './SeccionesHoy';
import { useReloj } from './useReloj';

export function PanelHoy({ compacto }: { compacto?: boolean }) {
  useReloj(); // repinta cada minuto para que "Ahora" esté al día
  const { hoy, ocurrencias } = useHoy();
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-wide text-texto-tenue uppercase">
          {capitalizar(formatear(hoy, 'EEEE'))}
        </p>
        <p className="font-titulos text-2xl font-extrabold">{formatear(hoy, "d 'de' MMMM")}</p>
      </div>
      <AhoraYDespues ocurrencias={ocurrencias} />
      <TareasDelDia compacta={compacto} />
      <RutinasDelDia />
      <AgendaDelDia ocurrencias={ocurrencias} compacta={compacto} />
    </div>
  );
}
