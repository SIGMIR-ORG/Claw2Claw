import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { createAuthorizedClient, createStartedSidecar } from "../helpers/sidecar.js";

describe("sidecar A2A integration", () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("handles official SDK message/send and tasks/get flows", async () => {
    const sidecar = await createStartedSidecar();
    cleanup.push(async () => {
      await sidecar.registryLifecycle.stop();
      await sidecar.close();
    });

    const { client } = await createAuthorizedClient(sidecar.origin, sidecar.token);
    const result = await client.sendMessage({
      message: {
        kind: "message",
        messageId: randomUUID(),
        role: "user",
        parts: [{ kind: "text", text: "Summarize this fixture" }]
      }
    });

    expect(result.kind).toBe("task");
    if (result.kind !== "task") {
      throw new Error("expected task response");
    }
    const taskId = result.id;

    let task = await client.getTask({ id: taskId, historyLength: 10 });
    while (task.status.state !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 100));
      task = await client.getTask({ id: taskId, historyLength: 10 });
    }

    expect(task.artifacts?.[0]?.parts?.[0]).toMatchObject({
      kind: "text",
      text: "[research.summarize] Summarize this fixture"
    });
  });

  it("rejects missing bearer auth before skill execution", async () => {
    const sidecar = await createStartedSidecar();
    cleanup.push(async () => {
      await sidecar.registryLifecycle.stop();
      await sidecar.close();
    });

    const response = await fetch(`${sidecar.origin}${sidecar.config.jsonRpcPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "message/send",
        params: {
          message: {
            kind: "message",
            messageId: randomUUID(),
            role: "user",
            parts: [{ kind: "text", text: "auth test" }]
          }
        }
      })
    });

    expect(response.status).toBe(401);
  });

  it("streams ordered events and supports tasks/resubscribe", async () => {
    const sidecar = await createStartedSidecar();
    cleanup.push(async () => {
      await sidecar.registryLifecycle.stop();
      await sidecar.close();
    });

    const { transport } = await createAuthorizedClient(sidecar.origin, sidecar.token);
    const initialEvents: Array<{ kind: string; id?: string; taskId?: string }> = [];
    let taskId: string | undefined;

    for await (const event of transport.sendMessageStream({
      message: {
        kind: "message",
        messageId: `test-resubscribe-message-id-${randomUUID()}`,
        role: "user",
        parts: [{ kind: "text", text: "stream me" }]
      }
    })) {
      initialEvents.push({
        kind: event.kind,
        id: "id" in event ? event.id : undefined,
        taskId: "taskId" in event ? event.taskId : undefined
      });
      if (event.kind === "task") {
        taskId = event.id;
      }
      if (initialEvents.length >= 2) {
        break;
      }
    }

    expect(taskId).toBeDefined();

    const resumedKinds: string[] = [];
    for await (const event of transport.resubscribeTask({ id: taskId! })) {
      resumedKinds.push(event.kind);
      if (event.kind === "status-update" && event.final) {
        break;
      }
    }

    expect(initialEvents[0]?.kind).toBe("task");
    expect(resumedKinds).toContain("artifact-update");
    expect(resumedKinds).toContain("status-update");
  });
});
