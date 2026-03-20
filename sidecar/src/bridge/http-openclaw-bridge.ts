import type {
  OpenClawBridge,
  Skill,
  SubmitTaskInput,
  TaskEvent,
  TaskState
} from "./openclaw-bridge.js";

export class HttpOpenClawBridge implements OpenClawBridge {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async submitTask(input: SubmitTaskInput): Promise<{ taskId: string; contextId?: string }> {
    const response = await this.fetchImpl(new URL("/tasks", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    return this.expectJson(response);
  }

  async getTask(id: string): Promise<TaskState> {
    const response = await this.fetchImpl(new URL(`/tasks/${id}`, this.baseUrl));
    return this.expectJson(response);
  }

  async cancelTask(id: string): Promise<void> {
    const response = await this.fetchImpl(new URL(`/tasks/${id}/cancel`, this.baseUrl), {
      method: "POST"
    });
    if (!response.ok) {
      throw new Error(`cancelTask failed with ${response.status}`);
    }
  }

  async *streamTask(id: string): AsyncIterable<TaskEvent> {
    const response = await this.fetchImpl(new URL(`/tasks/${id}/events`, this.baseUrl));
    if (!response.ok || !response.body) {
      throw new Error(`streamTask failed with ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        yield JSON.parse(trimmed) as TaskEvent;
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      yield JSON.parse(trailing) as TaskEvent;
    }
  }

  async listPublicSkills(): Promise<Skill[]> {
    const response = await this.fetchImpl(new URL("/skills", this.baseUrl));
    return this.expectJson(response);
  }

  private async expectJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`OpenClaw bridge request failed with ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
