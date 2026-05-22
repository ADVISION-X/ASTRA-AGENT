// Runtime Log Spine — Logger
// The single emit point for all structured runtime events.
// emitRuntimeLog is the only way to produce a RuntimeLogEvent.
// Logger is NOT a capability group, NOT an event bus, NOT a persistence owner.

import { randomUUID } from "node:crypto";

import type { RuntimeLogEvent, RuntimeLogEventInput } from "./schema.js";
import type { RuntimeLogMode } from "./mode.js";
import type { FileSinkOptions } from "./sinks.js";
import { resolveRuntimeLogMode } from "./mode.js";
import { writeTerminalSink, writeFileSink } from "./sinks.js";

type RuntimeLoggerConfig = {
  modeOverride?: RuntimeLogMode;
  terminalEnabled?: boolean;
  fileSink?: FileSinkOptions;
};

export type RuntimeLogger = {
  emit(event: RuntimeLogEventInput): void;
  getActiveMode(): RuntimeLogMode;
  /** Returns true when DEBUG or TRACE mode is active — use to guard debug payload construction. */
  isDebugEnabled(): boolean;
  /** Returns true when TRACE mode is active — use to guard heavy/verbose payload construction. */
  isTraceEnabled(): boolean;
};

export function createRuntimeLogger(config: RuntimeLoggerConfig = {}): RuntimeLogger {
  const activeMode = resolveRuntimeLogMode(config.modeOverride);
  const terminalEnabled = config.terminalEnabled !== false;

  return {
    getActiveMode() {
      return activeMode;
    },

    isDebugEnabled() {
      return activeMode === "DEBUG" || activeMode === "TRACE";
    },

    isTraceEnabled() {
      return activeMode === "TRACE";
    },

    emit(input: RuntimeLogEventInput): void {
      const event: RuntimeLogEvent = {
        ...input,
        eventId: randomUUID(),
        createdAt: new Date().toISOString(),
      };

      if (terminalEnabled) {
        writeTerminalSink(event, activeMode);
      }

      if (config.fileSink) {
        writeFileSink(event, config.fileSink);
      }
    },
  };
}

/** Module-level default logger. Modules that receive a runtimeLogger should use
 *  that injected instance instead of this default. */
let _defaultLogger: RuntimeLogger | null = null;

/** Replace the default logger (useful for tests or startup config). */
export function setDefaultRuntimeLogger(logger: RuntimeLogger): void {
  _defaultLogger = logger;
}

