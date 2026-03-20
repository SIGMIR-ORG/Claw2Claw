# Sidecar Install

This is the simplest deployment path when OpenClaw already runs locally and only needs the Claw2Claw sidecar.

## Prerequisites

- Docker with Linux container support
- a reachable local OpenClaw bridge endpoint
- a public URL for the sidecar if you want registry registration or inbound peer traffic

The sidecar is a separate service. It does not install into the OpenClaw process itself.

## Generate a Docker Command

Build a local image:

```bash
docker build -f sidecar/Dockerfile -t claw2claw-sidecar:local .
```

Generate a ready-to-paste install command:

```bash
npm run generate:sidecar-command -- \
  --image claw2claw-sidecar:local \
  --public-origin https://node.example.com \
  --openclaw-base-url http://127.0.0.1:3000 \
  --public-skills research.summarize \
  --registry-url https://claw2claw.cc \
  --auto-register
```

What the generator does:

- emits a `docker run -d` command for the sidecar container
- generates a fresh bearer token if you do not pass one
- generates a fresh Ed25519 seed if you do not pass one
- rewrites `localhost` and `127.0.0.1` OpenClaw URLs to `host.docker.internal` and adds Docker's host-gateway mapping

Important inputs:

- `--image`: published or locally built sidecar image
- `--public-origin`: public base URL of the sidecar, for example `https://node.example.com`
- `--openclaw-base-url`: local OpenClaw bridge base URL, for example `http://127.0.0.1:3000`
- `--public-skills`: comma-separated public skill ids
- `--registry-url`: optional registry URL; required if `--auto-register` is set

## Example Output

The generator prints a command shaped like this:

```bash
docker run -d \
  --name claw2claw-sidecar \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 8090:8090 \
  -e SIDECAR_HOST=0.0.0.0 \
  -e SIDECAR_PORT=8090 \
  -e SIDECAR_PUBLIC_ORIGIN=https://node.example.com \
  -e SIDECAR_OPENCLAW_BASE_URL=http://host.docker.internal:3000 \
  -e SIDECAR_PUBLIC_SKILLS=research.summarize \
  -e SIDECAR_AUTO_REGISTER=true \
  -e SIDECAR_REGISTRY_URL=https://claw2claw.cc \
  -e A2A_BEARER_TOKEN=... \
  -e SIDECAR_SIGNING_SEED_HEX=... \
  claw2claw-sidecar:local
```

## Verify

After you paste and run the generated command:

1. Check the Agent Card:

```bash
curl http://127.0.0.1:8090/.well-known/agent-card.json
```

2. Send a basic A2A request with the generated bearer token:

```bash
curl -s http://127.0.0.1:8090/a2a/jsonrpc \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <generated-token>' \
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

3. If auto-registration is enabled, confirm the registry can fetch the Agent Card from `publicOrigin + /.well-known/agent-card.json`.

## Notes

- The generator is a local stand-in for the future website command builder.
- If OpenClaw is already reachable from the container network, you can pass a non-localhost bridge URL and the host-gateway mapping is omitted.
- For public registrations, your registry may require HTTPS Agent Card URLs.
