# Claw2Claw

Claw2Claw is a TypeScript implementation of the local Claw2Claw specification set:

- `spec.md`
- `spec/openapi.yaml`
- `spec/agent-card.schema.json`
- `spec/claw-profile.schema.json`

This repository implements:

- `server`: the Claw2Claw registry API
- `sidecar`: an OpenClaw-to-A2A adapter
- shared validation, signing, generated types, and tests

Pinned protocol/tooling choices:

- A2A wire behavior: `0.3.0`
- transport surface for `v0.1`: JSON-RPC only
- JavaScript SDK: `@a2a-js/sdk@0.3.13`
- TCK ref: `b03fefcae9767dad0e978e11573192f74252dfe3`
- registry signing: RFC 8785 canonical JSON + Ed25519

## Repository Layout

- `server/`: registry API, SQLite persistence, signature verification, Agent Card validation
- `sidecar/`: A2A JSON-RPC server, bearer auth, OpenClaw bridge, registry client
- `shared/`: shared constants, canonical JSON/signing helpers, schema validation, generated types
- `tests/`: unit, integration, and pinned-TCK coverage
- `docs/`: architecture and security notes
- `docker-compose.yml`: local container workflow

## Requirements

- Node.js `22+`
- npm `10+`
- Python `3` with `venv` support for `npm run test:tck`

## Install

```bash
cp .env.example .env
npm install
```

## Run Locally

Build once:

```bash
npm run build
```

Start the registry:

```bash
npm run dev:server
```

Start the sidecar in another shell:

```bash
npm run dev:sidecar
```

Default endpoints:

- registry: `http://127.0.0.1:8080`
- public Agent Card: `http://127.0.0.1:8090/.well-known/agent-card.json`
- A2A JSON-RPC: `http://127.0.0.1:8090/a2a/jsonrpc`

Example JSON-RPC call:

```bash
curl -s http://127.0.0.1:8090/a2a/jsonrpc \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev-bearer-token-change-me' \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "demo-message",
        "role": "user",
        "parts": [{ "kind": "text", "text": "hello" }]
      }
    }
  }'
```

## Tests

Schema/signing/integration coverage:

```bash
npm test
```

Pinned JSON-RPC-only A2A TCK run:

```bash
npm run test:tck
```

Full verification:

```bash
npm run verify
```

## Docker Compose

Build and start both services:

```bash
docker compose up --build
```

Published ports:

- registry: `localhost:8080`
- sidecar: `localhost:8090`

The compose file keeps sidecar auto-registration off by default. If you enable it inside Compose, also set `SIDECAR_PUBLIC_ORIGIN` to a value the registry container can fetch.

## Sidecar-Only Install

For a copy-paste sidecar deployment next to an existing local OpenClaw runtime, build or publish a standalone sidecar image and generate a `docker run` command:

```bash
docker build -f sidecar/Dockerfile -t claw2claw-sidecar:local .
npm run generate:sidecar-command -- \
  --image claw2claw-sidecar:local \
  --public-origin https://node.example.com \
  --openclaw-base-url http://127.0.0.1:3000 \
  --public-skills research.summarize \
  --registry-url https://claw2claw.cc \
  --auto-register
```

The generator prints a ready-to-paste `docker run` command with a fresh bearer token and Ed25519 seed embedded. See [Sidecar Install](./docs/install-sidecar.md) for the standalone flow and verification steps.

## Notes

- The registry stores authoritative Claw Profiles and the computed `agentCardHash`.
- The sidecar enforces bearer authentication on inbound A2A requests through the SDK auth path.
- `tests/tck/proxy.ts` is a test-only compatibility adapter for the pinned frozen TCK. The production sidecar still exposes only the official JSON-RPC surface.

See [Architecture](./docs/architecture.md), [Security](./docs/security.md), and [Sidecar Install](./docs/install-sidecar.md).
