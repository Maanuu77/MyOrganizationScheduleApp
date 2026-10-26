# DECISIONES

Decisiones tomadas durante el desarrollo cuando la especificación no las definía, con su motivo. Están agrupadas por área.

## Entorno y stack

- **Versiones**: se usan las últimas estables en el momento de construir la app (octubre de 2026): React 19, Vite 8, TypeScript 6, Tailwind CSS 4, React Router 8, Zustand 5, Firebase 13, Motion 14, Recharts 3, date-fns 4, Vitest 5, ESLint 10. La especificación pedía "React 18+", así que React 19 cumple.
- **Node**: el equipo no tenía Node instalado; se descargó Node 24 LTS portátil desde nodejs.org (comprobando el checksum). Las Cloud Functions usan Node 22, que es la versión estable más reciente admitida por Firebase.
- **Tailwind 4** se configura desde CSS (`@theme`), sin `tailwind.config.js`. Los tokens están en un único archivo: [`src/tema.css`](src/tema.css).
- **Tipografías** incluidas con `@fontsource-variable` (Inter para el texto y Plus Jakarta Sans para títulos), sin CDN.
- **Librerías añadidas** además de las pedidas:
  - `workbox-precaching`, `workbox-routing` y `workbox-core`: las usa el service worker propio (son las mismas que usa `vite-plugin-pwa` por dentro).
  - `@firebase/rules-unit-testing` y `firebase-tools` (desarrollo): para probar las reglas con el emulador y desplegar.
  - `jsdom`, `globals`, `eslint-config-prettier`, `typescript-eslint` (desarrollo): configuración estándar de tests y lint.
- **Sin librería de diálogos**: el `Modal` (con trampa de foco, Escape y hoja deslizable en móvil) está hecho a mano para no añadir dependencias y para que se pueda leer y entender.

## Estructura

- `src/` es plana como se pidió. Para que siga siendo fácil de seguir con tantos archivos, los nombres llevan prefijos (`Pantalla*`, `Vista*`, `Editor*`, `use*`, `almacen*`) y la lógica pura va en archivos en minúscula. Los tests (`*.test.ts`) están junto al módulo que prueban.
- Las pruebas de reglas viven en `pruebas-reglas/` porque necesitan el emulador y se ejecutan aparte.
- `scripts/generar-iconos.mjs` dibuja los PNG de la PWA a partir del diseño del logotipo, sin dependencias.

## Modelo de datos

- **Fechas**: los instantes se guardan como **milisegundos UTC** (`inicioMs`, `fireAt`…) porque son fáciles de comparar, ordenar y consultar, y no dependen del SDK. Los días sin hora se guardan como `'YYYY-MM-DD'` y las horas como `'HH:mm'`. Cada evento guarda la `zonaHoraria` con que se creó. La excepción es el contador, que usa `serverTimestamp()` como pide la especificación.
- **Colecciones añadidas** a las de la especificación: `weekTemplates` (plantillas semanales). El perfil va en el documento raíz `users/{uid}` y los ajustes en `users/{uid}/settings/general`. La integración de Google en `integrations/googleCalendar`.
- **Excepciones de recurrencia** con id determinista `eventoId_inicioOriginal`, así cada ocurrencia tiene como mucho una excepción. Las excepciones guardan cancelación, cambios (hora, título, notas, etiqueta) y si se ha completado esa ocurrencia.
- **Recurrencia propia** (`recurrencia.ts`) en lugar de RRULE: más fácil de entender y suficiente para lo pedido (diaria, semanal con días, mensual por días del mes o "primer/último lunes", intervalo y fin por fecha o número de veces).
- **"Este y los siguientes"** corta la serie original el día anterior y crea una serie nueva desde esa ocurrencia (reparte el número de veces si la serie tenía límite).
- **Si un cambio no cabe en una excepción** (cambiar el tipo, la regla, el ciclo…), no se ofrece "solo este": solo "este y siguientes" o "todos".
- **Tareas repetidas**: al completar una, se crea la siguiente con la fecha que toque (como hacen la mayoría de gestores de tareas), en vez de mantener una serie infinita.
- **Etiquetas borradas**: los bloques, tareas y registros que las usaban conservan el id, pero se muestran "sin etiqueta". Archivar es la opción recomendada.
- **Los datos se cargan enteros en memoria** (eventos, tareas, rutinas…) para uso personal; los registros de sesión, solo de los últimos 800 días (suficiente para comparar un año con el anterior).

## Calendario

- **Zona horaria**: el calendario se pinta en la hora del dispositivo (como cualquier calendario). La zona de Ajustes se usa para Google Calendar y se muestra un aviso si no coincide con la del dispositivo.
- **Crear arrastrando**: con ratón se arrastra sobre el hueco; en pantallas táctiles basta con tocar el hueco (arrastrar en vertical se reserva para desplazarse por el día). Las etiquetas, tareas y bloques se arrastran manteniendo pulsado 250 ms.
- **Alternativa al arrastre**: cada bloque tiene "Mover a…" (en su editor) y cada etiqueta/tarea del panel tiene un botón "Crear sesión en… / Planificar en…".
- **Al soltar una etiqueta** se crea la sesión con la duración por defecto de la etiqueta y el **primer ciclo guardado** (si hay). Aparece un aviso con "Editar" para ajustarla al momento; también se puede redimensionar arrastrando el borde.
- **Duplicar** crea una copia suelta justo a continuación del bloque original.
- **Bloques protegidos**: pisar uno (al crear, mover, redimensionar, aplicar una plantilla o soltar una etiqueta) pide confirmación explícita. Es lo único que la app interrumpe.
- **Plantilla semanal**: "aplicar a las próximas N semanas" empieza en la semana actual. Los bloques creados llevan `plantillaId`, lo que permite "Quitar bloques aplicados" (solo los futuros).
- **Rutinas en el calendario**: si una rutina tiene hora y "Mostrar en el calendario", la app mantiene un evento recurrente de tipo "rutina" sincronizado con su programación.
- **Pasos de arrastre**: 15 minutos.

## Contador

- **Avance de fase**: lo hace el primer dispositivo que detecta que la fase terminó, con una transacción que comprueba la versión del documento. Si todos estaban dormidos, al volver se calcula cuántas fases pasaron y se pone al día (la nueva fase empieza exactamente cuando acabó la anterior, no cuando alguien abre la app).
- **Avance automático configurable**: por defecto las fases pasan solas; se puede desactivar para que espere a "Seguir".
- **Desfase de reloj**: se mide escribiendo un `serverTimestamp` en el documento del dispositivo y leyéndolo del servidor (se supone que la marca se puso a mitad del viaje de ida y vuelta). Se repite cada 10 minutos.
- **Fases personalizadas** cuentan como tiempo de foco en las estadísticas (los descansos son los dos tipos de descanso).
- **Aviso de invasión**: si la fase actual va a pisar un bloque protegido o un evento, se muestra un aviso con el botón "Cortar fase ahí".
- **Notificaciones del contador**: se preparan recordatorios en el servidor para todos los cambios de fase que quedan (o solo el siguiente si el avance automático está desactivado). Los de la app y los del servidor comparten la etiqueta `mos-contador`, así una notificación sustituye a la otra en vez de duplicarse.
- **Rutinas de estudio**: lanzan el contador con su ciclo y se marcan como hechas al guardar la sesión.

## Notificaciones y recordatorios

- **La app genera los recordatorios** de los próximos **14 días** cada vez que cambian datos o ajustes, y aplica solo las diferencias (ids deterministas → sin duplicados). Se regeneran cada vez que se abre la app, así que si no la abres en más de 14 días dejan de llegar avisos de las recurrencias lejanas.
- **Resumen diario y avisos de sobrecarga**: se generan con el contenido calculado en el momento de prepararlos (no en el momento de enviarlos). Se actualizan cada vez que cambias algo.
- **Silencio nocturno**: no se generan recordatorios en esa franja, salvo los del contador (si estás estudiando, quieres saber cuándo parar).
- **Ajuste por dispositivo**: cada dispositivo puede desactivar tipos concretos; la Cloud Function lo respeta al enviar.
- **Mensajes "solo datos"**: la función envía datos y es el service worker quien muestra la notificación, para controlar icono, vibración y agrupación. En Android las notificaciones llegan al reloj por el espejo de notificaciones.
- **Sin Blaze**: con la app abierta (incluida una pestaña en segundo plano) los avisos los muestra la propia app; sin pestaña abierta no hay forma de avisar sin servidor.
- **Avisos con retraso**: si la función no pudo enviar un aviso en 15 minutos, se descarta (no tiene sentido avisar de algo que ya pasó).
- **Región de las funciones**: `europe-west1`. Se puede cambiar en `functions/src/index.ts`.

## Avisos de sobrecarga

- Se calculan en el cliente para los próximos 14 días (no se guardan).
- Dos bloques protegidos que se solapan no generan aviso (por ejemplo "Sueño" y "Tiempo personal").
- Una tarea con fecha límite y sin estimación avisa si no tiene ningún bloque vinculado antes de la fecha; con estimación, si el tiempo vinculado no llega a la estimación.

## Estadísticas

- **Planificado** = sesiones de estudio en el calendario; **real** = registros del contador.
- **Cumplimiento de bloques**: de los bloques ya pasados (no protegidos, no de todo el día), los marcados como hechos.
- **Racha**: días seguidos con algún foco. Hoy sin foco todavía no rompe la racha.
- **Mapa de calor**: los niveles se calculan por cuartiles de tus propios días con actividad, para que se adapte a tu ritmo.
- **CSV** con separador `;` y BOM, para que Excel en español lo abra bien.

## Google Calendar

- **Alcance**: importación de un calendario elegido y exportación de los bloques a otro calendario elegido, en una ventana de 30 días atrás y 90 adelante, con el botón **Sincronizar ahora**.
- **Permisos**: `calendar.events` (pedido) más `calendar.calendarlist.readonly` para poder listar los calendarios y elegirlos.
- **Sin duplicados**: los importados tienen id de documento determinista (`gcal-…`) y guardan `origenGoogle`; los exportados llevan propiedades extendidas privadas `mosApp=1` y `mosId=<ocurrencia>`. Las ocurrencias de eventos recurrentes se exportan como eventos sueltos.
- **Conflictos**: gana el último cambio comparando la fecha de actualización de cada lado. Si cambias en Google un evento exportado, el cambio vuelve a la app (como excepción si es recurrente).
- **Borrados**: lo borrado en un lado se borra en el otro dentro de la ventana sincronizada.
- **Sin sincronización automática en segundo plano**: en el navegador Firebase solo entrega un token de acceso de 1 hora y no hay token de refresco. Hacerlo automático requeriría un flujo OAuth en servidor con token de refresco guardado de forma segura y una función programada; queda como mejora futura. Cuando el token caduca, la app pide volver a conectar.

## Diseño

- **Identidad propia**: degradado violeta → coral, logotipo de anillo de progreso con un punto central (una sesión de foco en marcha), tarjetas con degradado sutil y sombras teñidas del color de marca.
- **Color de acento** configurable; el coral del degradado se mantiene fijo como segunda nota de marca.
- **Densidad** cambia el alto de la hora en el calendario y el relleno de las tarjetas.
- **Navegación**: barra lateral en escritorio; en móvil, barra inferior con Hoy, Calendario, Foco, Tareas y "Más". El panel de Hoy es fijo a partir de 1280 px y una hoja en pantallas menores (botón flotante).
- **Atajos**: `N` nuevo, `T` hoy, flechas, `D/S/M/A` para las vistas, `Espacio` pausa el contador y `?` muestra la ayuda.
- **Movimiento reducido**: `MotionConfig reducedMotion="user"` más una regla CSS que anula animaciones y transiciones.
- **Sin desplazamiento lateral**: con textos largos las rejillas crecían hasta el ancho del texto (un hijo de `grid` no encoge por debajo de su contenido) y la pantalla del móvil se ensanchaba. Se corrige en `tema.css` con tres reglas globales: `min-width: 0` en los hijos de `.grid`, `overflow-wrap: break-word` para partir enlaces y palabras sin espacios, y `overflow-x: clip` en `html`/`body` como red de seguridad. Los selectores de opciones (`Segmentado`) pasan a una segunda línea en vez de ocultar opciones con scroll.

## Seguridad y privacidad

- Reglas estrictas por colección con `hasOnly`, tipos y tamaños máximos; todo lo no listado está prohibido. Probadas con el emulador.
- `localStorage` solo guarda preferencias de interfaz: vista del calendario, panel de Hoy abierto, copia del tema para evitar el parpadeo y el id aleatorio del dispositivo.
- **Borrar cuenta** pide volver a iniciar sesión (Firebase lo exige), borra todas las colecciones del usuario y después la cuenta.
- **Importar** una copia JSON añade/sobrescribe documentos por id y pasa por las mismas reglas de validación.

## App Android (este repositorio)

- **Capacitor 8** en lugar de reescribir la app: se reutiliza el 100 % del código y de los tests de la web. Lo exclusivo del móvil está aislado en `src/nativo.ts` y cada llamada comprueba `esNativo`, así que el mismo código sigue funcionando en el navegador.
- **Firebase 12** (no 13 como la web) porque el plugin de inicio de sesión nativo `@capacitor-firebase/authentication` aún declara compatibilidad con la 12. La API que usa la app es la misma.
- **Inicio de sesión**: el plugin abre el selector de cuentas de Google del móvil y devuelve un `idToken`; con él se inicia sesión en el SDK web de Firebase (`skipNativeAuth: true`). Así toda la app sigue usando un único SDK. En Android, Auth se inicializa con `initializeAuth` y persistencia IndexedDB (sin el mecanismo de ventanas emergentes, que no existe en el WebView).
- **Notificaciones**: en lugar de push (FCM + Cloud Functions + Blaze), el móvil programa **notificaciones locales** con `@capacitor/local-notifications`:
  - Recordatorios (inicio de bloque, rutinas, fechas límite, resumen diario, sobrecarga): se recalculan con la misma función que la web y se reprograman todos cada vez que cambian los datos (máximo 240).
  - Contador: cada móvil programa sus propias alarmas de cambio de fase al ver cambiar el documento del contador, corrigiendo el desfase con el reloj del servidor. Así avisan todos los móviles con la app instalada, aunque el cambio se haya hecho en otro dispositivo.
  - Ids numéricos: se calculan con un hash del id de texto; cada grupo (recordatorios / contador) tiene su rango para poder cancelarlo por separado.
  - Android 12+: se pide el permiso de **alarmas exactas** desde Ajustes; sin él los avisos pueden llegar unos minutos tarde.
- **Service worker**: no se registra en la app (los archivos ya van dentro del APK). La compilación lo sigue generando porque comparte configuración con la web; no molesta.
- **Barras del sistema**: se usa `SystemBars` del núcleo de Capacitor 8 (modo «css», con `viewport-fit=cover`); la cabecera móvil deja el hueco de la barra de estado con `env(safe-area-inset-top)`.
- **Exportar**: en el WebView no hay descargas; se escribe el archivo en la caché y se abre el menú de compartir.
- **Iconos**: icono adaptativo vectorial (degradado de la marca + anillo), versión monocroma para Android 13+, PNG para Android 7 y un icono de notificación propio.
- **Compilación**: en GitHub Actions (el PC no tiene Android SDK). Cada ejecución sube `versionCode` con el número de ejecución y publica un _release_ con el APK.
- **Firma**: clave RSA 4096 propia en `firma/` (fuera de git), registrada en Firebase con sus huellas SHA-1 y SHA-256. En CI llega como secreto en base64.
- **`google-services.json`**: se guarda como secreto y no en el repositorio, por coherencia con la regla de no subir configuración de Firebase (aunque Google lo considera público).
- **Paquete**: `com.maanuu77.myorganizationschedule`.
