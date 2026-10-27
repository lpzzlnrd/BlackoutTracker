# syntax=docker/dockerfile:1
# PWA servida por nginx, que además reenvía /api a la API (mismo origen: sin CORS, y el service
# worker cachea las lecturas igual que en producción). Contexto de build: la raíz del repo.
# Las VITE_* llegan como build args desde el .env de la raíz (docker-compose.yml, D-030); ningún
# .env entra al contexto. Sin las de Supabase, solo funciona /?demo=.

FROM node:22-alpine AS build
ENV npm_config_manage_package_manager_versions=false CI=true
RUN npm i -g pnpm@10.33.2
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @blackout/web...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
# Los tokens del canon y los datos de la demo se importan desde fuera de apps/web (vite.alias.ts).
COPY docs/frontend docs/frontend
COPY data data
COPY apps/web apps/web

# Valores públicos que Vite graba en el bundle (URL de Supabase y publishable key).
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_API_URL=/api
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @blackout/shared build && pnpm --filter @blackout/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
