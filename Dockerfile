FROM node:22-bookworm-slim AS development
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/api/package.json apps/api/package.json
COPY --chown=node:node apps/web/package.json apps/web/package.json
COPY --chown=node:node apps/worker/package.json apps/worker/package.json
RUN npm ci
COPY --chown=node:node . .
RUN npm run db:generate
USER node
