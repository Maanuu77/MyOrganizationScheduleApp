/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const version = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
    version: string;
  }
).version;

// Configuración de Vite: React, Tailwind y la PWA con un único service worker propio (src/sw.ts)
// que gestiona la caché de la app y las notificaciones de Firebase Cloud Messaging.
export default defineConfig({
  define: {
    __VERSION_APP__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Solo precargamos las fuentes latinas (el resto se descargan si hicieran falta)
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['logo.svg', 'favicon.svg'],
      manifest: {
        name: 'MyOrganizationSchedule',
        short_name: 'MOS',
        description:
          'Planifica tu día, tu semana y tu mes con calendario, rutinas, tareas y sesiones de foco.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f0e1a',
        theme_color: '#5b4bdb',
        categories: ['productivity', 'education'],
        icons: [
          { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/iconos/icono-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Separamos librerías grandes para que la primera carga sea más rápida.
        manualChunks(id: string) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'graficos';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Los tests de fechas se ejecutan siempre en la misma zona horaria
    env: { TZ: 'Europe/Madrid' },
  },
});
