import express from "express";

import { agentCardHandler, jsonRpcHandler } from "@a2a-js/sdk/server/express";

import { buildSidecarA2AContext } from "./a2a/server.js";
import { HttpOpenClawBridge } from "./bridge/http-openclaw-bridge.js";
import { InMemoryOpenClawBridge } from "./bridge/in-memory-openclaw-bridge.js";
import type { OpenClawBridge } from "./bridge/openclaw-bridge.js";
import type { SidecarConfig } from "./config/index.js";
import { SidecarRegistryLifecycle } from "./registry/client.js";

function createBridge(config: SidecarConfig): OpenClawBridge {
  if (config.bridgeBaseUrl) {
    return new HttpOpenClawBridge(config.bridgeBaseUrl);
  }

  return InMemoryOpenClawBridge.fromSkillIds(
    config.publicSkills,
    config.tckStreamingTimeoutSeconds
  );
}

export async function createSidecarApp(config: SidecarConfig) {
  const bridge = createBridge(config);
  const a2a = await buildSidecarA2AContext(config, bridge);
  const registryLifecycle = new SidecarRegistryLifecycle({
    config,
    getAgentCard: () => a2a.requestHandler.getAgentCard()
  });

  const app = express();
  app.use(config.agentCardPath, agentCardHandler({ agentCardProvider: a2a.requestHandler }));
  app.use(config.jsonRpcPath, ...a2a.middlewares, jsonRpcHandler({
    requestHandler: a2a.requestHandler,
    userBuilder: a2a.userBuilder
  }));

  return {
    app,
    bridge,
    requestHandler: a2a.requestHandler,
    agentCard: a2a.agentCard,
    registryLifecycle
  };
}
