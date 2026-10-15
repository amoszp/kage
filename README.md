<p align="center">
  <img src="frontend/icons/icon-512.png" width="120" alt="Kage icon" />
</p>

<h1 align="center">Kage</h1>

<p align="center">
  Recordatorios puntuales con formulario estructurado y entrega por Telegram.
</p>

## Qué hace

- Crea un recordatorio con fecha, hora y una o varias alertas.
- A la hora de cada alerta, un bot de Telegram envía el aviso al chat configurado.
- Vista de calendario mensual y lista de próximos / pasados, con archivado.
- Marca un recordatorio como hecho: pasa a pasados aunque su fecha no haya llegado y deja de enviar alertas. Se puede reabrir; las alertas que vencieron mientras estaba hecho se omiten.
- PWA instalable: se añade a la pantalla de inicio y se abre como una app nativa.

## Desarrollo local

```
cd backend
npm install
cp .env.example .env   # rellenar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
npm run dev
```

Abre `http://localhost:4477`: el backend sirve la PWA de `../frontend` y expone la API en `/api/reminders`.

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
cp backend/.env.example backend/.env   # rellenar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
docker compose pull
docker compose up -d
```

- La app queda en el puerto `1106` (cambia la parte izquierda de `ports` para usar otro).
- `./data` se monta como volumen para que la base de datos SQLite sobreviva a reinicios y actualizaciones.
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
