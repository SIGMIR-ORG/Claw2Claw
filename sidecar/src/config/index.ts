import { readFileSync } from "node:fs";
import path from "node:path";

import { AGENT_CARD_PATH } from "@a2a-js/sdk";

import {
  A2A_PREFERRED_TRANSPORT,
  A2A_PROTOCOL_VERSION,
  A2A_VERSION_HEADER,
  constantTimeBearerHash,
  parseSeedHex
} from "../../../shared/src/index.js";

export interface SidecarConfig {
  host: string;
  port: number;
  publicOrigin: string;
  agentCardPath: string;
  jsonRpcPath: string;
  protocolVersionHeader: string;
  protocolVersion: string;
  preferredTransport: string;
  agentName: string;
  agentDescription: string;
  agentVersion: string;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  publicSkills: string[];
  bearerTokenHashes: string[];
  bridgeBaseUrl?: string;
  registryUrl?: string;
  autoRegister: boolean;
  signingKeyId: string;
  signingSeed: Uint8Array;
  requestedHeartbeatIntervalSeconds: number;
  visibility: "public" | "private";
  ownerType: "personal" | "organization" | "service";
  acceptsDelegation: boolean;
  requiresApprovalForSensitiveActions: boolean;
  region: string;
  languages: string[];
  tags: string[];
  streamingEnabled: boolean;
  tckStreamingTimeoutSeconds: number;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return value === "true" || value === "1";
}

function parseInteger(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseFloatNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseList(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) {
    return defaultValue;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function loadSigningSeed(env: NodeJS.ProcessEnv): Uint8Array {
  if (env.SIDECAR_SIGNING_SEED_HEX) {
    return parseSeedHex(env.SIDECAR_SIGNING_SEED_HEX);
  }

  const keyFile = env.SIDECAR_SIGNING_PRIVATE_KEY_FILE;
  if (keyFile) {
    const contents = readFileSync(path.resolve(keyFile), "utf8").trim();
    return parseSeedHex(contents);
  }

  return parseSeedHex(
    "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
  );
}

function loadBearerTokenHashes(env: NodeJS.ProcessEnv): string[] {
  const explicitHashes = parseList(env.A2A_BEARER_TOKEN_HASHES, []);
  if (explicitHashes.length > 0) {
    return explicitHashes;
  }

  const token = env.A2A_BEARER_TOKEN ?? "dev-bearer-token-change-me";
  return [constantTimeBearerHash(token)];
}

export function loadSidecarConfig(env: NodeJS.ProcessEnv = process.env): SidecarConfig {
  const port = parseInteger(env.SIDECAR_PORT, 8090);
  const publicOrigin = trimTrailingSlash(
    env.SIDECAR_PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`
  );

  return {
    host: env.SIDECAR_HOST ?? env.CLAW2CLAW_HOST ?? "127.0.0.1",
    port,
    publicOrigin,
    agentCardPath: env.SIDECAR_AGENT_CARD_PATH ?? `/${AGENT_CARD_PATH}`,
    jsonRpcPath: env.SIDECAR_JSON_RPC_PATH ?? "/a2a/jsonrpc",
    protocolVersionHeader: A2A_VERSION_HEADER,
    protocolVersion: A2A_PROTOCOL_VERSION,
    preferredTransport: A2A_PREFERRED_TRANSPORT,
    agentName: env.SIDECAR_AGENT_NAME ?? "claw2claw-sidecar",
    agentDescription: env.SIDECAR_AGENT_DESCRIPTION ?? "OpenClaw sidecar",
    agentVersion: env.SIDECAR_AGENT_VERSION ?? "0.1.0",
    defaultInputModes: parseList(env.SIDECAR_DEFAULT_INPUT_MODES, ["text"]),
    defaultOutputModes: parseList(env.SIDECAR_DEFAULT_OUTPUT_MODES, ["text"]),
    publicSkills: parseList(env.SIDECAR_PUBLIC_SKILLS, ["research.summarize"]),
    bearerTokenHashes: loadBearerTokenHashes(env),
    bridgeBaseUrl: env.SIDECAR_OPENCLAW_BASE_URL,
    registryUrl: env.SIDECAR_REGISTRY_URL,
    autoRegister: parseBoolean(env.SIDECAR_AUTO_REGISTER, false),
    signingKeyId: env.SIDECAR_SIGNING_KEY_ID ?? "main",
    signingSeed: loadSigningSeed(env),
    requestedHeartbeatIntervalSeconds: parseInteger(
      env.SIDECAR_REQUESTED_HEARTBEAT_INTERVAL_SECONDS,
      45
    ),
    visibility: (env.SIDECAR_VISIBILITY as SidecarConfig["visibility"]) ?? "private",
    ownerType: (env.SIDECAR_OWNER_TYPE as SidecarConfig["ownerType"]) ?? "service",
    acceptsDelegation: parseBoolean(env.SIDECAR_ACCEPTS_DELEGATION, false),
    requiresApprovalForSensitiveActions: parseBoolean(
      env.SIDECAR_REQUIRES_APPROVAL_FOR_SENSITIVE_ACTIONS,
      true
    ),
    region: env.SIDECAR_REGION ?? "local",
    languages: parseList(env.SIDECAR_LANGUAGES, ["en"]),
    tags: parseList(env.SIDECAR_TAGS, ["local"]),
    streamingEnabled: parseBoolean(env.SIDECAR_STREAMING_ENABLED, true),
    tckStreamingTimeoutSeconds: parseFloatNumber(env.TCK_STREAMING_TIMEOUT, 2)
  };
}
