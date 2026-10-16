<p align="center">
  <img src="frontend/icons/icon-512.png" width="120" alt="Kage icon" />
</p>

<h1 align="center">Kage</h1>

<p align="center">
  Recordatorios puntuales con formulario estructurado y entrega por Telegram.
</p>

## Qué hace

- Crea un recordatorio con fecha, hora y una o varias alertas.
- Cuentas de usuario: cada persona crea su cuenta desde la app (funciona al instante), entra con su usuario y contraseña y solo ve sus recordatorios. Un administrador puede ver los de cualquier usuario y bloquear cuentas.
- A la hora de cada alerta, un bot de Telegram envía el aviso al chat del dueño del recordatorio.
- Vista de calendario mensual y lista de próximos / pasados, con archivado.
- Marca un recordatorio como hecho: pasa a pasados aunque su fecha no haya llegado y deja de enviar alertas. Se puede reabrir; las alertas que vencieron mientras estaba hecho se omiten.
- PWA instalable: se añade a la pantalla de inicio y se abre como una app nativa.

## Desarrollo local

```
cd backend
npm install
cp .env.example .env   # rellenar Telegram y las variables de cuentas
npm run dev
```

Abre `http://localhost:4477`: el backend sirve la PWA de `../frontend` y expone la API en `/api/reminders`. En local, pon `COOKIE_SECURE=false` (sin https el navegador no guarda la cookie de sesión).

## Cuentas

Kage no guarda contraseñas: usa un servicio de cuentas aparte (proyecto `accounts`), alcanzable solo por la red privada de Docker.

- `ACCOUNTS_URL` y `ACCOUNTS_SERVICE_TOKEN` (el mismo `SERVICE_TOKEN` del servicio de cuentas) en `backend/.env`.
- Los usuarios se crean desde la línea de comandos del servicio de cuentas. Para recibir avisos, cada usuario abre el bot de Telegram, pulsa Start y se guarda su chat: `node dist/cli.js user telegram <usuario> <chat id>`.
- `LEGACY_OWNER_USERNAME`: los recordatorios creados antes de las cuentas pasan a este usuario en su primer inicio de sesión (solo si es administrador, para que nadie pueda quedárselos registrando ese nombre). `TELEGRAM_CHAT_ID` sigue siendo su chat si no tiene uno propio.

### API

Todas las rutas de `/api/reminders` piden sesión: la cookie que pone el login o una clave de API del servicio de cuentas en `Authorization: Bearer <clave>` (para atajos y scripts).

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/auth/signup` | `{ username, password, displayName }`, crea la cuenta y pone la cookie de sesión |
| `POST` | `/api/auth/login` | `{ username, password }`, pone la cookie de sesión |
| `POST` | `/api/auth/logout` | cierra la sesión |
| `GET` | `/api/auth/me` | usuario actual (y lista de usuarios si es admin) |
| `GET` | `/api/reminders` | tus recordatorios (`?userId=` para un admin) |
| `POST` | `/api/reminders` | crea uno `{ title, date, time, alerts[] }` |
| `PUT` / `DELETE` | `/api/reminders/:id` | edita / borra |
| `POST` | `/api/reminders/:id/complete` · `/reopen` | marca hecho / reabre |
| `GET` | `/api/siri/say` · `/api/siri/answer` | conversación de voz en texto plano, ver abajo |
| `POST` | `/api/siri/reminders` | para atajos de voz: `{ title, date: "AAAA-MM-DD", time: "HH:mm", alerts, confirm }`, ver abajo |

### Atajos de voz (Siri)

`POST /api/siri/reminders` con una clave de API. Las alertas se calculan en el servidor a partir de un nombre (`alerts`):

| `alerts` | Avisos |
|---|---|
| `normal` (o vacío) | 3 días antes a las 10:00, 1 día antes a las 10:00 y 5 horas antes |
| `a la hora` | a la hora del recordatorio |
| `1 hora antes` | 1 hora antes |
| `1 día antes` | 1 día antes, a la misma hora |

Los avisos que ya hayan pasado se descartan; si no queda ninguno, se pone uno a la hora del recordatorio. Sin `confirm: true` no se guarda nada y la respuesta es `{ speak }`, la frase para leer al usuario ("…¿Lo guardo?"); con `confirm: true` se crea y responde `201`. Los errores responden `400` con `{ error, speak }`. Las horas son locales a `TZ` (en `backend/.env`).

**Conversación en texto plano** (para un atajo mínimo: solo direcciones web, sin cabeceras ni cuerpo). La clave va en `?key=` y cada respuesta es una frase en `text/plain`, también los errores (`401` con clave inválida).

- `GET /api/siri/say?key=…&text=…` con la frase entera, p. ej. "dentista el viernes a las cinco de la tarde, una hora antes". Entiende hoy / mañana / pasado mañana, días de la semana, "el 23 (de noviembre)", "20/11", "a las 5 (y media) de la tarde", "17:30", "esta noche", y los avisos dichos, tantos como se quiera ("un día antes y una hora antes", "30 minutos antes", "dos semanas antes", "media hora antes", "a la hora", "con avisos normales y …"); si no se dice ninguno, `normal`. Las horas 1–6 sin "de la mañana" se toman por la tarde. Responde la frase a confirmar ("…¿Lo guardo?"), o pregunta lo que falta ("¿A qué hora?").
- `GET /api/siri/answer?key=…&text=…` con la respuesta: "sí" guarda, "no" cancela; si faltaba el día o la hora, se completa y se guarda directamente. La pregunta abierta dura 10 minutos.

## Producción sin Docker

```
cd backend
npm run build
npm start
```

Requiere Node 22.5+ (usa el módulo nativo `node:sqlite`, sin dependencias nativas que compilar).

## Despliegue con Docker

Cada push a `main` construye la imagen con GitHub Actions y la publica en GitHub Container Registry. `docker-compose.yml` arranca esa imagen ya construida:

```
cp backend/.env.example backend/.env   # rellenar Telegram y las variables de cuentas
docker compose pull
docker compose up -d
```

- La app queda en el puerto `1106` (cambia la parte izquierda de `ports` para usar otro).
- `./data` se monta como volumen para que la base de datos SQLite sobreviva a reinicios y actualizaciones.
- El contenedor se une a la red externa `accounts` (la crea el servicio de cuentas), así que ese servicio debe estar desplegado antes.
- Con un actualizador automático de contenedores como Watchtower, cada imagen nueva se despliega sola.

La imagen usa `node:24-alpine`: compila el backend en una fase y copia la PWA estática junto a él en la imagen final, un único contenedor con un único proceso.

## Icono

`frontend/icons/` contiene el icono en vectorial (`icon.svg`, la fuente) y los PNG que usan el manifest y iOS:

- `icon-192.png` (192×192): PWA / Android.
- `icon-512.png` (512×512): PWA / splash.
- `icon-180.png` (180×180, cuadrado, sin transparencia): icono de pantalla de inicio en iOS.

## Estructura

- `backend/`: API Express + SQLite + scheduler + bot de Telegram.
- `frontend/`: PWA estática (sin build step), servida por el mismo proceso del backend.
- `mockup.html`: mockup visual original, solo de referencia.
- `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml`: imagen de un único contenedor, publicada en GHCR.
