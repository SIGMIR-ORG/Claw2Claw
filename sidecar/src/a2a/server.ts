import type { RequestHandler } from "express";

import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";

import { buildAgentCard } from "./agent-card.js";
import { RetainedEventBusManager } from "./event-bus-manager.js";
import { OpenClawAgentExecutor } from "./executor.js";
import { createBearerAuthMiddleware, createA2AVersionMiddleware, buildAuthenticatedUser } from "./auth.js";
import type { OpenClawBridge } from "../bridge/openclaw-bridge.js";
import type { SidecarConfig } from "../config/index.js";
import { createPublicSkillPolicy, filterPublicSkills } from "../policy/policy.js";

export async function buildSidecarA2AContext(config: SidecarConfig, bridge: OpenClawBridge) {
  const publicSkillPolicy = createPublicSkillPolicy(config.publicSkills);
  const publicSkills = filterPublicSkills(await bridge.listPublicSkills(), publicSkillPolicy);
  const agentCard = buildAgentCard(config, publicSkills);
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    new OpenClawAgentExecutor(bridge, publicSkillPolicy, publicSkills),
    new RetainedEventBusManager()
  );

  const middlewares: RequestHandler[] = [
    createA2AVersionMiddleware(config.protocolVersionHeader),
    createBearerAuthMiddleware(config.bearerTokenHashes)
  ];

  return {
    agentCard,
    requestHandler,
    middlewares,
    userBuilder: buildAuthenticatedUser
  };
}
