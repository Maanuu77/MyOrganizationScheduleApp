// Captura errores de renderizado para que una pantalla rota no deje toda la app en blanco.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { t } from './textos';

interface Estado {
  error: Error | null;
}

export class LimiteErrores extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en la interfaz', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[60dvh] place-items-center p-6">
        <div className="tarjeta max-w-md text-center">
          <TriangleAlert className="mx-auto mb-3 text-peligro" size={32} aria-hidden />
          <p className="font-semibold">{t.errores.pantalla}</p>
          <p className="mt-2 text-xs break-words text-texto-tenue">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white"
          >
            {t.errores.recargar}
          </button>
        </div>
      </div>
    );
  }
}
