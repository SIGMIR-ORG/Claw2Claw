import { afterEach, describe, expect, it } from "vitest";

import {
  validateGetAgentResponse,
  validateSearchResponse
} from "../../shared/src/index.js";
import type { components } from "../../shared/src/generated/openapi-types.js";
import {
  createAgentCard,
  createClawProfile,
  createFetchStub,
  createSignedHeartbeatRequest,
  createSignedRegisterRequest,
  TEST_SEED_A,
  TEST_SEED_B
} from "../helpers/fixtures.js";
import { createStartedRegistry } from "../helpers/server.js";

type RegisterAgentRequest = components["schemas"]["RegisterAgentRequest"];

describe("registry API", () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("rejects spoofed registrations when the live Agent Card does not match", async () => {
    const agentCardUrl = "https://alice.example/.well-known/agent-card.json";
    const submitted = createSignedRegisterRequest({
      seedHex: TEST_SEED_A,
      agentCardUrl
    });
    const liveCard = createAgentCard({
      seedHex: TEST_SEED_B,
      origin: "https://alice.example"
    });

    const registry = await createStartedRegistry({
      fetchImpl: createFetchStub({
        [agentCardUrl]: liveCard
      })
    });
    cleanup.push(registry.close);

    const response = await fetch(`${registry.origin}/v1/agents/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submitted)
    });
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("card_mismatch");
  });

  it("marks agents offline once heartbeat TTL expires", async () => {
    let now = new Date("2026-03-19T12:00:00Z");
    const agentCardUrl = "https://ttl.example/.well-known/agent-card.json";
    const registerRequest = createSignedRegisterRequest({
      seedHex: TEST_SEED_A,
      agentCardUrl,
      timestamp: now.toISOString()
    });

    const registry = await createStartedRegistry({
      fetchImpl: createFetchStub({
        [agentCardUrl]: registerRequest.agentCard
      }),
      clock: () => now
    });
    cleanup.push(registry.close);

    const registerResponse = await fetch(`${registry.origin}/v1/agents/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(registerRequest)
    });
    const registerPayload = (await registerResponse.json()) as { id: string };
    expect(registerResponse.status).toBe(200);

    now = new Date("2026-03-19T12:00:30Z");
    const heartbeatRequest = createSignedHeartbeatRequest({
      id: registerPayload.id,
      seedHex: TEST_SEED_A,
      timestamp: now.toISOString()
    });
    const heartbeatResponse = await fetch(`${registry.origin}/v1/agents/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(heartbeatRequest)
    });
    expect(heartbeatResponse.status).toBe(200);

    now = new Date("2026-03-19T12:03:31Z");
    const getResponse = await fetch(`${registry.origin}/v1/agents/${registerPayload.id}`);
    const getPayload = (await getResponse.json()) as { status: string };

    expect(validateGetAgentResponse(getPayload)).toBe(true);
    expect(getPayload.status).toBe("offline");
  });

  it("filters search results by skill, verified status, region, status, and delegation", async () => {
    const verifiedCardUrl = "https://verified.example/.well-known/agent-card.json";
    const selfAttestedCardUrl = "http://self.example/.well-known/agent-card.json";
    const otherCardUrl = "https://other.example/.well-known/agent-card.json";

    const verifiedRequest = createSignedRegisterRequest({
      seedHex: TEST_SEED_A,
      agentCardUrl: verifiedCardUrl,
      clawProfile: createClawProfile({
        region: "jp",
        acceptsDelegation: true
      })
    });
    const selfAttestedRequest = createSignedRegisterRequest({
      seedHex: TEST_SEED_B,
      agentCardUrl: selfAttestedCardUrl,
      clawProfile: createClawProfile({
        region: "jp",
        acceptsDelegation: true
      })
    });
    const otherRequest = createSignedRegisterRequest({
      seedHex: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      agentCardUrl: otherCardUrl,
      agentCard: createAgentCard({
        seedHex: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        origin: "https://other.example",
        skillId: "coding.refactor"
      }) as unknown as RegisterAgentRequest["agentCard"],
      clawProfile: createClawProfile({
        region: "us",
        acceptsDelegation: false
      })
    });

    const registry = await createStartedRegistry({
      fetchImpl: createFetchStub({
        [verifiedCardUrl]: verifiedRequest.agentCard,
        [selfAttestedCardUrl]: selfAttestedRequest.agentCard,
        [otherCardUrl]: otherRequest.agentCard
      })
    });
    cleanup.push(registry.close);

    for (const payload of [verifiedRequest, selfAttestedRequest, otherRequest]) {
      const response = await fetch(`${registry.origin}/v1/agents/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      expect(response.status).toBe(200);
    }

    const searchResponse = await fetch(
      `${registry.origin}/v1/agents/search?skill=research.summarize&verified=true&region=jp&status=online&acceptsDelegation=true`
    );
    const searchPayload = (await searchResponse.json()) as {
      results: Array<{ agentCardUrl: string; verified: boolean }>;
    };

    expect(validateSearchResponse(searchPayload)).toBe(true);
    expect(searchPayload.results).toHaveLength(1);
    expect(searchPayload.results[0]!.agentCardUrl).toBe(verifiedCardUrl);
    expect(searchPayload.results[0]!.verified).toBe(true);
  });
});
