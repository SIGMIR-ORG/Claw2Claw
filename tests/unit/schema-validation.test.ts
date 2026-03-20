import { describe, expect, it } from "vitest";

import {
  validateAgentCardSchema,
  validateClawProfileSchema,
  validateRegisterAgentRequest
} from "../../shared/src/index.js";
import { createAgentCard, createClawProfile, createSignedRegisterRequest } from "../helpers/fixtures.js";

describe("schema validation", () => {
  it("accepts a valid Agent Card and Claw Profile", () => {
    const agentCard = createAgentCard();
    const clawProfile = createClawProfile();

    expect(validateAgentCardSchema(agentCard)).toBe(true);
    expect(validateClawProfileSchema(clawProfile)).toBe(true);
  });

  it("rejects invalid Agent Cards", () => {
    const invalidCard = {
      ...createAgentCard(),
      protocolVersion: "0.2.0"
    };

    expect(validateAgentCardSchema(invalidCard)).toBe(false);
  });

  it("accepts a fully signed register request", () => {
    const payload = createSignedRegisterRequest();
    expect(validateRegisterAgentRequest(payload)).toBe(true);
  });
});
