import { randomUUID } from "node:crypto";

import {
  deriveSigningKeyPair,
  parseSeedHex,
  signRegistryRequest,
  validateRegisterAgentRequest
} from "../../shared/src/index.js";
import type { components } from "../../shared/src/generated/openapi-types.js";

type RegisterAgentRequest = components["schemas"]["RegisterAgentRequest"];
type HeartbeatRequest = components["schemas"]["HeartbeatRequest"];
type UnregisterRequest = components["schemas"]["UnregisterRequest"];

export const TEST_SEED_A = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
export const TEST_SEED_B = "1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100";
export const TEST_BEARER_TOKEN = "integration-bearer-token";

export function createAgentCard(options?: {
  seedHex?: string;
  origin?: string;
  name?: string;
  skillId?: string;
  streaming?: boolean;
}) {
  const seedHex = options?.seedHex ?? TEST_SEED_A;
  const origin = options?.origin ?? "http://example.test";
  const skillId = options?.skillId ?? "research.summarize";
  const keyPair = deriveSigningKeyPair(parseSeedHex(seedHex));

  return {
    protocolVersion: "0.3.0" as const,
    name: options?.name ?? "fixture-agent",
    description: "Fixture Agent",
    url: `${origin}/a2a/jsonrpc`,
    preferredTransport: "JSONRPC" as const,
    version: "1.0.0",
    capabilities: {
      streaming: options?.streaming ?? true,
      pushNotifications: false as const
    },
    securitySchemes: {
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer" as const,
        bearerFormat: "opaque" as const
      }
    },
    security: [{ bearerAuth: [] }],
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [
      {
        id: skillId,
        name: "Research Summarize",
        description: "Summarize a text payload",
        tags: ["research", "summary"]
      }
    ],
    claw2clawRegistry: {
      keys: [
        {
          id: "main",
          algorithm: "ed25519" as const,
          publicKey: keyPair.publicKey
        }
      ]
    }
  };
}

export function createClawProfile(
  overrides?: Partial<RegisterAgentRequest["clawProfile"]>
): RegisterAgentRequest["clawProfile"] {
  return {
    visibility: "public",
    ownerType: "service",
    acceptsDelegation: false,
    requiresApprovalForSensitiveActions: true,
    relayRequired: false,
    region: "us",
    languages: ["en"],
    tags: ["test"],
    ...overrides
  };
}

export function createSignedRegisterRequest(options?: {
  seedHex?: string;
  agentCardUrl?: string;
  agentCard?: RegisterAgentRequest["agentCard"];
  clawProfile?: RegisterAgentRequest["clawProfile"];
  timestamp?: string;
  nonce?: string;
}) {
  const seedHex = options?.seedHex ?? TEST_SEED_A;
  const agentCardUrl = options?.agentCardUrl ?? "http://fixture.test/.well-known/agent-card.json";
  const origin = new URL(agentCardUrl).origin;
  const agentCard = options?.agentCard ?? createAgentCard({ seedHex, origin });
  const clawProfile = options?.clawProfile ?? createClawProfile();
  const body = {
    agentCardUrl,
    agentCard,
    clawProfile
  };

  const signature = signRegistryRequest({
    method: "POST",
    path: "/v1/agents/register",
    body,
    keyId: "main",
    seed: parseSeedHex(seedHex),
    timestamp: options?.timestamp ?? new Date().toISOString(),
    nonce: options?.nonce ?? randomUUID()
  });

  const payload = { ...body, signature } as RegisterAgentRequest;
  if (!validateRegisterAgentRequest(payload)) {
    throw new Error("generated register fixture is invalid");
  }
  return payload;
}

export function createSignedHeartbeatRequest(options: {
  id: string;
  seedHex?: string;
  timestamp?: string;
  nonce?: string;
}): HeartbeatRequest {
  const seedHex = options.seedHex ?? TEST_SEED_A;
  const body = {
    id: options.id,
    status: "online" as const
  };

  return {
    ...body,
    signature: signRegistryRequest({
      method: "POST",
      path: "/v1/agents/heartbeat",
      body,
      keyId: "main",
      seed: parseSeedHex(seedHex),
      timestamp: options.timestamp ?? new Date().toISOString(),
      nonce: options.nonce ?? randomUUID()
    })
  };
}

export function createSignedUnregisterRequest(options: {
  id: string;
  seedHex?: string;
  timestamp?: string;
  nonce?: string;
}): UnregisterRequest {
  const seedHex = options.seedHex ?? TEST_SEED_A;
  const body = { id: options.id };

  return {
    ...body,
    signature: signRegistryRequest({
      method: "POST",
      path: "/v1/agents/unregister",
      body,
      keyId: "main",
      seed: parseSeedHex(seedHex),
      timestamp: options.timestamp ?? new Date().toISOString(),
      nonce: options.nonce ?? randomUUID()
    })
  };
}

export function createFetchStub(cardMap: Record<string, unknown>): typeof fetch {
  return async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const payload = cardMap[url];
    if (!payload) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
}
