# MyOrganizationSchedule · App Android

Versión **Android** de [MyOrganizationSchedule](https://github.com/Maanuu77/MyOrganizationSchedule): el mismo calendario, contador de foco, rutinas, tareas y estadísticas, como app instalable (APK).

- Está hecha con **Capacitor**, que empaqueta el mismo código React/TypeScript de la web dentro de una app nativa.
- Usa **el mismo proyecto de Firebase** (`myorganizationschedule`), así que comparte los datos con la web en tiempo real, contador incluido.
- El backend (reglas de Firestore, índices y Cloud Functions) vive en el repositorio de la web. Este repositorio solo contiene la app.

## Qué cambia respecto a la web

| Función                   | Web                                   | App Android                                                                         |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Iniciar sesión            | Ventana emergente de Google           | Selector de cuentas del propio móvil                                                |
| Avisos con la app cerrada | Push con Cloud Functions (plan Blaze) | **Notificaciones locales programadas en el móvil, sin servidor ni Blaze**           |
| Contador                  | Sonido y vibración del navegador      | Vibración nativa, pantalla encendida mientras corre y alarma en cada cambio de fase |
| Exportar CSV / JSON       | Descarga                              | Menú de compartir de Android (Drive, correo…)                                       |
| Botón «atrás»             | —                                     | Cierra el diálogo abierto o vuelve a la pantalla anterior                           |
| Instalación               | Abrir la web e «Instalar aplicación»  | APK desde GitHub                                                                    |

Todo lo demás (pantallas, lógica, tests) es el mismo código. Las partes exclusivas del móvil están en [`src/nativo.ts`](src/nativo.ts); en el navegador ese módulo no hace nada (`esNativo` es `false`).

## Instalar la app en el móvil

1. En el móvil, entra en **GitHub → este repositorio → Releases** (inicia sesión con tu cuenta, el repo es privado).
2. Descarga el archivo `MyOrganizationSchedule-1.0.N.apk` de la última versión.
3. Ábrelo. La primera vez Android pedirá permitir **«Instalar apps desconocidas»** para el navegador o el gestor de archivos: actívalo.
4. Abre la app, entra con Google y, en **Ajustes → Notificaciones**, pulsa **«Activar en este dispositivo»**. Si aparece el aviso de **alarmas exactas**, permítelo para que los avisos lleguen a su hora.

Para actualizar, instala el APK nuevo encima: los datos están en Firebase y no se pierden.

## Cómo se compila

Cada push a `main` lanza [`.github/workflows/apk.yml`](.github/workflows/apk.yml), que:

1. Comprueba lint, tipos y tests.
2. Compila la web (`npm run build`) y la copia al proyecto Android (`npx cap sync android`).
3. Compila el APK firmado con Gradle.
4. Lo publica como _release_ `v1.0.N` y como artefacto.

### Secretos de GitHub

En **Settings → Secrets and variables → Actions** tienen que existir:

| Secreto                                             | Valor                                          |
| --------------------------------------------------- | ---------------------------------------------- |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_VAPID_KEY` | Los 7 valores del `.env` (igual que en la web) |
| `GOOGLE_SERVICES_JSON`                              | `android/app/google-services.json` en base64   |
| `MOS_KEYSTORE_BASE64`                               | `firma/mos-release.jks` en base64              |
| `MOS_KEYSTORE_PASSWORD`                             | La contraseña de `firma/LEEME-CLAVES.txt`      |

Para obtener un archivo en base64 en PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("firma\mos-release.jks"))
```

### La clave de firma

`firma/` contiene la clave con la que se firman todos los APK. **No está en git.** Haz una copia de seguridad de esa carpeta: si la pierdes, el móvil no dejará instalar una versión nueva encima de la antigua (habría que desinstalar y volver a entrar).

Su huella SHA-1 está registrada en Firebase (app Android `com.maanuu77.myorganizationschedule`); sin ese registro el inicio de sesión con Google no funciona.

## Desarrollo en el PC

```bash
npm install
```

Para trabajar en la interfaz no hace falta Android: funciona en el navegador igual que la web.

```bash
npm run dev
```

Si instalas **Android Studio**, puedes probar en un emulador o en tu móvil por USB:

```bash
npm run android:sync
```

```bash
npm run android:abrir
```

## Scripts

| Script                                            | Qué hace                                       |
| ------------------------------------------------- | ---------------------------------------------- |
| `npm run dev`                                     | Servidor de desarrollo (en el navegador)       |
| `npm run build`                                   | Compila la web en `dist/`                      |
| `npm run android:sync`                            | Compila y copia la web al proyecto Android     |
| `npm run android:abrir`                           | Abre el proyecto en Android Studio             |
| `npm run android:apk`                             | Compila el APK en el PC (requiere Android SDK) |
| `npm run lint` / `npm run typecheck` / `npm test` | Comprobaciones                                 |

## Estructura

La misma que la web (ver su README): `src/` plana con pantallas (`Pantalla*.tsx`), componentes, hooks (`use*.ts`) y lógica pura probada con Vitest. Lo nuevo:

- `src/nativo.ts`: inicio de sesión nativo, notificaciones locales, vibración, pantalla encendida, compartir y botón atrás.
- `src/AjustesNotificacionesNativas.tsx`: permisos de notificaciones y alarmas exactas.
- `capacitor.config.ts`: configuración de Capacitor.
- `android/`: proyecto Android generado por Capacitor (iconos y pantalla de arranque de la marca).
- `firma/` (fuera de git): clave de firma.

Más detalles en [DECISIONES.md](DECISIONES.md).
