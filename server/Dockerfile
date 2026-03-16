# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY app.ts server.ts ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

RUN groupadd --system nodejs \
  && useradd --system --gid nodejs --create-home --home-dir /home/nodejs nodejs \
  && mkdir -p /app/uploads \
  && chown -R nodejs:nodejs /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER nodejs
EXPOSE 8080
CMD ["node", "dist/server.js"]
