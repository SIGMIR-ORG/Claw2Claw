import Ajv2020Import from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";

import agentCardSchema from "../../../spec/agent-card.schema.json" with { type: "json" };
import clawProfileSchema from "../../../spec/claw-profile.schema.json" with { type: "json" };
import type { components } from "../generated/openapi-types.js";
import { assertValid, validateAgentCardSchema as agentCardValidator, validateClawProfileSchema as clawProfileValidator } from "./index.js";

type RegisterAgentRequest = components["schemas"]["RegisterAgentRequest"];
type RegisterAgentResponse = components["schemas"]["RegisterAgentResponse"];
type HeartbeatRequest = components["schemas"]["HeartbeatRequest"];
type HeartbeatResponse = components["schemas"]["HeartbeatResponse"];
type SearchResult = components["schemas"]["SearchResult"];
type SearchResponse = components["schemas"]["SearchResponse"];
type GetAgentResponse = components["schemas"]["GetAgentResponse"];
type UnregisterRequest = components["schemas"]["UnregisterRequest"];
type UnregisterResponse = components["schemas"]["UnregisterResponse"];
type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];

const Ajv2020 = Ajv2020Import as unknown as new (options?: Record<string, unknown>) => {
  compile: <T>(schema: unknown) => import("ajv").ValidateFunction<T>;
};
const addFormats = addFormatsImport as unknown as (ajv: object) => void;

const ajv = new Ajv2020({
  allErrors: true,
  strict: false
});

addFormats(ajv);

const registrySignatureSchema = {
  type: "object",
  additionalProperties: false,
  required: ["keyId", "algorithm", "timestamp", "nonce", "value"],
  properties: {
    keyId: { type: "string", minLength: 1, maxLength: 128 },
    algorithm: { type: "string", const: "ed25519" },
    timestamp: { type: "string", format: "date-time" },
    nonce: { type: "string", minLength: 16, maxLength: 255 },
    value: { type: "string", pattern: "^[A-Za-z0-9_-]+$" }
  }
} as const;

const searchResultSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "agentCardUrl",
    "agentCardHash",
    "agentCardSnapshot",
    "clawProfile",
    "verified",
    "status",
    "lastSeenAt"
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    agentCardUrl: { type: "string", format: "uri" },
    agentCardHash: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    agentCardSnapshot: agentCardSchema,
    clawProfile: clawProfileSchema,
    verified: { type: "boolean" },
    status: { type: "string", enum: ["online", "stale", "offline"] },
    lastSeenAt: { type: "string", format: "date-time" }
  }
} as const;

export const validateRegisterAgentRequest = ajv.compile<RegisterAgentRequest>({
  type: "object",
  additionalProperties: false,
  required: ["agentCardUrl", "agentCard", "clawProfile", "signature"],
  properties: {
    agentCardUrl: { type: "string", format: "uri" },
    agentCard: agentCardSchema,
    clawProfile: clawProfileSchema,
    signature: registrySignatureSchema
  }
});

export const validateRegisterAgentResponse = ajv.compile<RegisterAgentResponse>({
  type: "object",
  additionalProperties: false,
  required: ["id", "trustTier", "heartbeatIntervalSeconds", "heartbeatTtlSeconds"],
  properties: {
    id: { type: "string", format: "uuid" },
    trustTier: { type: "string", enum: ["self_attested", "domain_verified", "manually_verified"] },
    heartbeatIntervalSeconds: { type: "integer", minimum: 1 },
    heartbeatTtlSeconds: { type: "integer", minimum: 1 }
  }
});

export const validateHeartbeatRequest = ajv.compile<HeartbeatRequest>({
  type: "object",
  additionalProperties: false,
  required: ["id", "status", "signature"],
  properties: {
    id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["online"] },
    load: { type: "number", minimum: 0, nullable: true },
    activeTasks: { type: "integer", minimum: 0, nullable: true },
    signature: registrySignatureSchema
  }
});

export const validateHeartbeatResponse = ajv.compile<HeartbeatResponse>({
  type: "object",
  additionalProperties: false,
  required: ["status", "recordedAt", "nextHeartbeatDeadlineAt"],
  properties: {
    status: { type: "string", enum: ["online"] },
    recordedAt: { type: "string", format: "date-time" },
    nextHeartbeatDeadlineAt: { type: "string", format: "date-time" }
  }
});

export const validateSearchResult = ajv.compile<SearchResult>(searchResultSchema);

export const validateSearchResponse = ajv.compile<SearchResponse>({
  type: "object",
  additionalProperties: false,
  required: ["results", "nextCursor"],
  properties: {
    results: {
      type: "array",
      items: searchResultSchema
    },
    nextCursor: {
      type: ["string", "null"]
    }
  }
});

export const validateGetAgentResponse = ajv.compile<GetAgentResponse>({
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "agentCardUrl",
    "agentCardHash",
    "agentCardSnapshot",
    "clawProfile",
    "verified",
    "status",
    "lastSeenAt",
    "lastValidatedAt",
    "heartbeatIntervalSeconds",
    "heartbeatTtlSeconds"
  ],
  properties: {
    ...searchResultSchema.properties,
    lastValidatedAt: { type: "string", format: "date-time" },
    heartbeatIntervalSeconds: { type: "integer", minimum: 1 },
    heartbeatTtlSeconds: { type: "integer", minimum: 1 }
  }
});

export const validateUnregisterRequest = ajv.compile<UnregisterRequest>({
  type: "object",
  additionalProperties: false,
  required: ["id", "signature"],
  properties: {
    id: { type: "string", format: "uuid" },
    signature: registrySignatureSchema
  }
});

export const validateUnregisterResponse = ajv.compile<UnregisterResponse>({
  type: "object",
  additionalProperties: false,
  required: ["ok"],
  properties: {
    ok: { type: "boolean", const: true }
  }
});

export const validateErrorEnvelope = ajv.compile<ErrorEnvelope>({
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" }
      }
    }
  }
});

export function assertValidAgentCard(value: unknown) {
  return assertValid(agentCardValidator, value, "agentCard");
}

export function assertValidClawProfile(value: unknown) {
  return assertValid(clawProfileValidator, value, "clawProfile");
}
