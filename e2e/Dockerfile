# Pruebas E2E en Docker: la imagen oficial de Playwright trae Chromium y sus dependencias del
# sistema. Fuera del pnpm workspace a propósito: así no arrastra el monorepo ni sus binarios.
FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /e2e
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["npx", "playwright", "test"]
