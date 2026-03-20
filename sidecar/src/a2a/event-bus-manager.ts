import { DefaultExecutionEventBus, type ExecutionEventBus, type ExecutionEventBusManager } from "@a2a-js/sdk/server";

interface EventBusEntry {
  bus: DefaultExecutionEventBus;
  finalized: boolean;
  cleanupTimer?: NodeJS.Timeout;
}

export class RetainedEventBusManager implements ExecutionEventBusManager {
  private readonly buses = new Map<string, EventBusEntry>();

  constructor(private readonly retentionMs: number = 30_000) {}

  createOrGetByTaskId(taskId: string): ExecutionEventBus {
    const existing = this.buses.get(taskId);
    if (existing) {
      return existing.bus;
    }

    const bus = new DefaultExecutionEventBus();
    const entry: EventBusEntry = { bus, finalized: false };
    bus.on("event", (event) => {
      if (event.kind === "status-update" && event.final) {
        entry.finalized = true;
        this.scheduleCleanup(taskId, entry);
      }
    });
    bus.once("finished", () => {
      entry.finalized = true;
      this.scheduleCleanup(taskId, entry);
    });

    this.buses.set(taskId, entry);
    return bus;
  }

  getByTaskId(taskId: string): ExecutionEventBus | undefined {
    return this.buses.get(taskId)?.bus;
  }

  cleanupByTaskId(taskId: string): void {
    const entry = this.buses.get(taskId);
    if (!entry) {
      return;
    }

    if (entry.finalized) {
      if (entry.cleanupTimer) {
        clearTimeout(entry.cleanupTimer);
      }
      this.buses.delete(taskId);
    }
  }

  private scheduleCleanup(taskId: string, entry: EventBusEntry): void {
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer);
    }

    entry.cleanupTimer = setTimeout(() => {
      this.buses.delete(taskId);
    }, this.retentionMs);
  }
}
