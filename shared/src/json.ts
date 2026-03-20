import { canonicalize } from "json-canonicalize";
import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  return canonicalize(value);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashCanonicalJson(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function hashCanonicalJsonPrefixed(value: unknown): string {
  return `sha256:${hashCanonicalJson(value)}`;
}

export function withoutSignature<T extends { signature?: unknown }>(value: T): Omit<T, "signature"> {
  const clone = { ...value };
  delete clone.signature;
  return clone;
}

export function normalizeQueryString(query: string): string {
  if (!query) {
    return "";
  }

  const params = Array.from(new URLSearchParams(query).entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) {
      return leftValue.localeCompare(rightValue);
    }
    return leftKey.localeCompare(rightKey);
  });

  const normalized = new URLSearchParams(params);
  const rendered = normalized.toString();
  return rendered ? `?${rendered}` : "";
}

export function normalizeRequestTarget(pathname: string, query: string | undefined): string {
  return `${pathname}${normalizeQueryString(query ?? "")}`;
}
