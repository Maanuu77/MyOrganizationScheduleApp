// Estado de las notificaciones en la app Android: permiso para mostrar avisos y permiso de
// alarmas exactas (sin él, Android puede retrasar los avisos varios minutos).
import { useEffect, useState } from 'react';
import { AlarmClock, Smartphone } from 'lucide-react';
import { Boton } from './Boton';
import {
  alarmasExactasPermitidas,
  abrirAjusteAlarmasExactas,
  tienePermisoNotificaciones,
} from './nativo';
import { t } from './textos';

export function AjustesNotificacionesNativas({ alActivar }: { alActivar: () => Promise<void> }) {
  const [permiso, setPermiso] = useState<boolean | null>(null);
  const [exactas, setExactas] = useState<boolean | null>(null);

  const comprobar = () => {
    void tienePermisoNotificaciones().then(setPermiso);
    void alarmasExactasPermitidas().then(setExactas);
  };

  // Volvemos a comprobar al regresar de los ajustes del sistema
  useEffect(() => {
    comprobar();
    document.addEventListener('visibilitychange', comprobar);
    return () => document.removeEventListener('visibilitychange', comprobar);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-superficie-2 p-3">
        <Smartphone size={18} className="text-acento" aria-hidden />
        <span className="flex-1 text-sm font-semibold">{t.ajustes.esteDispositivo}</span>
        {permiso ? (
          <span className="text-sm font-semibold text-exito">{t.ajustes.dispositivoActivo}</span>
        ) : (
          <Boton
            variante="primario"
            tamano="sm"
            onClick={async () => {
              await alActivar();
              comprobar();
            }}
          >
            {t.ajustes.activarDispositivo}
          </Boton>
        )}
      </div>
      {permiso && exactas === false && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-aviso/40 bg-aviso/10 p-3">
          <AlarmClock size={18} className="text-aviso" aria-hidden />
          <p className="flex-1 text-sm">{t.ajustes.alarmasExactasTexto}</p>
          <Boton variante="secundario" tamano="sm" onClick={() => abrirAjusteAlarmasExactas()}>
            {t.ajustes.alarmasExactas}
          </Boton>
        </div>
      )}
      <p className="text-xs text-texto-tenue">{t.ajustes.notificacionesNativasAyuda}</p>
    </div>
  );
}
