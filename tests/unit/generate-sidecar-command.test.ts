import { describe, expect, it } from "vitest";

import { buildDockerRunCommand, parseCliArgs } from "../../scripts/generate-sidecar-command.mjs";

describe("generate-sidecar-command", () => {
  it("rewrites loopback OpenClaw URLs for containerized sidecars", () => {
    const result = buildDockerRunCommand({
      image: "claw2claw-sidecar:local",
      publicOrigin: "https://node.example.com",
      openclawBaseUrl: "http://127.0.0.1:3000",
      registryUrl: "https://claw2claw.cc",
      autoRegister: true,
      publicSkills: "research.summarize,tools.translate",
      bearerToken: "fixed-token",
      signingSeedHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    });

    expect(result.normalizedOpenClawBaseUrl).toBe("http://host.docker.internal:3000");
    expect(result.command).toContain("--add-host=host.docker.internal:host-gateway");
    expect(result.command).toContain("SIDECAR_OPENCLAW_BASE_URL='http://host.docker.internal:3000'");
    expect(result.command).toContain("SIDECAR_PUBLIC_SKILLS='research.summarize,tools.translate'");
    expect(result.command).toContain("SIDECAR_REGISTRY_URL='https://claw2claw.cc'");
    expect(result.command).toContain("A2A_BEARER_TOKEN='fixed-token'");
  });

  it("does not add host-gateway wiring for non-loopback bridge URLs by default", () => {
    const options = parseCliArgs([
      "--image", "claw2claw-sidecar:local",
      "--public-origin", "https://node.example.com",
      "--openclaw-base-url", "http://10.0.0.5:3000"
    ]);

    const result = buildDockerRunCommand({
      ...options,
      bearerToken: "fixed-token",
      signingSeedHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    });

    expect(result.normalizedOpenClawBaseUrl).toBe("http://10.0.0.5:3000");
    expect(result.command).not.toContain("--add-host=host.docker.internal:host-gateway");
  });
});
