# Holm — imagen única. Compila el cliente (Vite) y arranca el servidor Express,
# que sirve el SPA + /api + /auth en un solo origen (holm.acmsy.com).
FROM node:22-slim

WORKDIR /app

# 1) Dependencias (workspaces) con la lockfile — capa cacheable.
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

# 2) Código + build del cliente (-> client/dist).
COPY . .
RUN npm run build

# 3) Runtime: producción, escucha en 0.0.0.0 para que Caddy lo alcance.
ENV NODE_ENV=production
ENV HOLM_API_HOST=0.0.0.0
ENV HOLM_API_PORT=5192
EXPOSE 5192

CMD ["npm", "run", "start", "-w", "server"]
