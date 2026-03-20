import { createHash } from "node:crypto";

import nacl from "tweetnacl";

import { REGISTRY_SIGNATURE_ALGORITHM } from "./constants.js";
import { canonicalJson, sha256Hex } from "./json.js";
import type { PublicSigningKey, RegistrySignature } from "./types.js";

export interface DerivedSigningKeyPair {
  publicKey: string;
  secretKey: Uint8Array;
  seed: Uint8Array;
}

export interface SignRegistryRequestInput {
  method: string;
  path: string;
  body: unknown;
  keyId: string;
  seed: Uint8Array;
  timestamp: string;
  nonce: string;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return new Uint8Array(Buffer.from(`${normalized}${padding}`, "base64"));
}

export function parseSeedHex(seedHex: string): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
    throw new Error("Ed25519 seed must be a 32-byte hex string");
  }
  return new Uint8Array(Buffer.from(seedHex, "hex"));
}

export function deriveSigningKeyPair(seed: Uint8Array): DerivedSigningKeyPair {
  if (seed.length !== 32) {
    throw new Error("Ed25519 seed must be 32 bytes");
  }

  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKey: base64UrlEncode(keyPair.publicKey),
    secretKey: keyPair.secretKey,
    seed
  };
}

export function registrySigningString(method: string, path: string, bodyWithoutSignature: unknown, timestamp: string, nonce: string): string {
  const bodyHash = sha256Hex(canonicalJson(bodyWithoutSignature));
  return [method.toUpperCase(), path, bodyHash, timestamp, nonce].join("\n");
}

export function signRegistryRequest(input: SignRegistryRequestInput): RegistrySignature {
  const keyPair = deriveSigningKeyPair(input.seed);
  const signingString = registrySigningString(
    input.method,
    input.path,
    input.body,
    input.timestamp,
    input.nonce
  );
  const signatureBytes = nacl.sign.detached(new TextEncoder().encode(signingString), keyPair.secretKey);
  return {
    keyId: input.keyId,
    algorithm: REGISTRY_SIGNATURE_ALGORITHM,
    timestamp: input.timestamp,
    nonce: input.nonce,
    value: base64UrlEncode(signatureBytes)
  };
}

export function verifyRegistrySignature(options: {
  method: string;
  path: string;
  bodyWithoutSignature: unknown;
  signature: RegistrySignature;
  publicKey: string;
}): boolean {
  if (options.signature.algorithm !== REGISTRY_SIGNATURE_ALGORITHM) {
    return false;
  }

  const signingString = registrySigningString(
    options.method,
    options.path,
    options.bodyWithoutSignature,
    options.signature.timestamp,
    options.signature.nonce
  );
  return nacl.sign.detached.verify(
    new TextEncoder().encode(signingString),
    base64UrlDecode(options.signature.value),
    base64UrlDecode(options.publicKey)
  );
}

export function sha256Buffer(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function constantTimeBearerHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resolvePublicKey(keyId: string, keys: PublicSigningKey[]): PublicSigningKey | undefined {
  return keys.find((key) => key.id === keyId);
}
