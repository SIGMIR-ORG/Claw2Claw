import type { AgentCard, AgentSkill } from "@a2a-js/sdk";

import { assertValidAgentCard, deriveSigningKeyPair } from "../../../shared/src/index.js";
import type { SidecarConfig } from "../config/index.js";
import type { Skill } from "../bridge/openclaw-bridge.js";

function toAgentSkill(skill: Skill, config: SidecarConfig): AgentSkill {
  const agentSkill: AgentSkill = {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
    inputModes: skill.inputModes ?? config.defaultInputModes,
    outputModes: skill.outputModes ?? config.defaultOutputModes
  };

  if (skill.examples) {
    agentSkill.examples = skill.examples;
  }

  return agentSkill;
}

export function buildAgentCard(config: SidecarConfig, publicSkills: Skill[]): AgentCard {
  const signingKeyPair = deriveSigningKeyPair(config.signingSeed);

  const card = {
    name: config.agentName,
    description: config.agentDescription,
    url: `${config.publicOrigin}${config.jsonRpcPath}`,
    protocolVersion: config.protocolVersion,
    preferredTransport: config.preferredTransport,
    version: config.agentVersion,
    capabilities: {
      streaming: config.streamingEnabled,
      pushNotifications: false
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "opaque"
      }
    },
    security: [{ bearerAuth: [] }],
    defaultInputModes: config.defaultInputModes,
    defaultOutputModes: config.defaultOutputModes,
    skills: publicSkills.map((skill) => toAgentSkill(skill, config)),
    claw2clawRegistry: {
      keys: [
        {
          id: config.signingKeyId,
          algorithm: "ed25519",
          publicKey: signingKeyPair.publicKey
        }
      ]
    }
  } as AgentCard & {
    claw2clawRegistry: {
      keys: Array<{
        id: string;
        algorithm: "ed25519";
        publicKey: string;
      }>;
    };
  };

  return assertValidAgentCard(card) as AgentCard;
}
