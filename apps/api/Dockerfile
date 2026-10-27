# syntax=docker/dockerfile:1
# API de Nest para probar la app completa en local (docs/despliegue.md §7). Render no usa este
# archivo: allí se construye con su runtime de Node (§3). Contexto de build: la raíz del repo.
#
# La imagen conserva las devDependencies (ts-node) para poder correr `pnpm db:migrate` y
# `pnpm db:seed:demo` dentro del contenedor, contra la misma base que usa la API.

FROM node:22-alpine AS base
# pnpm fijo: el mismo de `packageManager`, sin que intente cambiarse de versión.
ENV npm_config_manage_package_manager_versions=false CI=true
RUN npm i -g pnpm@10.33.2
WORKDIR /repo

# Solo los manifiestos primero: la capa de dependencias se reutiliza mientras no cambie el lockfile.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @blackout/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @blackout/shared build && pnpm --filter @blackout/api build

FROM build AS final
# Los seeds leen data/ (sectores y el historial de la demo).
COPY data data
WORKDIR /repo/apps/api
# Sin NODE_ENV=production: Nest no lo necesita y `db:seed:demo` se niega a correr con él (D-027).
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
