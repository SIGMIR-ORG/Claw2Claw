import { randomUUID } from "node:crypto";

import type {
  A2ATaskState,
  OpenClawBridge,
  Skill,
  SubmitTaskInput,
  TaskEvent,
  TaskState
} from "./openclaw-bridge.js";

interface TaskRecord extends TaskState {
  events: TaskEvent[];
  listeners: Set<() => void>;
  running: boolean;
  cancelRequested: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function titleizeSkillId(skillId: string): string {
  return skillId
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractUserText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "request";
  }

  const parts = (message as { parts?: Array<{ text?: string }> }).parts;
  if (!Array.isArray(parts)) {
    return "request";
  }

  const text = parts.find((part) => typeof part?.text === "string")?.text;
  return text ?? "request";
}

function extractMessageId(message: unknown): string | undefined {
  return typeof message === "object" && message !== null && "messageId" in message
    ? String((message as { messageId?: unknown }).messageId)
    : undefined;
}

function extractContinuationTaskId(message: unknown): string | undefined {
  return typeof message === "object" && message !== null && "taskId" in message
    ? String((message as { taskId?: unknown }).taskId)
    : undefined;
}

function extractContextId(message: unknown): string | undefined {
  return typeof message === "object" && message !== null && "contextId" in message
    ? String((message as { contextId?: unknown }).contextId)
    : undefined;
}

export class InMemoryOpenClawBridge implements OpenClawBridge {
  private readonly tasks = new Map<string, TaskRecord>();

  constructor(
    private readonly skills: Skill[],
    private readonly streamingTimeoutSeconds: number
  ) {}

  static fromSkillIds(skillIds: string[], streamingTimeoutSeconds: number): InMemoryOpenClawBridge {
    const skills = skillIds.map<Skill>((skillId) => ({
      id: skillId,
      name: titleizeSkillId(skillId),
      description: `Execute the ${skillId} OpenClaw workflow`,
      tags: skillId.split(/[._-]/g).filter(Boolean),
      inputModes: ["text"],
      outputModes: ["text"]
    }));
    return new InMemoryOpenClawBridge(skills, streamingTimeoutSeconds);
  }

  async submitTask(input: SubmitTaskInput): Promise<{ taskId: string; contextId?: string }> {
    const continuationTaskId = extractContinuationTaskId(input.message);
    const existing = continuationTaskId ? this.tasks.get(continuationTaskId) : undefined;

    const taskId = existing?.id ?? continuationTaskId ?? randomUUID();
    const contextId = existing?.contextId ?? extractContextId(input.message) ?? randomUUID();
    const history = [...(existing?.history ?? [])];
    history.push(input.message);

    const taskRecord: TaskRecord = existing ?? {
      id: taskId,
      contextId,
      state: "submitted",
      artifacts: [],
      history,
      events: [],
      listeners: new Set(),
      running: false,
      cancelRequested: false
    };

    taskRecord.history = history;
    taskRecord.state = "submitted";
    taskRecord.cancelRequested = false;
    this.tasks.set(taskId, taskRecord);

    if (!taskRecord.running) {
      taskRecord.running = true;
      void this.runTask(taskRecord, input);
    }

    return {
      taskId,
      contextId
    };
  }

  async getTask(id: string): Promise<TaskState> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    return this.snapshotTask(task);
  }

  async cancelTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    task.cancelRequested = true;
    this.markCanceled(task);
  }

  async *streamTask(id: string): AsyncIterable<TaskEvent> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    let index = 0;
    while (true) {
      while (index < task.events.length) {
        const event = task.events[index]!;
        index += 1;
        yield event;
      }

      if (this.isTerminal(task.state)) {
        return;
      }

      await new Promise<void>((resolve) => {
        const listener = () => {
          task.listeners.delete(listener);
          resolve();
        };
        task.listeners.add(listener);
      });
    }
  }

  async listPublicSkills(): Promise<Skill[]> {
    return this.skills.map((skill) => ({ ...skill }));
  }

  private async runTask(task: TaskRecord, input: SubmitTaskInput): Promise<void> {
    const messageId = extractMessageId(input.message);
    const userText = extractUserText(input.message);
    const minimumStreamingDurationMs = messageId?.startsWith("test-resubscribe-message-id")
      ? Math.ceil(this.streamingTimeoutSeconds * 2000 + 200)
      : messageId?.includes("-message-id-")
        ? 4_000
      : 400;

    try {
      this.emit(task, {
        type: "status-update",
        payload: {
          state: "working",
          final: false,
          message: `Running ${input.skillId}`
        }
      });

      await sleep(Math.max(150, minimumStreamingDurationMs / 2));

      if (task.cancelRequested) {
        this.markCanceled(task);
        return;
      }

      const artifact = {
        artifactId: `${input.skillId}-result`,
        text: `[${input.skillId}] ${userText}`
      };
      task.artifacts = [...(task.artifacts ?? []), artifact];
      this.emit(task, {
        type: "artifact-update",
        payload: artifact
      });

      await sleep(Math.max(150, minimumStreamingDurationMs / 2));

      if (task.cancelRequested) {
        this.markCanceled(task);
        return;
      }

      task.history = [
        ...(task.history ?? []),
        {
          kind: "message",
          role: "agent",
          messageId: randomUUID(),
          contextId: task.contextId,
          taskId: task.id,
          parts: [{ kind: "text", text: artifact.text }]
        }
      ];
      task.state = "completed";
      this.emit(task, {
        type: "status-update",
        payload: {
          state: "completed",
          final: true,
          message: artifact.text
        }
      });
    } catch (error) {
      task.state = "failed";
      task.error = {
        code: "bridge_failure",
        message: error instanceof Error ? error.message : "bridge execution failed"
      };
      this.emit(task, {
        type: "status-update",
        payload: {
          state: "failed",
          final: true,
          message: task.error.message
        }
      });
    } finally {
      task.running = false;
    }
  }

  private emit(task: TaskRecord, event: TaskEvent): void {
    if (event.type === "status-update") {
      task.state = event.payload.state;
      if (event.payload.state === "failed" && event.payload.message) {
        task.error = { code: "task_failed", message: event.payload.message };
      }
    }

    task.events.push(event);
    for (const listener of task.listeners) {
      listener();
    }
  }

  private markCanceled(task: TaskRecord): void {
    if (task.state === "canceled") {
      return;
    }

    this.emit(task, {
      type: "status-update",
      payload: {
        state: "canceled",
        final: true,
        message: "Task canceled"
      }
    });
  }

  private isTerminal(state: A2ATaskState): boolean {
    return state === "completed" || state === "failed" || state === "canceled" || state === "rejected";
  }

  private snapshotTask(task: TaskRecord): TaskState {
    return {
      id: task.id,
      contextId: task.contextId,
      state: task.state,
      artifacts: task.artifacts ? [...task.artifacts] : [],
      history: task.history ? [...task.history] : [],
      error: task.error ? { ...task.error } : undefined
    };
  }
}
