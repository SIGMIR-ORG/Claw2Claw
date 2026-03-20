import path from "node:path";

import {
  DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
  DEFAULT_HEARTBEAT_TTL_SECONDS,
  REGISTRY_NONCE_TTL_SECONDS,
  REGISTRY_SIGNATURE_MAX_SKEW_SECONDS
} from "../../shared/src/index.js";

export interface ServerConfig {
  host: string;
  port: number;
  dbPath: string;
  heartbeatIntervalSeconds: number;
  heartbeatTtlSeconds: number;
  allowSelfAttested: boolean;
  requireHttpsForPublic: boolean;
  signatureMaxSkewSeconds: number;
  nonceTtlSeconds: number;
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

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env.SERVER_HOST ?? env.CLAW2CLAW_HOST ?? "127.0.0.1",
    port: parseInteger(env.SERVER_PORT, 8080),
    dbPath: path.resolve(env.SERVER_DB_PATH ?? "./server/data/registry.db"),
    heartbeatIntervalSeconds: parseInteger(
      env.SERVER_HEARTBEAT_INTERVAL_SECONDS,
      DEFAULT_HEARTBEAT_INTERVAL_SECONDS
    ),
    heartbeatTtlSeconds: parseInteger(
      env.SERVER_HEARTBEAT_TTL_SECONDS,
      DEFAULT_HEARTBEAT_TTL_SECONDS
    ),
    allowSelfAttested: parseBoolean(env.SERVER_ALLOW_SELF_ATTESTED, true),
    requireHttpsForPublic: parseBoolean(env.SERVER_REQUIRE_HTTPS_FOR_PUBLIC, false),
    signatureMaxSkewSeconds: parseInteger(
      env.SERVER_SIGNATURE_MAX_SKEW_SECONDS,
      REGISTRY_SIGNATURE_MAX_SKEW_SECONDS
    ),
    nonceTtlSeconds: parseInteger(env.SERVER_NONCE_TTL_SECONDS, REGISTRY_NONCE_TTL_SECONDS)
  };
}
