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

export type RuntimeLoggerConfig = {
  modeOverride?: RuntimeLogMode;
  terminalEnabled?: boolean;
  fileSink?: FileSinkOptions;
};

export type RuntimeLogger = {
  emit(event: RuntimeLogEventInput): void;
  getActiveMode(): RuntimeLogMode;
};

export function createRuntimeLogger(config: RuntimeLoggerConfig = {}): RuntimeLogger {
  const activeMode = resolveRuntimeLogMode(config.modeOverride);
  const terminalEnabled = config.terminalEnabled !== false;

  return {
    getActiveMode() {
      return activeMode;
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

export function getDefaultRuntimeLogger(): RuntimeLogger {
  if (!_defaultLogger) {
    _defaultLogger = createRuntimeLogger();
  }
  return _defaultLogger;
}

/** Replace the default logger (useful for tests or startup config). */
export function setDefaultRuntimeLogger(logger: RuntimeLogger): void {
  _defaultLogger = logger;
}

/** Convenience: emit a single event via the default logger. */
export function emitRuntimeLog(event: RuntimeLogEventInput): void {
  getDefaultRuntimeLogger().emit(event);
}
