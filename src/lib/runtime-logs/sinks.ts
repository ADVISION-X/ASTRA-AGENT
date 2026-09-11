import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

import { isEventVisibleInMode, type RuntimeLogMode } from "./mode.js";
import type { RuntimeLogEventV2 } from "./runtime-event-contract.js";

export type RuntimeFileSinkOptions = Readonly<{
  directoryPath: string;
  maxTotalBytes?: number;
}>;

export type RuntimeFileSink = Readonly<{
  write(event: RuntimeLogEventV2): void;
  currentPath(): string;
}>;

const terminalProjectionState = new Map<string, string>();
const MAX_TERMINAL_PROJECTION_KEYS = 4_096;

const projectionIdentity = (event: RuntimeLogEventV2): string => {
  if (!("typedIdentity" in event)) return event.traceId;
  const identity = event.typedIdentity as unknown as Record<string, unknown>;
  const stable = ["jobId", "attemptId", "outboxId", "commandId", "producerId"]
    .flatMap((key) => typeof identity[key] === "string" ? [`${key}:${String(identity[key])}`] : []);
  return stable.length > 0 ? stable.join("|") : String(identity.kind);
};

const stateProjection = (event: RuntimeLogEventV2): string => {
  if (event.kind === "error") return JSON.stringify({ failure: event.failure.code,
    owner: event.failure.responsibleOwner, authorityRef: event.authorityRef ?? null,
    authorityHash: event.authorityHash ?? null, evidenceRef: event.evidenceRef ?? null,
    evidenceHash: event.evidenceHash ?? null, nativeCause: event.failure.nativeCause ?? null,
    httpStatus: event.failure.httpStatus ?? null });
  if (event.kind === "span.terminal" && event.failure) return JSON.stringify({ failure: event.failure.code,
    owner: event.failure.responsibleOwner, authorityRef: event.authorityRef ?? null,
    authorityHash: event.authorityHash ?? null, evidenceRef: event.evidenceRef ?? null,
    evidenceHash: event.evidenceHash ?? null, nativeCause: event.failure.nativeCause ?? null,
    httpStatus: event.failure.httpStatus ?? null });
  if (event.kind === "span.terminal" && event.claimDiagnostics) {
    return JSON.stringify(event.claimDiagnostics);
  }
  if (event.kind === "span.terminal") return event.outcome;
  if (event.kind === "event") return JSON.stringify({ code: event.code,
    authorityRef: event.authorityRef ?? null, authorityHash: event.authorityHash ?? null,
    evidenceRef: event.evidenceRef ?? null, evidenceHash: event.evidenceHash ?? null });
  return "started";
};

export const shouldProjectRuntimeEvent = (event: RuntimeLogEventV2, activeMode: RuntimeLogMode): boolean => {
  const blockingFailure = (event.kind === "error" || event.kind === "span.terminal")
    && event.failure?.impact === "BLOCKING";
  if (!blockingFailure && !isEventVisibleInMode(event.visibility, activeMode)) return false;
  if (activeMode === "TRACE") return true;
  const lifecycleBoundary = event.operation === "runtime.start" || event.operation === "runtime.shutdown"
    || (event.kind === "event" && event.code === "PRODUCER_STOPPED");
  if (event.kind === "span.started") return lifecycleBoundary;
  const key = [event.producerRunId, event.component, event.operation, projectionIdentity(event)].join("|");
  const state = stateProjection(event);
  if (terminalProjectionState.get(key) === state) return false;
  if (!terminalProjectionState.has(key) && terminalProjectionState.size >= MAX_TERMINAL_PROJECTION_KEYS) {
    terminalProjectionState.delete(terminalProjectionState.keys().next().value as string);
  }
  terminalProjectionState.set(key, state);
  return lifecycleBoundary || event.kind === "error"
    || event.kind === "event" || event.kind === "span.terminal";
};

export const resetRuntimeTerminalProjectionForTest = (): void => terminalProjectionState.clear();

const DEFAULT_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const SEGMENTS_PER_CAPACITY = 16;
const safeToken = (value: string): string => value.replace(/[^A-Za-z0-9_.-]/gu, "-");

const segmentFiles = (directoryPath: string): string[] => {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => join(directoryPath, name))
    .sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs || left.localeCompare(right));
};

const ensureCapacity = (directoryPath: string, requiredBytes: number, maxTotalBytes: number): void => {
  const files = segmentFiles(directoryPath);
  const used = files.reduce((total, file) => total + statSync(file).size, 0);
  if (used + requiredBytes <= maxTotalBytes) return;
  throw new Error("RUNTIME_LOG_CAPACITY_BLOCKED");
};

export const createRuntimeFileSink = (
  producer: string,
  producerRunId: string,
  options: RuntimeFileSinkOptions,
): RuntimeFileSink => {
  const directoryPath = join(options.directoryPath, safeToken(producer));
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  if (!Number.isInteger(maxTotalBytes) || maxTotalBytes < 1) throw new Error("RUNTIME_LOG_CAPACITY_INVALID");
  const segmentBytes = Math.max(1, Math.floor(maxTotalBytes / SEGMENTS_PER_CAPACITY));
  mkdirSync(directoryPath, { recursive: true });
  const prefix = `${safeToken(producerRunId)}-`;
  const writerLockPath = join(directoryPath, `${safeToken(producerRunId)}.writer.lock`);
  try {
    writeFileSync(writerLockPath, `${process.pid}\n`, { encoding: "utf8", flag: "wx", flush: true });
  } catch {
    throw new Error("RUNTIME_LOG_PRODUCER_RUN_MULTI_WRITER");
  }
  const existingSegments = segmentFiles(directoryPath)
    .map((path) => basename(path))
    .filter((name) => name.startsWith(prefix))
    .map((name) => Number(name.slice(prefix.length, -".jsonl".length)))
    .filter(Number.isInteger);
  let segment = Math.max(1, ...existingSegments);
  const pathFor = (): string => join(directoryPath, `${prefix}${String(segment).padStart(4, "0")}.jsonl`);

  return {
    currentPath: pathFor,
    write(event) {
      const line = `${JSON.stringify(event)}\n`;
      const bytes = Buffer.byteLength(line);
      const currentBytes = existsSync(pathFor()) ? statSync(pathFor()).size : 0;
      if (currentBytes > 0 && currentBytes + bytes > segmentBytes) segment += 1;
      ensureCapacity(directoryPath, bytes, maxTotalBytes);
      appendFileSync(pathFor(), line, { encoding: "utf8", flush: true });
    },
  };
};

export const writeTerminalSink = (event: RuntimeLogEventV2, activeMode: RuntimeLogMode): void => {
  if (shouldProjectRuntimeEvent(event, activeMode)) process.stdout.write(`${JSON.stringify(event)}\n`);
};

export const writeEmergencyTerminalSink = (event: RuntimeLogEventV2): void => {
  process.stderr.write(`${JSON.stringify(event)}\n`);
};
