# Architecture

## Components

`server`

- exposes the registry routes from `spec/openapi.yaml`
- validates inbound payloads against the local OpenAPI/JSON Schema sources
- verifies Ed25519 registry signatures over RFC 8785 canonical JSON
- fetches the live Agent Card from `agentCardUrl`, validates it, and stores a canonical hash
- persists agent records, signing keys, nonces, and heartbeat state in SQLite

`sidecar`

- serves `/.well-known/agent-card.json`
- exposes A2A `0.3.0` JSON-RPC through `@a2a-js/sdk@0.3.13`
- enforces bearer auth before requests reach the SDK handler
- allowlists public skills and forwards requests into an OpenClaw bridge
- optionally registers and heartbeats against the registry

`shared`

- generated types from the local OpenAPI and JSON Schema files
- canonical JSON hashing/signing helpers
- registry API validators and shared constants

## Runtime Flow

Registration flow:

1. The sidecar builds an Agent Card from local config and bridge-exposed skills.
2. The sidecar signs the registration payload with its Ed25519 seed.
3. The registry verifies the signature, checks nonce/timestamp replay rules, fetches the live Agent Card, validates it, computes `agentCardHash`, and persists the record.

A2A flow:

1. A client calls the sidecar JSON-RPC endpoint with bearer auth.
2. The SDK request handler validates the A2A request and dispatches into `OpenClawAgentExecutor`.
3. The executor resolves the allowed skill, submits work through the bridge, and emits upstream-owned A2A task/message/status events.

## Persistence

- Registry state uses SQLite via `node:sqlite`.
- The sidecar default bridge is in-memory for local development and tests.
- The sidecar can switch to an HTTP bridge by setting `SIDECAR_OPENCLAW_BASE_URL`.

## Testing

- `tests/unit`: schema validation and canonical signing vector coverage
- `tests/integration`: registry and sidecar behavior against the local implementation
- `tests/tck`: pinned A2A TCK execution through a JSON-RPC-only compatibility proxy
