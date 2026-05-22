import type { StructuredRuntimeEvent } from "../../types/structured-log.js";
import type { StructuredLogEntry, StructuredLogListener } from "./structured-log-bus.js";

type StructuredLogLevel = "info" | "debug";

const INFO_RUNTIME_EVENT_TYPES = new Set([
  "HUMAN_COMMAND_DRAFTED",
  "HUMAN_COMMAND_RECEIVED",
  "HUMAN_COMMAND_VALIDATED",
  "MISSION_READINESS_CHECK_STARTED",
  "MISSION_PREFLIGHT_STARTED",
  "MISSION_PREFLIGHT_PASSED",
  "MISSION_PREFLIGHT_FAILED",
  "COMMAND_ACCEPTED",
  "COMMAND_REJECTED",
  "COMMAND_DISPATCH_READY",
  "COMMAND_RESPONSE_SENT",
  "MISSION_START_CONTEXT_CONFIRMED",
  "MISSION_BACKGROUND_FAILED",
  "MISSION_BACKGROUND_STALLED",
  "MISSION_STARTED",
  "MISSION_COMPLETED",
  "MISSION_FAILED",
  "MISSION_STOPPED",
  "MISSION_PAUSED",
  "MISSION_RESUMED",
  "ROUND_STARTED",
  "ROUND_COMPLETED",
  "ROUND_FAILED",
  "AI_INVOCATION_STARTED",
  "AI_INVOCATION_COMPLETED",
  "AI_INVOCATION_FAILED",
  "ABILITY_DISPATCH_STARTED",
  "ABILITY_DISPATCH_COMPLETED",
  "ABILITY_DISPATCH_FAILED",
  "SCREENSHOT_CAPTURED",
  "FORENSICS_RECORD_WRITTEN",
]);

function shouldLogAtInfoLevel(entry: StructuredRuntimeEvent): boolean {
  return INFO_RUNTIME_EVENT_TYPES.has(entry.eventType);
}

function formatRuntimeEvent(entry: StructuredRuntimeEvent): string {
  const parts: string[] = [
    `[grasseye:${entry.level?.toLowerCase() ?? "info"}]`,
    `[${entry.component ? entry.component : entry.abilityGroupId ? entry.abilityGroupId : "runtime"}]`,
    entry.eventType,
  ];
  if (entry.missionId) parts.push(`mission=${entry.missionId.slice(0, 8)}`);
  return parts.join(" ");
}

function formatActionLog(entry: Record<string, unknown>): string {
  const parts: string[] = [
    "[grasseye:action]",
    `[${String(entry["abilityGroupId"] ? entry["abilityGroupId"] : entry["component"] ? entry["component"] : "runtime")}]`,
    String(entry["childCapabilityId"] ? entry["childCapabilityId"] : entry["actionType"] ? entry["actionType"] : "action"),
    String(entry["status"] ?? ""),
  ];
  return parts.filter(Boolean).join(" ");
}

export function isStructuredLogStdoutEnabled(): boolean {
  return process.env["GRASSEYE_STRUCTURED_LOG_STDOUT"] === "1"
    || process.env["GRASSEYE_STRUCTURED_LOG_STDOUT"] === "true";
}

export function resolveStructuredLogLevel(): StructuredLogLevel {
  const raw = process.env["GRASSEYE_STRUCTURED_LOG_LEVEL"];
  return raw === "debug" ? "debug" : "info";
}

const writeEventLog = (
  level: StructuredLogLevel,
  entry: Extract<StructuredLogEntry, { kind: "event" }>,
): void => {
  if (level !== "debug" && !shouldLogAtInfoLevel(entry.entry)) return;
  process.stdout.write(formatRuntimeEvent(entry.entry) + "\n");
};

const writeActionLog = (
  level: StructuredLogLevel,
  entry: Extract<StructuredLogEntry, { kind: "action" }>,
): void => {
  if (level !== "debug") return;
  process.stdout.write(formatActionLog(entry.entry as Record<string, unknown>) + "\n");
};

export function createStructuredTerminalLogListener(level: StructuredLogLevel): StructuredLogListener {
  return (entry: StructuredLogEntry) => {
    try {
      if (entry.kind === "event") {
        writeEventLog(level, entry);
        return;
      }
      if (entry.kind === "action") {
        writeActionLog(level, entry);
      }
    } catch {
      // terminal logging must not throw
    }
  };
}