/* eslint-disable */
/* This file is generated from local Claw2Claw specs. */

/**
 * Local validation subset for A2A 0.3.0 Agent Cards registered with Claw2Claw. Full runtime validation MUST also validate against the official A2A 0.3.0 AgentCard contract.
 */
export interface Claw2ClawRegisteredAgentCard {
  protocolVersion: '0.3.0';
  name: string;
  description: string;
  url: string;
  preferredTransport: 'JSONRPC';
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: false;
    [k: string]: unknown;
  };
  securitySchemes: {
    bearerAuth: {
      type: 'http';
      scheme: 'bearer';
      bearerFormat: 'opaque';
    };
  };
  /**
   * @minItems 1
   * @maxItems 1
   */
  security: [
    {
      /**
       * @maxItems 0
       */
      bearerAuth: [];
    }
  ];
  /**
   * @minItems 1
   */
  defaultInputModes: [string, ...string[]];
  /**
   * @minItems 1
   */
  defaultOutputModes: [string, ...string[]];
  /**
   * @minItems 1
   */
  skills: [AgentSkill, ...AgentSkill[]];
  supportsAuthenticatedExtendedCard?: false;
  /**
   * @maxItems 0
   */
  additionalInterfaces?: [];
  claw2clawRegistry: Claw2ClawRegistryExtension;
  [k: string]: unknown;
}
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  /**
   * @minItems 1
   */
  tags: [string, ...string[]];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
  security?: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface Claw2ClawRegistryExtension {
  /**
   * @minItems 1
   */
  keys: [PublicSigningKey, ...PublicSigningKey[]];
}
export interface PublicSigningKey {
  id: string;
  algorithm: 'ed25519';
  publicKey: string;
}
