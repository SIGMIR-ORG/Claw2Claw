Implement the Claw2Claw repository from scratch, using the existing local spec files as the source of truth.

Start by reading these files in full:

* `/home/tianhao/project/claw2claw/spec.md`
* `/home/tianhao/project/claw2claw/spec/openapi.yaml`
* `/home/tianhao/project/claw2claw/spec/agent-card.schema.json`
* `/home/tianhao/project/claw2claw/spec/claw-profile.schema.json`

Treat those files as normative for Claw2Claw behavior. Do not invent a parallel protocol.

## What To Build

Build a TypeScript repository with these main components:

* `server`: Claw2Claw registry API
* `sidecar`: OpenClaw-to-A2A adapter
* shared test and dev infrastructure

Follow the repository shape described in `spec.md`, including:

* `/server`
* `/sidecar`
* `/tests`
* `/docs`
* `docker-compose.yml`
* root `README.md`

## Hard Constraints

You must follow these rules exactly:

* Freeze A2A to `0.3.0`
* Freeze A2A transport to JSON-RPC only for v0.1
* Use the official JavaScript SDK `@a2a-js/sdk@0.3.13`
* Treat A2A wire behavior as upstream-owned; do not invent custom `createTask/getTask/cancelTask` RPCs
* Use the frozen TCK ref `b03fefcae9767dad0e978e11573192f74252dfe3` in CI or test tooling
* Implement Claw2Claw registry signing exactly as specified in `spec.md`
* Use RFC 8785 canonical JSON and Ed25519 for registry request signing
* Use the signing test vector in `spec.md` as an automated test
* Use HTTP Bearer auth for inbound A2A in v0.1
* Do not expose additional A2A transports in v0.1

## Scope

Implement at least the following:

### Server

* `POST /v1/agents/register`
* `POST /v1/agents/heartbeat`
* `GET /v1/agents/search`
* `GET /v1/agents/:id`
* `POST /v1/agents/unregister`

Server responsibilities:

* validate request bodies against the local schemas
* validate registry signatures
* fetch and validate the live Agent Card from `agentCardUrl`
* compute and store `agentCardHash`
* store authoritative Claw Profiles
* track heartbeat status and TTL
* support search filters defined in the spec

### Sidecar

* serve `/.well-known/agent-card.json`
* expose A2A JSON-RPC via `@a2a-js/sdk`
* implement upstream A2A `message/send`, `tasks/get`, and `tasks/cancel`
* implement `message/stream` and `tasks/resubscribe` when streaming is enabled
* enforce bearer-token auth through the SDK auth hook
* enforce public-skill allowlisting and local policy checks
* bridge A2A requests into the local OpenClaw runtime

### Tests

At minimum, add:

* schema validation tests
* registry signing tests using the canonical vector
* registration spoofing rejection test
* heartbeat expiry test
* search filtering test
* sidecar A2A integration test
* bearer-auth rejection test
* streaming test
* A2A TCK execution for the pinned JSON-RPC-only profile

## Implementation Order

Use this order:

1. Bootstrap the TypeScript workspace and package structure
2. Implement shared config, schema validation, and types generated from the local specs where useful
3. Implement the server API and persistence layer
4. Implement the sidecar Agent Card and A2A JSON-RPC surface
5. Implement the OpenClaw bridge layer behind a clean interface
6. Add Docker Compose and local dev workflows
7. Add automated tests, including the signing vector and TCK
8. Write setup and usage docs

## Technical Expectations

* Prefer a simple, maintainable architecture over abstraction-heavy code
* Validate all untrusted input at boundaries
* Keep the server and sidecar independently runnable
* Use environment-based configuration with documented defaults
* Make local development reproducible
* Keep A2A versioning and SDK pins explicit in code and docs
* If the prose spec and machine-readable files differ, prefer:
  * `spec/openapi.yaml` for registry request/response shapes
  * the JSON Schema files for `agentCard` and `clawProfile`
  * upstream A2A `0.3.0` for A2A wire behavior
* If you discover a mismatch between implementation reality and the local specs, update the local specs as part of the same change instead of silently drifting

## Definition Of Done

The implementation is only done when all of the following are true:

* the repo structure exists and builds cleanly
* the registry API matches `spec/openapi.yaml`
* Agent Cards and Claw Profiles validate against the local JSON Schemas
* registry signing passes the canonical signing vector test
* sidecars interoperate over A2A `0.3.0` JSON-RPC using `@a2a-js/sdk@0.3.13`
* bearer auth is enforced for inbound A2A
* the pinned A2A TCK passes for the supported profile
* Docker Compose boots the dev environment successfully
* `README.md` explains how to install, run, test, and verify the system

## Deliverables

Produce:

* complete source code
* tests
* package manifests and lockfiles
* Docker Compose setup
* environment example files if useful
* concise docs for running the server, sidecar, and tests

Work directly in the repository. Do not stop at planning; implement the code, wire the tests, and leave the repo in a runnable state.
