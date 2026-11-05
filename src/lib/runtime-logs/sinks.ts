import {
  appendFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

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
  if (event.kind === "span.terminal" && event.outcome === "failed" && event.failure?.impact === "BLOCKING") return event.spanId;
  if (!("typedIdentity" in event)) return event.traceId;
  const identity = Object.entries(event.typedIdentity);
  const stable = ["jobId", "attemptId", "outboxId", "commandId", "producerId"]
    .flatMap(key => identity.flatMap(([field, value]) =>
      field === key && typeof value === "string" ? [`${key}:${value}`] : []));
  return stable.length > 0 ? stable.join("|") : String(event.typedIdentity.kind);
};

const errorProjection = (event: RuntimeLogEventV2): string | null => {
  if (event.kind !== "error") return null;
  return JSON.stringify({ failure: event.failure.code,
    owner: event.failure.responsibleOwner, authorityRef: event.authorityRef ?? null,
    authorityHash: event.authorityHash ?? null, evidenceRef: event.evidenceRef ?? null,
    evidenceHash: event.evidenceHash ?? null, nativeCause: event.failure.nativeCause ?? null,
    httpStatus: event.failure.httpStatus ?? null });
};

const terminalFailureProjection = (event: RuntimeLogEventV2): string | null => {
  if (event.kind !== "span.terminal" || !event.failure) return null;
  return JSON.stringify({ failure: event.failure.code,
    owner: event.failure.responsibleOwner, authorityRef: event.authorityRef ?? null,
    authorityHash: event.authorityHash ?? null, evidenceRef: event.evidenceRef ?? null,
    evidenceHash: event.evidenceHash ?? null, nativeCause: event.failure.nativeCause ?? null,
    httpStatus: event.failure.httpStatus ?? null });
};

const stateProjection = (event: RuntimeLogEventV2): string => {
  const failure = errorProjection(event) ?? terminalFailureProjection(event);
  if (failure !== null) return failure;
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

const DEFAULT_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const SEGMENTS_PER_CAPACITY = 16;
const safeToken = (value: string): string => value.replace(/[^A-Za-z0-9_.-]/gu, "-");

const localLogEntry = (filePath: string, kind: "directory" | "file") => {
  const stat = lstatSync(filePath, { throwIfNoEntry: false });
  if (!stat) return undefined;
  if (kind === "directory" ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) {
    throw new Error("RUNTIME_LOG_STORAGE_PATH_INVALID");
  }
  return stat;
};

const segmentFiles = (directoryPath: string) => {
  localLogEntry(dirname(directoryPath), "directory");
  if (!localLogEntry(directoryPath, "directory")) return [];
  return readdirSync(directoryPath)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => {
      const filePath = join(directoryPath, name);
      const stat = localLogEntry(filePath, "file");
      if (!stat) throw new Error("RUNTIME_LOG_STORAGE_PATH_INVALID");
      return { filePath, modifiedAt: stat.mtimeMs, size: stat.size };
    })
    .sort((left, right) => left.modifiedAt - right.modifiedAt || left.filePath.localeCompare(right.filePath));
};

const ensureCapacity = (directoryPath: string, requiredBytes: number, maxTotalBytes: number): void => {
  const files = segmentFiles(directoryPath);
  const used = files.reduce((total, file) => total + file.size, 0);
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
  localLogEntry(dirname(options.directoryPath), "directory");
  const segments = segmentFiles(directoryPath);
  mkdirSync(directoryPath, { recursive: true });
  const prefix = `${safeToken(producerRunId)}-`;
  const writerLockPath = join(directoryPath, `${safeToken(producerRunId)}.writer.lock`);
  localLogEntry(writerLockPath, "file");
  try {
    writeFileSync(writerLockPath, `${process.pid}\n`, { encoding: "utf8", flag: "wx", flush: true });
  } catch {
    throw new Error("RUNTIME_LOG_PRODUCER_RUN_MULTI_WRITER");
  }
  const existingSegments = segments
    .map(({ filePath }) => basename(filePath))
    .filter((name) => name.startsWith(prefix))
    .map((name) => Number(name.slice(prefix.length, -".jsonl".length)))
    .filter(Number.isInteger);
  let segment = Math.max(1, ...existingSegments);
  const pathFor = (): string => join(directoryPath, `${prefix}${String(segment).padStart(4, "0")}.jsonl`);

  return {
    currentPath: pathFor,
    write(event) {
      localLogEntry(dirname(options.directoryPath), "directory");
      localLogEntry(options.directoryPath, "directory");
      localLogEntry(directoryPath, "directory");
      localLogEntry(writerLockPath, "file");
      const line = `${JSON.stringify(event)}\n`;
      const bytes = Buffer.byteLength(line);
      const currentBytes = localLogEntry(pathFor(), "file")?.size ?? 0;
      if (currentBytes > 0 && currentBytes + bytes > segmentBytes) segment += 1;
      ensureCapacity(directoryPath, bytes, maxTotalBytes);
      const destination = pathFor();
      localLogEntry(destination, "file");
      appendFileSync(destination, line, { encoding: "utf8", flush: true });
    },
  };
};

export const writeTerminalSink = (event: RuntimeLogEventV2, activeMode: RuntimeLogMode): void => {
  if (shouldProjectRuntimeEvent(event, activeMode)) process.stdout.write(`${JSON.stringify(event)}\n`);
};

export const writeEmergencyTerminalSink = (event: RuntimeLogEventV2): void => {
  process.stderr.write(`${JSON.stringify(event)}\n`);
};
