// Logotipo de la app en SVG (el mismo diseño que public/logo.svg).
import { useId } from 'react';

interface Props {
  tamano?: number;
  className?: string;
}

export function Logo({ tamano = 36, className }: Props) {
  // Id único por instancia: si hay varios logotipos en pantalla, cada uno usa su degradado
  const id = `logo-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6D5CF0" />
          <stop offset="1" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id})`} />
      <path
        d="M256 106 A150 150 0 1 1 106 256"
        fill="none"
        stroke="#fff"
        strokeWidth="44"
        strokeLinecap="round"
      />
      <circle cx="256" cy="256" r="40" fill="#fff" />
    </svg>
  );
}
