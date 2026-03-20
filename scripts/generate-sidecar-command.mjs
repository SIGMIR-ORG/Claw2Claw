import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function parseBooleanFlag(value) {
  if (value === undefined) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return value === "true" || value === "1";
}

function parseCsv(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`invalid integer value: ${value}`);
  }
  return parsed;
}

function assertUrl(name, value) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
}

function isLoopbackHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function generateOpaqueBearerToken() {
  return randomBytes(32).toString("base64url");
}

export function generateSigningSeedHex() {
  return randomBytes(32).toString("hex");
}

export function buildDockerRunCommand(input) {
  const image = input.image;
  if (!image) {
    throw new Error("image is required");
  }

  const publicOrigin = assertUrl("publicOrigin", input.publicOrigin);
  const openclawBaseUrl = assertUrl("openclawBaseUrl", input.openclawBaseUrl);
  const autoRegister = Boolean(input.autoRegister);
  const registryUrl = input.registryUrl ? assertUrl("registryUrl", input.registryUrl) : undefined;

  if (autoRegister && !registryUrl) {
    throw new Error("registryUrl is required when autoRegister is enabled");
  }

  const containerName = input.containerName ?? "claw2claw-sidecar";
  const hostPort = parseInteger(input.hostPort, 8090);
  const containerPort = parseInteger(input.containerPort, 8090);
  const hostAccessAlias = input.hostAccessAlias ?? "host.docker.internal";
  const useHostGatewayAlias = input.useHostGatewayAlias ?? isLoopbackHost(openclawBaseUrl.hostname);

  const normalizedOpenClawBaseUrl = new URL(openclawBaseUrl.href);
  if (useHostGatewayAlias && isLoopbackHost(normalizedOpenClawBaseUrl.hostname)) {
    normalizedOpenClawBaseUrl.hostname = hostAccessAlias;
  }

  const publicSkills = parseCsv(input.publicSkills, ["research.summarize"]);
  if (publicSkills.length === 0) {
    throw new Error("at least one public skill is required");
  }

  const languages = parseCsv(input.languages, ["en"]);
  const tags = parseCsv(input.tags, ["local"]);
  const bearerToken = input.bearerToken ?? generateOpaqueBearerToken();
  const signingSeedHex = input.signingSeedHex ?? generateSigningSeedHex();

  if (!/^[0-9a-f]{64}$/i.test(signingSeedHex)) {
    throw new Error("signingSeedHex must be exactly 32 bytes encoded as 64 hex characters");
  }

  const envVars = [
    ["SIDECAR_HOST", input.sidecarHost ?? "0.0.0.0"],
    ["SIDECAR_PORT", String(containerPort)],
    ["SIDECAR_PUBLIC_ORIGIN", publicOrigin.origin],
    ["SIDECAR_OPENCLAW_BASE_URL", normalizedOpenClawBaseUrl.href.replace(/\/$/, "")],
    ["SIDECAR_PUBLIC_SKILLS", publicSkills.join(",")],
    ["SIDECAR_AUTO_REGISTER", autoRegister ? "true" : "false"],
    ["SIDECAR_AGENT_NAME", input.agentName ?? "claw2claw-sidecar"],
    ["SIDECAR_AGENT_DESCRIPTION", input.agentDescription ?? "OpenClaw sidecar"],
    ["SIDECAR_AGENT_VERSION", input.agentVersion ?? "0.1.0"],
    ["SIDECAR_VISIBILITY", input.visibility ?? "private"],
    ["SIDECAR_OWNER_TYPE", input.ownerType ?? "service"],
    ["SIDECAR_ACCEPTS_DELEGATION", input.acceptsDelegation ? "true" : "false"],
    [
      "SIDECAR_REQUIRES_APPROVAL_FOR_SENSITIVE_ACTIONS",
      input.requiresApprovalForSensitiveActions === false ? "false" : "true"
    ],
    ["SIDECAR_REGION", input.region ?? "local"],
    ["SIDECAR_LANGUAGES", languages.join(",")],
    ["SIDECAR_TAGS", tags.join(",")],
    ["A2A_BEARER_TOKEN", bearerToken],
    ["SIDECAR_SIGNING_KEY_ID", input.signingKeyId ?? "main"],
    ["SIDECAR_SIGNING_SEED_HEX", signingSeedHex]
  ];

  if (registryUrl) {
    envVars.push(["SIDECAR_REGISTRY_URL", registryUrl.href.replace(/\/$/, "")]);
  }

  const lines = [
    "docker run -d",
    `  --name ${shellQuote(containerName)}`,
    "  --restart unless-stopped"
  ];

  if (useHostGatewayAlias) {
    lines.push(`  --add-host=${hostAccessAlias}:host-gateway`);
  }

  lines.push(`  -p ${hostPort}:${containerPort}`);

  for (const [key, value] of envVars) {
    lines.push(`  -e ${key}=${shellQuote(value)}`);
  }

  lines.push(`  ${shellQuote(image)}`);

  return {
    bearerToken,
    signingSeedHex,
    normalizedOpenClawBaseUrl: normalizedOpenClawBaseUrl.href.replace(/\/$/, ""),
    command: `${lines.join(" \\\n")}`
  };
}

export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      image: { type: "string" },
      "public-origin": { type: "string" },
      "openclaw-base-url": { type: "string" },
      "registry-url": { type: "string" },
      "public-skills": { type: "string" },
      languages: { type: "string" },
      tags: { type: "string" },
      "container-name": { type: "string" },
      "host-port": { type: "string" },
      "container-port": { type: "string" },
      "sidecar-host": { type: "string" },
      "agent-name": { type: "string" },
      "agent-description": { type: "string" },
      "agent-version": { type: "string" },
      visibility: { type: "string" },
      "owner-type": { type: "string" },
      region: { type: "string" },
      "signing-key-id": { type: "string" },
      "bearer-token": { type: "string" },
      "signing-seed-hex": { type: "string" },
      "host-access-alias": { type: "string" },
      "auto-register": { type: "boolean" },
      "accepts-delegation": { type: "boolean" },
      "no-requires-approval-for-sensitive-actions": { type: "boolean" },
      "no-host-gateway-alias": { type: "boolean" }
    },
    strict: true,
    allowPositionals: false
  });

  return {
    image: values.image,
    publicOrigin: values["public-origin"],
    openclawBaseUrl: values["openclaw-base-url"],
    registryUrl: values["registry-url"],
    publicSkills: values["public-skills"],
    languages: values.languages,
    tags: values.tags,
    containerName: values["container-name"],
    hostPort: values["host-port"],
    containerPort: values["container-port"],
    sidecarHost: values["sidecar-host"],
    agentName: values["agent-name"],
    agentDescription: values["agent-description"],
    agentVersion: values["agent-version"],
    visibility: values.visibility,
    ownerType: values["owner-type"],
    region: values.region,
    signingKeyId: values["signing-key-id"],
    bearerToken: values["bearer-token"],
    signingSeedHex: values["signing-seed-hex"],
    hostAccessAlias: values["host-access-alias"],
    autoRegister: parseBooleanFlag(values["auto-register"]),
    acceptsDelegation: parseBooleanFlag(values["accepts-delegation"]),
    requiresApprovalForSensitiveActions: !parseBooleanFlag(
      values["no-requires-approval-for-sensitive-actions"]
    ),
    useHostGatewayAlias: values["no-host-gateway-alias"] ? false : undefined
  };
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    const { command } = buildDockerRunCommand(options);
    process.stdout.write(`${command}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
