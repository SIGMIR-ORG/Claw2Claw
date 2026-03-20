import type { PublicSigningKey, RegistryStatus, TrustTier } from "../../../shared/src/index.js";
import type { components } from "../../../shared/src/generated/openapi-types.js";

export type RegisterAgentRequest = components["schemas"]["RegisterAgentRequest"];
export type RegisterAgentResponse = components["schemas"]["RegisterAgentResponse"];
export type HeartbeatRequest = components["schemas"]["HeartbeatRequest"];
export type HeartbeatResponse = components["schemas"]["HeartbeatResponse"];
export type SearchResponse = components["schemas"]["SearchResponse"];
export type GetAgentResponse = components["schemas"]["GetAgentResponse"];
export type UnregisterRequest = components["schemas"]["UnregisterRequest"];
export type UnregisterResponse = components["schemas"]["UnregisterResponse"];

export type RegisteredAgentCard = RegisterAgentRequest["agentCard"];
export type ClawProfile = RegisterAgentRequest["clawProfile"];

export interface StoredRegistryRecord {
  id: string;
  agentCardUrl: string;
  agentCardHash: string;
  agentCardSnapshot: RegisteredAgentCard;
  clawProfile: ClawProfile;
  trustTier: TrustTier;
  signingKeys: PublicSigningKey[];
  lastSeenAt: string;
  lastValidatedAt: string;
  heartbeatIntervalSeconds: number;
  heartbeatTtlSeconds: number;
  createdAt: string;
  updatedAt: string;
  tombstonedAt: string | null;
}

export interface SearchFilters {
  skill?: string;
  verified?: boolean;
  region?: string;
  status?: RegistryStatus;
  acceptsDelegation?: boolean;
  limit: number;
  cursor?: string;
}
