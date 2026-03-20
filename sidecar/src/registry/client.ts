import { randomUUID } from "node:crypto";

import { signRegistryRequest } from "../../../shared/src/index.js";
import type { components } from "../../../shared/src/generated/openapi-types.js";

import type { AgentCard } from "@a2a-js/sdk";

import type { SidecarConfig } from "../config/index.js";

type ClawProfile = components["schemas"]["RegisterAgentRequest"]["clawProfile"];
type RegisterAgentResponse = components["schemas"]["RegisterAgentResponse"];
type HeartbeatResponse = components["schemas"]["HeartbeatResponse"];

export interface RegistryLifecycleOptions {
  config: SidecarConfig;
  fetchImpl?: typeof fetch;
  getAgentCard: () => Promise<AgentCard>;
}

export class SidecarRegistryLifecycle {
  private readonly fetchImpl: typeof fetch;
  private heartbeatTimer?: NodeJS.Timeout;
  private agentId?: string;
  private heartbeatIntervalSeconds: number;
  private running = false;

  constructor(private readonly options: RegistryLifecycleOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.heartbeatIntervalSeconds = options.config.requestedHeartbeatIntervalSeconds;
  }

  async start(): Promise<void> {
    if (!this.options.config.autoRegister || !this.options.config.registryUrl) {
      return;
    }

    this.running = true;
    await this.registerOrRetry();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    if (!this.agentId || !this.options.config.registryUrl) {
      return;
    }

    const path = "/v1/agents/unregister";
    const body = { id: this.agentId };
    const signature = signRegistryRequest({
      method: "POST",
      path,
      body,
      keyId: this.options.config.signingKeyId,
      seed: this.options.config.signingSeed,
      timestamp: new Date().toISOString(),
      nonce: randomUUID()
    });

    await this.fetchImpl(new URL(path, this.options.config.registryUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, signature })
    }).catch(() => undefined);
  }

  private async registerOrRetry(): Promise<void> {
    try {
      await this.register();
      this.scheduleHeartbeat();
    } catch (error) {
      console.error("registry registration failed", error);
      if (this.running) {
        this.heartbeatTimer = setTimeout(() => void this.registerOrRetry(), 5_000);
      }
    }
  }

  private async register(): Promise<void> {
    const registryUrl = this.options.config.registryUrl;
    if (!registryUrl) {
      return;
    }

    const agentCard = await this.options.getAgentCard();
    const clawProfile: ClawProfile = {
      visibility: this.options.config.visibility,
      ownerType: this.options.config.ownerType,
      acceptsDelegation: this.options.config.acceptsDelegation,
      requiresApprovalForSensitiveActions: this.options.config.requiresApprovalForSensitiveActions,
      relayRequired: false,
      region: this.options.config.region,
      languages: this.options.config.languages,
      tags: this.options.config.tags
    };

    const path = "/v1/agents/register";
    const unsignedBody = {
      agentCardUrl: `${this.options.config.publicOrigin}${this.options.config.agentCardPath}`,
      agentCard,
      clawProfile
    };
    const signature = signRegistryRequest({
      method: "POST",
      path,
      body: unsignedBody,
      keyId: this.options.config.signingKeyId,
      seed: this.options.config.signingSeed,
      timestamp: new Date().toISOString(),
      nonce: randomUUID()
    });

    const response = await this.fetchImpl(new URL(path, registryUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...unsignedBody, signature })
    });
    if (!response.ok) {
      throw new Error(`register failed with ${response.status}`);
    }

    const payload = (await response.json()) as RegisterAgentResponse;
    this.agentId = payload.id;
    this.heartbeatIntervalSeconds = payload.heartbeatIntervalSeconds;
  }

  private scheduleHeartbeat(): void {
    if (!this.running || !this.agentId) {
      return;
    }

    this.heartbeatTimer = setTimeout(() => void this.sendHeartbeat(), this.heartbeatIntervalSeconds * 1000);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.running || !this.agentId || !this.options.config.registryUrl) {
      return;
    }

    try {
      const path = "/v1/agents/heartbeat";
      const body = {
        id: this.agentId,
        status: "online" as const
      };
      const signature = signRegistryRequest({
        method: "POST",
        path,
        body,
        keyId: this.options.config.signingKeyId,
        seed: this.options.config.signingSeed,
        timestamp: new Date().toISOString(),
        nonce: randomUUID()
      });

      const response = await this.fetchImpl(new URL(path, this.options.config.registryUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, signature })
      });
      if (!response.ok) {
        throw new Error(`heartbeat failed with ${response.status}`);
      }

      await response.json() as HeartbeatResponse;
      this.scheduleHeartbeat();
    } catch (error) {
      console.error("registry heartbeat failed", error);
      if (this.running) {
        this.heartbeatTimer = setTimeout(() => void this.sendHeartbeat(), 5_000);
      }
    }
  }
}
