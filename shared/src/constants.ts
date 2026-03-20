export const A2A_PROTOCOL_VERSION = "0.3.0";
export const A2A_VERSION_HEADER = "0.3";
export const A2A_PREFERRED_TRANSPORT = "JSONRPC";
export const A2A_SDK_VERSION = "@a2a-js/sdk@0.3.13";
export const A2A_TCK_REF = "b03fefcae9767dad0e978e11573192f74252dfe3";

export const REGISTRY_SIGNATURE_ALGORITHM = "ed25519";
export const REGISTRY_SIGNATURE_MAX_SKEW_SECONDS = 300;
export const REGISTRY_NONCE_TTL_SECONDS = 600;
export const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 45;
export const DEFAULT_HEARTBEAT_TTL_SECONDS = 135;

export const REGISTRY_PATHS = {
  register: "/v1/agents/register",
  heartbeat: "/v1/agents/heartbeat",
  search: "/v1/agents/search",
  agentById: "/v1/agents/:id",
  unregister: "/v1/agents/unregister"
} as const;
