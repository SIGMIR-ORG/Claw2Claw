export type A2ATaskState =
  | "submitted"
  | "working"
  | "completed"
  | "failed"
  | "canceled"
  | "input-required"
  | "rejected"
  | "auth-required";

export interface Skill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface SubmitTaskInput {
  skillId: string;
  message: unknown;
  stream?: boolean;
}

export interface TaskState {
  id: string;
  contextId?: string;
  state: A2ATaskState;
  artifacts?: unknown[];
  history?: unknown[];
  error?: { code: string; message: string };
}

export type TaskEvent =
  | {
      type: "status-update";
      payload: {
        state: A2ATaskState;
        final?: boolean;
        message?: string;
      };
    }
  | {
      type: "artifact-update";
      payload: {
        artifactId: string;
        text: string;
        append?: boolean;
        lastChunk?: boolean;
      };
    };

export interface OpenClawBridge {
  submitTask(input: SubmitTaskInput): Promise<{ taskId: string; contextId?: string }>;
  getTask(id: string): Promise<TaskState>;
  cancelTask(id: string): Promise<void>;
  streamTask(id: string): AsyncIterable<TaskEvent>;
  listPublicSkills(): Promise<Skill[]>;
}
