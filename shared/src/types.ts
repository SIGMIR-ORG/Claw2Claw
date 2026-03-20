export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type RegistryStatus = "online" | "stale" | "offline";
export type TrustTier = "self_attested" | "domain_verified" | "manually_verified";

export interface RegistrySignature {
  keyId: string;
  algorithm: "ed25519";
  timestamp: string;
  nonce: string;
  value: string;
}

export interface PublicSigningKey {
  id: string;
  algorithm: "ed25519";
  publicKey: string;
}
