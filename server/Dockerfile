FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY server/package.json server/package.json
COPY sidecar/package.json sidecar/package.json

RUN npm ci

COPY shared shared
COPY server server
COPY sidecar sidecar
COPY scripts scripts
COPY spec spec
COPY spec.md spec.md

RUN npm run generate:types && npm run build --workspace server

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server/dist/server/src/index.js"]
