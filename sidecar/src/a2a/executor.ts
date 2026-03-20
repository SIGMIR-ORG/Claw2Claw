import { randomUUID } from "node:crypto";

import type { Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext
} from "@a2a-js/sdk/server";

import type {
  OpenClawBridge,
  TaskEvent as BridgeTaskEvent,
  TaskState as BridgeTaskState
} from "../bridge/openclaw-bridge.js";
import type { Skill } from "../bridge/openclaw-bridge.js";
import type { PublicSkillPolicy } from "../policy/policy.js";
import { resolveRequestedSkillId } from "../policy/policy.js";

export class OpenClawAgentExecutor implements AgentExecutor {
  constructor(
    private readonly bridge: OpenClawBridge,
    private readonly policy: PublicSkillPolicy,
    private readonly publicSkills: Skill[]
  ) {}

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const skillId = resolveRequestedSkillId(
      requestContext.userMessage,
      this.policy,
      this.publicSkills
    );

    const bridgeMessage = {
      ...(requestContext.userMessage as unknown as Record<string, unknown>),
      taskId: requestContext.taskId,
      contextId: requestContext.contextId
    };

    const { taskId } = await this.bridge.submitTask({
      skillId,
      message: bridgeMessage,
      stream: true
    });

    const initialTask = await this.bridge.getTask(taskId);
    eventBus.publish(this.toTask(requestContext, initialTask));

    for await (const event of this.bridge.streamTask(taskId)) {
      eventBus.publish(this.toA2AEvent(requestContext, initialTask.id, initialTask.contextId, event));

      if (event.type === "status-update" && event.payload.final) {
        eventBus.finished();
        break;
      }
    }
  }

  async cancelTask(taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    await this.bridge.cancelTask(taskId);
    const task = await this.bridge.getTask(taskId);
    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId: task.contextId ?? randomUUID(),
      status: {
        state: task.state,
        message: {
          kind: "message",
          role: "agent",
          messageId: randomUUID(),
          taskId,
          contextId: task.contextId,
          parts: [{ kind: "text", text: "Task canceled" }]
        },
        timestamp: new Date().toISOString()
      },
      final: true
    });
    eventBus.finished();
  }

  private toTask(requestContext: RequestContext, task: BridgeTaskState) {
    const artifacts = (task.artifacts ?? []).flatMap((artifact) => {
      if (
        typeof artifact === "object" &&
        artifact !== null &&
        "artifactId" in artifact &&
        "text" in artifact
      ) {
        return [
          {
            artifactId: String((artifact as { artifactId: unknown }).artifactId),
            parts: [
              {
                kind: "text" as const,
                text: String((artifact as { text: unknown }).text)
              }
            ]
          }
        ];
      }
      return [];
    });

    return {
      kind: "task" as const,
      id: task.id,
      contextId: task.contextId ?? requestContext.contextId,
      status: {
        state: task.state,
        timestamp: new Date().toISOString()
      },
      artifacts,
      history: (task.history ?? [requestContext.userMessage]) as Task["history"]
    } satisfies Task;
  }

  private toA2AEvent(
    requestContext: RequestContext,
    taskId: string,
    contextId: string | undefined,
    event: BridgeTaskEvent
  ) {
    if (event.type === "artifact-update") {
      return {
        kind: "artifact-update" as const,
        taskId,
        contextId: contextId ?? requestContext.contextId,
        artifact: {
          artifactId: event.payload.artifactId,
          parts: [{ kind: "text", text: event.payload.text }]
        },
        append: event.payload.append,
        lastChunk: event.payload.lastChunk
      } satisfies TaskArtifactUpdateEvent;
    }

    return {
      kind: "status-update" as const,
      taskId,
      contextId: contextId ?? requestContext.contextId,
      status: {
        state: event.payload.state,
        message: event.payload.message
          ? {
              kind: "message" as const,
              role: "agent" as const,
              messageId: randomUUID(),
              taskId,
              contextId: contextId ?? requestContext.contextId,
              parts: [{ kind: "text" as const, text: event.payload.message }]
            }
          : undefined,
        timestamp: new Date().toISOString()
      },
      final: event.payload.final ?? false
    } satisfies TaskStatusUpdateEvent;
  }
}
