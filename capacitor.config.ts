// Configuración de Capacitor: convierte la web compilada (dist/) en una app Android.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maanuu77.myorganizationschedule',
  appName: 'MyOrganizationSchedule',
  webDir: 'dist',
  android: {
    // La app se sirve desde https://localhost dentro del WebView
    allowMixedContent: false,
  },
  plugins: {
    // Inicio de sesión con Google nativo. skipNativeAuth: el SDK nativo solo nos da el token
    // de Google y la sesión de Firebase la crea el SDK web (el mismo que usa toda la app).
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_mos',
      iconColor: '#5B4BDB',
    },
  },
};

export default config;
