// Runtime Log Spine — Sinks
// Terminal sink: display-only real-time relay.
// File debug bundle sink: full structured JSONL bundle.
// Neither sink is persistence truth. Forensics governs final truth.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { RuntimeLogEvent } from "./schema.js";
import type { RuntimeLogMode } from "./mode.js";
import { isEventVisibleInMode } from "./mode.js";
import { redactRuntimeLogPayload } from "./redaction.js";

// ─── Terminal Sink ───────────────────────────────────────────────────────────

function appendRecordParts<TValue>(
  parts: string[],
  record: Record<string, TValue> | undefined,
  render: (key: string, value: TValue) => string,
): void {
  if (!record) {
    return;
  }
  for (const [key, value] of Object.entries(record)) {
    parts.push(render(key, value));
  }
}

function appendDebugParts(parts: string[], event: RuntimeLogEvent): void {
  appendRecordParts(parts, event.preview, (key, value) => `${key}=${JSON.stringify(value).slice(0, 80)}`);
  appendRecordParts(parts, event.hashes, (key, value) => `${key}=${value.slice(0, 16)}…`);
  appendRecordParts(parts, event.refs, (key, value) => `${key}=${value}`);
}

function formatFlowTerminalLine(base: string, event: RuntimeLogEvent): string {
  const suffix = event.status ? ` status=${event.status}` : "";
  const mission = event.missionId ? ` mission=${event.missionId.slice(0, 8)}` : "";
  return `${base}${mission}${suffix}`;
}

function appendCoreParts(parts: string[], event: RuntimeLogEvent): void {
  const coreParts = [
    event.missionId ? `mission=${event.missionId.slice(0, 8)}` : null,
    event.traceId ? `trace=${event.traceId.slice(0, 8)}` : null,
    event.status ? `status=${event.status}` : null,
    event.reason ? `reason=${event.reason}` : null,
    event.durationMs !== undefined ? `durationMs=${event.durationMs}` : null,
    event.actionableMessage ? `=> ${event.actionableMessage}` : null,
  ];
  for (const part of coreParts) {
    if (part) {
      parts.push(part);
    }
  }
}

function formatTerminalLine(event: RuntimeLogEvent, mode: RuntimeLogMode): string {
  const ts = event.createdAt.slice(11, 23); // HH:mm:ss.sss
  const level = event.level.toUpperCase().padEnd(5);
  const base = `[${ts}] ${level} [${event.owner}] ${event.eventType}`;

  if (mode === "FLOW") {
    return formatFlowTerminalLine(base, event);
  }

  const parts: string[] = [base];
  appendCoreParts(parts, event);

  if (mode === "TRACE" || mode === "DEBUG") {
    appendDebugParts(parts, event);
  }

  return parts.join(" | ");
}

export function writeTerminalSink(event: RuntimeLogEvent, activeMode: RuntimeLogMode): void {
  if (!isEventVisibleInMode(event.modeVisibility, activeMode)) return;
  const line = formatTerminalLine(event, activeMode);
  process.stdout.write(line + "\n");
}

// ─── File Debug Bundle Sink ──────────────────────────────────────────────────

export type FileSinkOptions = {
  bundlePath: string; // e.g. tmp/runtime-logs/<runId>.jsonl
  redact?: boolean;   // default true
};

export function writeFileSink(
  event: RuntimeLogEvent,
  options: FileSinkOptions,
): void {
  const shouldRedact = options.redact !== false;
  let serializable: RuntimeLogEvent = event;

  if (shouldRedact && event.payload) {
    serializable = { ...event, payload: redactRuntimeLogPayload(event.payload) };
  }

  const line = JSON.stringify(serializable) + "\n";

  try {
    mkdirSync(dirname(options.bundlePath), { recursive: true });
    appendFileSync(options.bundlePath, line, "utf8");
  } catch {
    // File sink failure must NOT crash the mission. Log nothing else here.
  }
}
