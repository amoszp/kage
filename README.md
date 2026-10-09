# Kage

App de recordatorios ad-hoc con formulario estructurado y entrega por Telegram. Ver la nota del vault para el diseño completo.

## Desarrollo local

```
cd backend
npm install
cp .env.example .env   # rellenar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
npm run dev
```

Abre `http://localhost:4477` — el backend sirve la PWA de `../frontend` y expone la API en `/api/reminders`.

## Producción

```
cd backend
npm run build
npm start
```

Requiere Node 22.5+ (usa el módulo nativo `node:sqlite`, sin dependencias nativas que compilar).

## Despliegue con Docker

```
cp backend/.env.example backend/.env   # rellenar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
docker compose build
docker compose up -d
```

El `Dockerfile` usa `node:24-alpine`, compila el backend en una fase y copia la PWA estática junto a él en la imagen final — un único contenedor, un único proceso, como estaba decidido. El `docker-compose.yml` monta `./data` como volumen para que la base de datos SQLite sobreviva a reinicios y reconstrucciones; ajusta esa ruta a la convención de carpetas persistentes del NAS donde se despliegue antes de levantarlo ahí. Pendiente de probar un build real de Docker (no hay Docker instalado en esta máquina de desarrollo) y de confirmar que el NAS de destino corre una versión de Node compatible — no aplica si se despliega con Docker, ya que la imagen trae su propio Node 24.

## Icono de la app

`frontend/manifest.webmanifest` y `frontend/index.html` ya están cableados para tres tamaños de icono en `frontend/icons/`:

- `icon-192.png` (192×192) — PWA / Android.
- `icon-512.png` (512×512) — PWA / splash.
- `icon-180.png` (180×180, cuadrado, sin esquinas redondeadas ni transparencia) — icono de pantalla de inicio en iOS.

En cuanto exista el logo, basta con colocar esos tres archivos con esos nombres exactos en `frontend/icons/` — no hace falta tocar código.

## Estructura

- `backend/` — API Express + SQLite + scheduler + bot de Telegram.
- `frontend/` — PWA estática (sin build step), servida por el mismo proceso del backend.
- `mockup.html` — mockup visual original, de referencia únicamente.
- `Dockerfile`, `docker-compose.yml` — build de un único contenedor, listos para desplegar cuando el NAS de destino esté decidido.
