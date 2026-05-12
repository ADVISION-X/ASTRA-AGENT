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

function formatTerminalLine(event: RuntimeLogEvent, mode: RuntimeLogMode): string {
  const ts = event.createdAt.slice(11, 23); // HH:mm:ss.sss
  const level = event.level.toUpperCase().padEnd(5);
  const base = `[${ts}] ${level} [${event.owner}] ${event.eventType}`;

  if (mode === "FLOW") {
    const suffix =
      event.status ? ` status=${event.status}` : "";
    const mission = event.missionId ? ` mission=${event.missionId.slice(0, 8)}` : "";
    return `${base}${mission}${suffix}`;
  }

  const parts: string[] = [base];
  if (event.missionId) parts.push(`mission=${event.missionId.slice(0, 8)}`);
  if (event.traceId) parts.push(`trace=${event.traceId.slice(0, 8)}`);
  if (event.status) parts.push(`status=${event.status}`);
  if (event.reason) parts.push(`reason=${event.reason}`);
  if (event.durationMs !== undefined) parts.push(`durationMs=${event.durationMs}`);
  if (event.actionableMessage) parts.push(`=> ${event.actionableMessage}`);

  if (mode === "TRACE" || mode === "DEBUG") {
    if (event.preview) {
      for (const [k, v] of Object.entries(event.preview)) {
        parts.push(`${k}=${JSON.stringify(v).slice(0, 80)}`);
      }
    }
    if (event.hashes) {
      for (const [k, v] of Object.entries(event.hashes)) {
        parts.push(`${k}=${v.slice(0, 16)}…`);
      }
    }
    if (event.refs) {
      for (const [k, v] of Object.entries(event.refs)) {
        parts.push(`${k}=${v}`);
      }
    }
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
