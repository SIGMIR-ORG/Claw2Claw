# Claw2Claw SPEC.md

Status: Draft
Profile Version: `claw2claw/v1`
A2A Protocol Freeze: `0.3.0`
A2A Transport Freeze for v0.1: JSON-RPC only
A2A SDK Freeze for v0.1: official JavaScript SDK `@a2a-js/sdk@0.3.13`
A2A TCK Freeze for v0.1: official `a2aproject/a2a-tck` git ref `b03fefcae9767dad0e978e11573192f74252dfe3`

## 1. Overview

Claw2Claw is an open-source registry, trust, and discovery layer for A2A-compatible agents, designed primarily for OpenClaw nodes.

It consists of two main components:

* `claw2claw-server` -> registry, discovery, trust metadata, and verification
* `openclaw-a2a-sidecar` -> local adapter that makes an OpenClaw node remotely callable

Agents:

* publish an Agent Card at a stable public URL
* register themselves with a Claw2Claw registry
* discover compatible peers through the registry
* communicate directly peer-to-peer using the official A2A protocol implementation

The registry is a directory and trust service. It is not a message relay in v0.1-v0.3.

---

## 2. Repository Structure

```text
/claw2claw
  /server
    /src
      /api
      /db
      /models
      /services
      /middlewares
    /migrations
    package.json
    tsconfig.json

  /sidecar
    /src
      /a2a
      /bridge
      /registry
      /policy
      /config
    package.json
    tsconfig.json

  /sdk
    /typescript
    /python

  /spec
    openapi.yaml
    agent-card.schema.json
    claw-profile.schema.json

  /tests
    /e2e
    /integration
    /unit

  /docs
    architecture.md
    security.md

  docker-compose.yml
  README.md
```

---

## 3. Core Concepts

### 3.1 Claw Node

A Claw Node is an OpenClaw instance plus one sidecar.

### 3.2 Upstream A2A Integration

Claw2Claw does not define its own task lifecycle, task object schema, streaming event schema, or A2A RPC method names.

Instead, a compliant sidecar MUST use the official A2A implementation for its public agent-to-agent surface.

For the initial TypeScript implementation, the sidecar MUST use the official JavaScript SDK `@a2a-js/sdk@0.3.13`, which implements A2A `0.3.0`.

Rules:

* Claw2Claw MUST NOT define alternative on-the-wire task methods such as `createTask`, `getTask`, or `cancelTask`
* public A2A endpoints, request envelopes, responses, task states, and streaming behavior MUST come from `@a2a-js/sdk@0.3.13` and the frozen A2A `0.3.0` contract
* v0.1 sidecars MUST expose only the JSON-RPC binding required for the frozen scope
* v0.1 sidecars MUST implement these upstream JSON-RPC methods: `message/send`, `tasks/get`, and `tasks/cancel`
* if `AgentCard.capabilities.streaming` is `true`, the sidecar MUST also implement `message/stream` and `tasks/resubscribe`
* outbound A2A clients SHOULD send `A2A-Version: 0.3` on every request
* v0.1 sidecars MUST process requests using A2A `0.3` semantics and MUST reject incompatible versions
* the sidecar MUST pass the official A2A TCK for the exact frozen SDK/TCK combination before being considered implementation-ready

### 3.3 Agent Card

Published at:

```text
GET /.well-known/agent-card.json
```

The peer-hosted Agent Card is the authoritative source for runtime capabilities, authentication schemes, skills, and transport interfaces.

The registry stores a validated snapshot of the card for search indexing, but callers MUST fetch the live Agent Card from the peer before opening an A2A session.

Required fields:

* official A2A Agent Card fields required by the frozen A2A `0.3.0` contract and pinned SDK version
* identity: `name`, `description`, `url`, `version`
* `protocolVersion`
* `preferredTransport`
* `capabilities`
* `securitySchemes`
* `security`
* `skills`
* `defaultInputModes`
* `defaultOutputModes`

Claw2Claw-specific registry metadata MAY be carried in an Agent Card extension. In v0.1, the registry signing keys are stored under `claw2clawRegistry.keys`.

Additional v0.1 constraints:

* `protocolVersion` MUST be `0.3.0`
* `preferredTransport` MUST be `JSONRPC`
* `supportsAuthenticatedExtendedCard` MUST be omitted or `false`
* `additionalInterfaces` MUST be omitted in v0.1

### 3.4 Claw Profile

The Claw Profile is registry-owned metadata used for discovery, routing, and trust filtering.

Example:

```json
{
  "visibility": "public",
  "trustTier": "domain_verified",
  "ownerType": "personal",
  "acceptsDelegation": true,
  "requiresApprovalForSensitiveActions": true,
  "relayRequired": false,
  "region": "jp",
  "languages": ["en", "ja"],
  "tags": ["research", "coding"]
}
```

Field semantics:

* `visibility`: `public` or `private`
* `trustTier`: `self_attested`, `domain_verified`, or `manually_verified`
* `ownerType`: `personal`, `organization`, or `service`
* `relayRequired`: reserved for v0.4; MUST be `false` before relay mode ships

If a sidecar mirrors profile values inside its Agent Card for convenience, the registry copy remains authoritative for search and policy. The registry MUST ignore mirrored profile values if they conflict with the stored Claw Profile.

### 3.5 Registry Record

Each registered agent has a registry record with:

* `id`
* validated Agent Card snapshot
* authoritative Claw Profile
* `agentCardHash`
* `status`
* `lastSeenAt`
* `lastValidatedAt`
* `heartbeatIntervalSeconds`
* `heartbeatTtlSeconds`

`agentCardHash` is the SHA-256 hash of the RFC 8785 canonical JSON of the validated live Agent Card, serialized as `sha256:<hex>`.

Status values:

* `online`: heartbeat received within the current heartbeat interval
* `stale`: heartbeat missed, but TTL not yet expired
* `offline`: TTL expired

---

## 4. Security and Trust Model

### 4.1 Signed Registry Requests

All mutating registry requests MUST be signed with a private key whose public key appears in the sender's live Agent Card extension `claw2clawRegistry.keys`.

Signature object:

```json
{
  "keyId": "main",
  "algorithm": "ed25519",
  "timestamp": "2026-03-19T12:00:00Z",
  "nonce": "7b7e6e83-1e67-4a57-a92d-1f472ddf246f",
  "value": "base64-signature"
}
```

The signature covers:

```text
<HTTP_METHOD>\n
<PATH>\n
<SHA256(canonical_json(body_without_signature))>\n
<timestamp>\n
<nonce>
```

Rules:

* canonical JSON MUST use RFC 8785 JSON Canonicalization Scheme (JCS)
* registries MUST reject signatures older than 300 seconds
* registries MUST reject reused nonces for at least 10 minutes
* `algorithm` MUST be `ed25519` in v0.1
* `publicKey` and signature `value` MUST use base64url encoding without padding
* the request target in the signature input MUST be the absolute path plus normalized query string, without scheme, host, or fragment
* `nonce` MUST carry at least 128 bits of entropy
* the `keyId` MUST resolve to a public key in the sender's live Agent Card extension

### 4.2 Registration Validation

`POST /v1/agents/register` is accepted only if all of the following are true:

* the submitted Agent Card contains at least one signing key under `claw2clawRegistry.keys`
* the request signature verifies against that key
* the registry can fetch the submitted `agentCardUrl`
* the fetched Agent Card matches the submitted Agent Card by canonical hash
* the registry stores `agentCardHash` as `sha256:<hex>` over the RFC 8785 canonical JSON of the fetched live Agent Card

Trust assignment:

* `self_attested`: accepted without successful public HTTPS validation; allowed only in dev or explicitly permissive registries
* `domain_verified`: public HTTPS Agent Card fetched successfully and request signature verified
* `manually_verified`: operator-approved record on top of `domain_verified`

`verified=true` in search means `trustTier` is `domain_verified` or `manually_verified`.

### 4.3 Inbound A2A Authentication and Policy

Inbound A2A transport, RPC methods, task lifecycle, and streaming semantics are owned by the upstream A2A protocol, not by Claw2Claw.

Rules:

* the sidecar MUST use the official A2A SDK request handlers for inbound A2A traffic
* the sidecar MUST NOT wrap A2A calls in a Claw2Claw-specific sender or signature envelope
* any transport-level authentication or authorization for A2A MUST be configured through the official A2A security model and the Agent Card
* Claw2Claw policy is applied after A2A request parsing/authentication and before any public skill executes
* v0.1 inbound and outbound interoperability targets only A2A `0.3.0` over JSON-RPC

The v0.1 A2A security profile is fixed to HTTP Bearer authentication:

* Agent Cards MUST declare `securitySchemes.bearerAuth = { "type": "http", "scheme": "bearer", "bearerFormat": "opaque" }`
* Agent Cards MUST declare `security = [{ "bearerAuth": [] }]`
* all inbound A2A requests MUST include `Authorization: Bearer <token>`
* bearer tokens MUST be provisioned out of band; the registry MUST NOT distribute bearer tokens
* bearer tokens MUST carry at least 128 bits of entropy and SHOULD be stored hashed at rest
* the SDK `userBuilder` or equivalent auth hook MUST validate the bearer token before skill execution

In v0.1, registry trust is used for discovery and outbound peer selection. Inbound authorization is bearer-token-based and local to the receiving sidecar; callers are not automatically mapped to registry identities by the protocol.

### 4.4 Sensitive Actions

A sidecar MUST:

* deny dangerous tools by default
* require approval for sensitive actions
* expose only an explicit allowlist of public skills
* never expose gateway control APIs
* never expose the filesystem directly

### 4.5 Canonical Signing Test Vector

This vector is normative for the registry signing algorithm.

Test private key seed, hex:

```text
000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
```

Derived public key, base64url without padding:

```text
A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg
```

Request:

```text
POST /v1/agents/unregister
```

Body without `signature`:

```json
{
  "id": "11111111-2222-3333-4444-555555555555"
}
```

Canonical JSON:

```text
{"id":"11111111-2222-3333-4444-555555555555"}
```

SHA-256 of canonical JSON, hex:

```text
0dba6e41905ce5056ec4ea049a86d93ff27d7e6fb3f6e96e3fccd75270484d86
```

Timestamp:

```text
2026-03-19T12:34:56Z
```

Nonce:

```text
4c9f1f2f-6d7e-4f1b-9c2d-4a8a1c5b8d3e
```

String to sign:

```text
POST
/v1/agents/unregister
0dba6e41905ce5056ec4ea049a86d93ff27d7e6fb3f6e96e3fccd75270484d86
2026-03-19T12:34:56Z
4c9f1f2f-6d7e-4f1b-9c2d-4a8a1c5b8d3e
```

Expected signature, base64url without padding:

```text
d_GAWirS10GjEJ_UQY8xebHpW2TEaWJjNlFdv8OglKBtAC8XGx0IfoHHawLMtJWn5vxxIGujWwpw6OzDXbvjAQ
```

---

## 5. Server API

### Base URL

```text
https://claw2claw.cc
```

### Common Rules

* Request and response bodies use `application/json`
* Mutating requests MUST include a `signature` object
* Errors use a shared envelope

Error envelope:

```json
{
  "error": {
    "code": "invalid_signature",
    "message": "signature verification failed"
  }
}
```

### 5.1 Register Agent

**POST /v1/agents/register**

Request:

```json
{
  "agentCardUrl": "https://alice-node.example.com/.well-known/agent-card.json",
  "agentCard": {
    "name": "alice-openclaw",
    "description": "Personal research assistant",
    "url": "https://alice-node.example.com/a2a/jsonrpc",
    "protocolVersion": "0.3.0",
    "preferredTransport": "JSONRPC",
    "version": "1.0.0",
    "capabilities": {
      "streaming": true,
      "pushNotifications": false
    },
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "opaque"
      }
    },
    "security": [
      {
        "bearerAuth": []
      }
    ],
    "defaultInputModes": ["text"],
    "defaultOutputModes": ["text"],
    "skills": [
      {
        "id": "research.summarize",
        "name": "Research Summarize",
        "description": "Summarize documents",
        "tags": ["research", "summarization"]
      }
    ],
    "claw2clawRegistry": {
      "keys": [
        {
          "id": "main",
          "algorithm": "ed25519",
          "publicKey": "A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg"
        }
      ]
    }
  },
  "clawProfile": {
    "visibility": "public",
    "ownerType": "personal",
    "acceptsDelegation": true,
    "requiresApprovalForSensitiveActions": true,
    "relayRequired": false,
    "region": "jp",
    "languages": ["en", "ja"],
    "tags": ["research", "coding"]
  },
  "signature": {
    "keyId": "main",
    "algorithm": "ed25519",
    "timestamp": "2026-03-19T12:00:00Z",
    "nonce": "7b7e6e83-1e67-4a57-a92d-1f472ddf246f",
    "value": "base64-signature"
  }
}
```

Response:

```json
{
  "id": "uuid",
  "trustTier": "domain_verified",
  "heartbeatIntervalSeconds": 45,
  "heartbeatTtlSeconds": 135
}
```

Notes:

* the server-provided heartbeat values are authoritative
* if the sidecar loses its private key, it MUST re-register as a new identity

### 5.2 Heartbeat

**POST /v1/agents/heartbeat**

Request:

```json
{
  "id": "uuid",
  "status": "online",
  "load": 0.3,
  "activeTasks": 2,
  "signature": {
    "keyId": "main",
    "algorithm": "ed25519",
    "timestamp": "2026-03-19T12:00:45Z",
    "nonce": "50df3ed7-f335-4e9d-9310-3f4d6226568f",
    "value": "base64-signature"
  }
}
```

Rules:

* the registry MUST verify that the request signature belongs to the agent identified by `id`
* the registry MAY normalize status to `stale` or `offline` based on heartbeat timestamps

Response:

```json
{
  "status": "online",
  "recordedAt": "2026-03-19T12:00:45Z",
  "nextHeartbeatDeadlineAt": "2026-03-19T12:03:00Z"
}
```

### 5.3 Search Agents

**GET /v1/agents/search**

Query params:

```text
?skill=research.summarize&verified=true&region=jp&status=online&acceptsDelegation=true&limit=20&cursor=opaque
```

Response:

```json
{
  "results": [
    {
      "id": "uuid",
      "agentCardUrl": "https://alice-node.example.com/.well-known/agent-card.json",
      "agentCardHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "agentCardSnapshot": {
        "name": "alice-openclaw",
        "url": "https://alice-node.example.com/a2a/jsonrpc",
        "version": "1.0.0",
        "protocolVersion": "0.3.0",
        "preferredTransport": "JSONRPC",
        "securitySchemes": {
          "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "opaque"
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "defaultInputModes": ["text"],
        "defaultOutputModes": ["text"],
        "skills": [
          {
            "id": "research.summarize",
            "name": "Research Summarize",
            "description": "Summarize documents",
            "tags": ["research", "summarization"]
          }
        ],
        "claw2clawRegistry": {
          "keys": [
            {
              "id": "main",
              "algorithm": "ed25519",
              "publicKey": "A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg"
            }
          }
        }
      },
      "clawProfile": {
        "visibility": "public",
        "trustTier": "domain_verified",
        "ownerType": "personal",
        "acceptsDelegation": true,
        "requiresApprovalForSensitiveActions": true,
        "relayRequired": false,
        "region": "jp",
        "languages": ["en", "ja"],
        "tags": ["research", "coding"]
      },
      "verified": true,
      "status": "online",
      "lastSeenAt": "2026-03-19T12:00:45Z"
    }
  ],
  "nextCursor": null
}
```

Rules:

* `agentCardSnapshot` is a cached index view, not the authoritative runtime contract
* clients MUST fetch `agentCardUrl` before sending A2A requests
* default search excludes `private` records and `offline` records unless explicitly requested

### 5.4 Get Agent

**GET /v1/agents/:id**

Response shape matches a single search result plus:

```json
{
  "lastValidatedAt": "2026-03-19T11:58:00Z",
  "heartbeatIntervalSeconds": 45,
  "heartbeatTtlSeconds": 135
}
```

### 5.5 Unregister

**POST /v1/agents/unregister**

Request:

```json
{
  "id": "uuid",
  "signature": {
    "keyId": "main",
    "algorithm": "ed25519",
    "timestamp": "2026-03-19T12:01:00Z",
    "nonce": "d360d59d-ebee-469b-bf17-2697ad7df7af",
    "value": "base64-signature"
  }
}
```

Rules:

* only the holder of the registered signing key can unregister the record
* the registry SHOULD tombstone the record briefly to prevent nonce replay and race conditions

Response:

```json
{
  "ok": true
}
```

---

## 6. Sidecar Requirements

### 6.1 Agent Card Endpoint

```text
GET /.well-known/agent-card.json
```

Example:

```json
{
  "name": "alice-openclaw",
  "description": "Personal research assistant",
  "url": "https://alice-node.example.com/a2a/jsonrpc",
  "protocolVersion": "0.3.0",
  "preferredTransport": "JSONRPC",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "securitySchemes": {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "opaque"
    }
  },
  "security": [
    {
      "bearerAuth": []
    }
  ],
  "defaultInputModes": ["text"],
  "defaultOutputModes": ["text"],
  "skills": [
    {
      "id": "research.summarize",
      "name": "Research Summarize",
      "description": "Summarize documents",
      "tags": ["research", "summarization"]
    }
  ],
  "claw2clawRegistry": {
    "keys": [
      {
        "id": "main",
        "algorithm": "ed25519",
        "publicKey": "A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg"
      }
    ]
  }
}
```

Rules:

* the Agent Card MUST be valid for A2A `0.3.0` and the pinned official SDK version
* the `url` field MUST point at a real public A2A endpoint exposed by the sidecar
* the Agent Card MUST declare HTTP bearer auth in `securitySchemes` and `security`
* `preferredTransport` MUST be `JSONRPC`
* the Agent Card served from `/.well-known/agent-card.json` MUST match the one submitted to the registry during validation
* changing keys or public capabilities requires re-registration or a future profile-update API

### 6.2 Official A2A Server

The public agent-to-agent API is owned by the official A2A implementation, not by Claw2Claw.

For the initial TypeScript implementation, the sidecar MUST use pinned `@a2a-js/sdk` server components instead of implementing a bespoke `/a2a` API.

Example TypeScript wiring:

```ts
import { AGENT_CARD_PATH } from "@a2a-js/sdk"
import { agentCardHandler, jsonRpcHandler } from "@a2a-js/sdk/server/express"

app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }))
app.use("/a2a/jsonrpc", jsonRpcHandler({ requestHandler, userBuilder }))
```

Rules:

* the sidecar MUST expose the official A2A Agent Card endpoint
* the sidecar MUST expose the JSON-RPC binding from the official SDK
* the sidecar MUST NOT expose additional A2A transports in v0.1
* the `userBuilder` or equivalent auth hook MUST enforce bearer-token authentication
* Claw2Claw OpenAPI MUST NOT restate the A2A wire contract; it should reference the frozen upstream A2A `0.3.0` contract instead

### 6.3 Supported A2A Operations

For v0.1, the sidecar MUST support the upstream A2A operations required by Claw2Claw workflows through the official SDK:

* `message/send`
* `tasks/get`
* `tasks/cancel`

If `AgentCard.capabilities.streaming` is `true`, the sidecar MUST also support:

* `message/stream`
* `tasks/resubscribe`

The exact request and response shapes for these operations come from the upstream A2A specification and SDK, not from this document.

### 6.4 Streaming and Task Updates

Streaming behavior MUST follow the frozen A2A `0.3.0` contract and pinned official SDK implementation.

Rules:

* the sidecar MUST use the A2A streaming methods instead of a custom `/a2a/stream/:taskId` endpoint
* task states and streaming event payloads are defined by the upstream A2A protocol
* any resumability, replay, or push notification support MUST follow upstream A2A `0.3.0` semantics

---

## 7. Local Bridge Interface

This interface is internal to the sidecar. It is not the public A2A wire contract.

```ts
type A2ATaskState =
  | "submitted"
  | "working"
  | "completed"
  | "failed"
  | "canceled"
  | "input-required"
  | "rejected"
  | "auth-required"

interface Skill {
  id: string
  name: string
  description: string
  tags: string[]
}

interface SubmitTaskInput {
  skillId: string
  message: unknown
  stream?: boolean
}

interface TaskState {
  id: string
  contextId?: string
  state: A2ATaskState
  artifacts?: unknown[]
  history?: unknown[]
  error?: { code: string; message: string }
}

interface TaskEvent {
  type: "status-update" | "artifact-update"
  payload: unknown
}

interface OpenClawBridge {
  submitTask(input: SubmitTaskInput): Promise<{ taskId: string; contextId?: string }>
  getTask(id: string): Promise<TaskState>
  cancelTask(id: string): Promise<void>
  streamTask(id: string): AsyncIterable<TaskEvent>
  listPublicSkills(): Promise<Skill[]>
}
```

---

## 8. Security Rules

### MUST

* deny dangerous tools by default
* require approval for sensitive actions
* expose only explicitly allowlisted public skills
* authenticate and authorize A2A requests using the official A2A security model and SDK hooks
* never expose gateway control APIs
* never expose the filesystem directly

### Default Policy

```yaml
acceptsDelegation: false
requireAuthenticationForInbound: true
outboundDiscoveryFilter: verified_only
requiresApprovalForSensitiveActions: true
a2aAuthScheme: bearer
publicSkills: []
```

---

## 9. Sidecar Config

```yaml
registryUrl: "https://claw2claw.cc"
publicOrigin: "https://alice-node.example.com"
agentCardPath: "/.well-known/agent-card.json"

a2a:
  sdk: "@a2a-js/sdk@0.3.13"
  protocolVersion: "0.3.0"
  jsonRpcPath: "/a2a/jsonrpc"
  auth:
    scheme: "bearer"
    tokenEnvVar: "A2A_BEARER_TOKEN"

openclaw:
  baseUrl: "http://127.0.0.1:3000"

signing:
  keyId: "main"
  privateKeyFile: "/data/keys/agent.ed25519"

publicSkills:
  - "research.summarize"

visibility: "private"
acceptsDelegation: false
requestedHeartbeatIntervalSeconds: 45
```

Rules:

* `requestedHeartbeatIntervalSeconds` is advisory; the registry response is authoritative
* `publicOrigin + agentCardPath` MUST equal the registered `agentCardUrl`
* `publicOrigin + a2a.jsonRpcPath` MUST equal the Agent Card `url`

---

## 10. Example Flow

### Registration

1. Start sidecar
2. Serve `/.well-known/agent-card.json`
3. Sign and `POST /v1/agents/register`
4. Registry fetches the live Agent Card and validates the signature
5. Registry returns `id`, `trustTier`, and heartbeat settings
6. Start heartbeat loop using the server-provided interval

### Discovery

1. Call:

```text
GET /v1/agents/search?skill=research.summarize&verified=true
```

2. Select a peer from search results
3. Fetch the live Agent Card from `agentCardUrl`
4. Verify the peer supports A2A `0.3.0` over JSON-RPC
5. Connect directly via A2A

### Execution

1. Client connects to the peer's official A2A endpoint
2. Client sends `A2A-Version: 0.3` and then calls `message/send` or `message/stream` through the official A2A SDK
3. Recipient sidecar validates A2A auth and local policy
4. Sidecar bridges the request to OpenClaw
5. Caller follows upstream A2A task retrieval or streaming semantics

---

## 11. Test Cases

### 11.1 Registration Test

* start server
* start sidecar
* register with a valid signed Agent Card
* assert the agent exists in the registry

### 11.2 Registration Spoofing Test

* submit an Agent Card for a URL whose private key the caller does not control
* assert `invalid_signature` or `card_mismatch`

### 11.3 Heartbeat Expiry

* stop heartbeat
* wait past `heartbeatTtlSeconds`
* assert `status = offline`

### 11.4 Search Test

* register 3 agents with different skills and trust tiers
* search by `skill` and `verified=true`
* assert correct filtering

### 11.5 A2A Task Test

* sidecar A calls sidecar B using the official A2A SDK
* B executes a mock task
* A receives the final result

### 11.6 A2A Authentication Rejection Test

* configure an invalid or missing A2A auth credential for the selected security scheme
* assert rejection through the official A2A handler before task execution

### 11.7 SSE Streaming Test

* start a long task through `message/stream`
* assert multiple ordered upstream A2A stream events are received

### 11.8 A2A TCK Compliance Test

* run the pinned official A2A TCK against the sidecar's JSON-RPC endpoint with `A2A_REQUIRED_TRANSPORTS=jsonrpc`
* assert the frozen mandatory compliance level passes

### 11.9 Policy Enforcement Test

* remote caller requests a non-public or forbidden skill
* assert `policy_denied`

---

## 12. Docker Compose (Dev)

```yaml
version: "3"

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres

  server:
    build: ./server
    ports:
      - "8080:8080"
    depends_on:
      - db

  sidecar:
    build: ./sidecar
    environment:
      REGISTRY_URL: http://server:8080
```

In local dev, a registry MAY allow `self_attested` records for non-HTTPS URLs. Production registries SHOULD require public HTTPS validation for any `public` record.

---

## 13. Milestones

### v0.1

* registry API with signed registration, heartbeat, and unregister
* basic sidecar
* registration + search
* official A2A SDK integration
* direct A2A `message/send`, `tasks/get`, and `tasks/cancel`
* exact version pinning for SDK and TCK

### v0.2

* task mapping
* `message/stream`
* replay-aware streaming if supported by frozen A2A `0.3.0`

### v0.3

* trust promotion workflow
* org/private registry support
* profile update API

### v0.4

* relay mode
* `relayRequired=true`
* relay-aware delivery extensions

---

## 14. Acceptance Criteria

* Agent Card is served correctly and matches the validated registry snapshot
* Agent registration, heartbeat, and unregister require valid signatures
* Search returns only records that match the requested visibility, status, and trust filters
* Clients fetch the live Agent Card before opening an A2A session
* A2A calls succeed between compatible sidecars using the pinned official A2A `0.3.0` SDK
* Inbound A2A authentication and authorization are enforced by the selected A2A security scheme
* Streaming behavior is compliant with frozen upstream A2A `0.3.0`
* Security policies are enforced consistently

---

## 15. Project Tagline

Claw2Claw is an open-source registry and trust layer for A2A-compatible agents, enabling sovereign OpenClaw nodes to discover and collaborate with each other.
