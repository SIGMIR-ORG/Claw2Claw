import type { RegistryStatus } from "./types.js";

export function computeRegistryStatus(
  lastSeenAt: string,
  heartbeatIntervalSeconds: number,
  heartbeatTtlSeconds: number,
  now: Date
): RegistryStatus {
  const lastSeenMs = Date.parse(lastSeenAt);
  const nowMs = now.getTime();
  const elapsedSeconds = (nowMs - lastSeenMs) / 1000;

  if (elapsedSeconds <= heartbeatIntervalSeconds) {
    return "online";
  }

  if (elapsedSeconds <= heartbeatTtlSeconds) {
    return "stale";
  }

  return "offline";
}
