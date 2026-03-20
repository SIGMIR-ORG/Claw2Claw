import {
  A2A_PREFERRED_TRANSPORT,
  A2A_PROTOCOL_VERSION,
  assertValidAgentCard,
  hashCanonicalJsonPrefixed
} from "../../../shared/src/index.js";
import type { RegisteredAgentCard } from "../models/registry.js";

import { HttpError } from "../models/errors.js";

export interface FetchedAgentCard {
  agentCard: RegisteredAgentCard;
  agentCardHash: string;
}

export async function fetchAndValidateAgentCard(
  fetchImpl: typeof fetch,
  agentCardUrl: string
): Promise<FetchedAgentCard> {
  const response = await fetchImpl(agentCardUrl, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new HttpError(
      400,
      "agent_card_fetch_failed",
      `failed to fetch live Agent Card from ${agentCardUrl}`
    );
  }

  const payload = await response.json();
  const agentCard = assertValidAgentCard(payload) as RegisteredAgentCard;

  if (agentCard.protocolVersion !== A2A_PROTOCOL_VERSION) {
    throw new HttpError(400, "invalid_agent_card", "Agent Card protocolVersion must be 0.3.0");
  }

  if (agentCard.preferredTransport !== A2A_PREFERRED_TRANSPORT) {
    throw new HttpError(400, "invalid_agent_card", "Agent Card preferredTransport must be JSONRPC");
  }

  return {
    agentCard,
    agentCardHash: hashCanonicalJsonPrefixed(agentCard)
  };
}
