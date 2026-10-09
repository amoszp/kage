# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:24-alpine
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/backend/dist ./dist
COPY frontend /app/frontend

ENV NODE_ENV=production
EXPOSE 4477
CMD ["node", "dist/index.js"]
