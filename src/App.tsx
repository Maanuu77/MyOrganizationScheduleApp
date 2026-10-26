// Componente raíz: decide qué mostrar (configuración pendiente, acceso, bienvenida o la app)
// y define las rutas. Cada pantalla se carga bajo demanda (lazy) para que la primera carga sea ligera.

import { Suspense, lazy, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { firebaseConfigurado } from './firebase';
import { useDatos } from './almacenDatos';
import { useSesion, useSincronizacion } from './useSincronizacion';
import { useTema } from './useTema';
import { Diseno } from './Diseno';
import { PantallaCarga } from './PantallaCarga';
import { PantallaConfiguracionPendiente } from './PantallaConfiguracionPendiente';
import { CapaGlobal } from './CapaGlobal';
import { LimiteErrores } from './LimiteErrores';
import type { PantallaInicio } from './tipos';

/** Carga perezosa de un componente exportado con nombre. */
function perezoso<T extends Record<string, unknown>>(cargar: () => Promise<T>, nombre: keyof T) {
  return lazy(async () => ({ default: (await cargar())[nombre] as ComponentType }));
}

const PantallaAcceso = perezoso(() => import('./PantallaAcceso'), 'PantallaAcceso');
const PantallaBienvenida = perezoso(() => import('./PantallaBienvenida'), 'PantallaBienvenida');
const PantallaHoy = perezoso(() => import('./PantallaHoy'), 'PantallaHoy');
const PantallaCalendario = perezoso(() => import('./PantallaCalendario'), 'PantallaCalendario');
const PantallaSemana = perezoso(() => import('./PantallaCalendario'), 'PantallaSemana');
const PantallaTareas = perezoso(() => import('./PantallaTareas'), 'PantallaTareas');
const PantallaFoco = perezoso(() => import('./PantallaFoco'), 'PantallaFoco');
const PantallaCiclos = perezoso(() => import('./PantallaCiclos'), 'PantallaCiclos');
const PantallaRutinas = perezoso(() => import('./PantallaRutinas'), 'PantallaRutinas');
const PantallaEstadisticas = perezoso(
  () => import('./PantallaEstadisticas'),
  'PantallaEstadisticas',
);
const PantallaEtiquetas = perezoso(() => import('./PantallaEtiquetas'), 'PantallaEtiquetas');
const PantallaAvisos = perezoso(() => import('./PantallaAvisos'), 'PantallaAvisos');
const PantallaAjustes = perezoso(() => import('./PantallaAjustes'), 'PantallaAjustes');
const PantallaPlantilla = perezoso(() => import('./PantallaPlantilla'), 'PantallaPlantilla');

const RUTA_INICIO: Record<PantallaInicio, string> = {
  hoy: '/hoy',
  semana: '/semana',
  calendario: '/calendario',
  tareas: '/tareas',
  rutinas: '/rutinas',
  estadisticas: '/estadisticas',
};

export function App() {
  if (!firebaseConfigurado) return <PantallaConfiguracionPendiente />;
  return <AppConFirebase />;
}

function AppConFirebase() {
  useSesion();
  useSincronizacion();
  useTema();
  const cargandoSesion = useDatos((s) => s.cargandoSesion);
  const usuario = useDatos((s) => s.usuario);
  const datosListos = useDatos((s) => s.datosListos);
  const onboarding = useDatos((s) => s.ajustes.onboardingCompletado);
  const inicio = useDatos((s) => s.ajustes.pantallaInicio);

  let contenido;
  if (cargandoSesion) contenido = <PantallaCarga />;
  else if (!usuario) contenido = <PantallaAcceso />;
  else if (!datosListos) contenido = <PantallaCarga />;
  else if (!onboarding) contenido = <PantallaBienvenida />;
  else {
    contenido = (
      <Routes>
        <Route element={<Diseno />}>
          <Route index element={<Navigate to={RUTA_INICIO[inicio] ?? '/hoy'} replace />} />
          <Route path="hoy" element={<PantallaHoy />} />
          <Route path="calendario" element={<PantallaCalendario />} />
          <Route path="semana" element={<PantallaSemana />} />
          <Route path="tareas" element={<PantallaTareas />} />
          <Route path="foco" element={<PantallaFoco />} />
          <Route path="ciclos" element={<PantallaCiclos />} />
          <Route path="rutinas" element={<PantallaRutinas />} />
          {/* Enlace de los avisos antiguos: las rutinas ya se empiezan desde su tarjeta */}
          <Route path="rutinas/:id/empezar" element={<Navigate to="/rutinas" replace />} />
          <Route path="estadisticas" element={<PantallaEstadisticas />} />
          <Route path="etiquetas" element={<PantallaEtiquetas />} />
          <Route path="avisos" element={<PantallaAvisos />} />
          <Route path="plantilla" element={<PantallaPlantilla />} />
          <Route path="ajustes" element={<PantallaAjustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <LimiteErrores>
      <Suspense fallback={<PantallaCarga />}>{contenido}</Suspense>
      <CapaGlobal />
    </LimiteErrores>
  );
}
