import { describe, expect, it } from "vitest";

import {
  deriveSigningKeyPair,
  parseSeedHex,
  signRegistryRequest,
  verifyRegistrySignature
} from "../../shared/src/index.js";

describe("registry signing", () => {
  it("matches the canonical signing vector from the spec", () => {
    const seed = parseSeedHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    const keyPair = deriveSigningKeyPair(seed);

    expect(keyPair.publicKey).toBe("A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg");

    const body = {
      id: "11111111-2222-3333-4444-555555555555"
    };

    const signature = signRegistryRequest({
      method: "POST",
      path: "/v1/agents/unregister",
      body,
      keyId: "main",
      seed,
      timestamp: "2026-03-19T12:34:56Z",
      nonce: "4c9f1f2f-6d7e-4f1b-9c2d-4a8a1c5b8d3e"
    });

    expect(signature.value).toBe(
      "d_GAWirS10GjEJ_UQY8xebHpW2TEaWJjNlFdv8OglKBtAC8XGx0IfoHHawLMtJWn5vxxIGujWwpw6OzDXbvjAQ"
    );

    expect(
      verifyRegistrySignature({
        method: "POST",
        path: "/v1/agents/unregister",
        bodyWithoutSignature: body,
        signature,
        publicKey: keyPair.publicKey
      })
    ).toBe(true);
  });
});
