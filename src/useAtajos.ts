// Atajos de teclado globales: n (nuevo), t (hoy), ? (ayuda).
// Las flechas y D/S/M/A los gestiona la pantalla del calendario.

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { addHours, startOfHour } from 'date-fns';
import { useUI } from './almacenUI';
import { useDatos } from './almacenDatos';

/** ¿El usuario está escribiendo o hay un diálogo abierto? Entonces no interceptamos teclas. */
export function deboIgnorarTecla(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)))
    return true;
  return !!document.querySelector('[role="dialog"]');
}

export function useAtajosGlobales(): void {
  const navegar = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (deboIgnorarTecla(e)) return;
      const ui = useUI.getState();
      if (e.key === '?') {
        e.preventDefault();
        ui.poner({ mostrarAtajos: true });
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (pathname.startsWith('/calendario') || pathname.startsWith('/semana')) {
          const inicio = addHours(startOfHour(new Date()), 1).getTime();
          const duracion = useDatos.getState().ajustes.duracionPorDefectoMin * 60_000;
          ui.poner({
            editorBloque: {
              ocurrencia: null,
              borrador: { inicioMs: inicio, finMs: inicio + duracion },
            },
          });
        } else {
          ui.poner({ editorTarea: { tarea: null } });
        }
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        if (pathname.startsWith('/calendario') || pathname.startsWith('/semana'))
          ui.poner({ fechaMs: Date.now() });
        else navegar('/hoy');
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [navegar, pathname]);
}
