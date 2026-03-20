# Security

## Registry Signing

Registry mutations are signed exactly once at the request boundary:

- canonical payload hashing uses RFC 8785 JSON canonicalization
- signatures use Ed25519
- the signing string binds HTTP method, normalized path, body hash, timestamp, and nonce
- nonces are stored and replay-protected
- timestamps are rejected outside the configured skew window

The canonical signing vector from `spec.md` is covered by automated tests.

## Agent Card Validation

The registry does not trust the submitted Agent Card snapshot by itself.

- it fetches the live card from `agentCardUrl`
- validates it against `spec/agent-card.schema.json`
- computes and stores `agentCardHash`
- extracts signing keys from the validated card

## Sidecar Authentication

Inbound A2A requests use HTTP bearer authentication in `v0.1`.

- bearer token hashes are configured through env
- the Express auth middleware rejects unauthenticated requests before the SDK handler
- the public Agent Card remains unauthenticated for discovery

## Public Skill Policy

Only configured public skills are exposed in the sidecar Agent Card and executable through A2A. Skill selection is checked again at execution time so untrusted callers cannot invoke non-public bridge capabilities.

## TCK Adapter

`tests/tck/proxy.ts` exists only for the frozen pinned TCK profile.

- it injects loopback-safe auth/config needed by that frozen harness
- it does not change the production sidecar transport surface
- the production sidecar still exposes only the official A2A JSON-RPC interface
