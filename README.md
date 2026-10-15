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
- `LEGACY_OWNER_USERNAME`: los recordatorios creados antes de las cuentas pasan a este usuario en su primer inicio de sesión. `TELEGRAM_CHAT_ID` sigue siendo su chat si no tiene uno propio.

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
