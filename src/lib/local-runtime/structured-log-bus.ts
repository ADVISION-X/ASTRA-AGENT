import type { RuntimeActionEvent, StructuredRuntimeEvent } from "../../types/structured-log.js";

export type StructuredLogEntry =
  | { kind: "event"; entry: StructuredRuntimeEvent }
  | { kind: "action"; entry: RuntimeActionEvent };

export type StructuredLogListener = (entry: StructuredLogEntry) => void;

export class StructuredLogBus {
  private readonly listeners = new Set<StructuredLogListener>();

  emitRuntimeEvent(entry: StructuredRuntimeEvent): void {
    this.publish({ kind: "event", entry });
  }

  emitActionLog(entry: RuntimeActionEvent): void {
    this.publish({ kind: "action", entry });
  }

  subscribe(listener: StructuredLogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private publish(entry: StructuredLogEntry): void {
    for (const listener of this.listeners) {
      listener(entry);
    }
  }
}
