import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

import { isEventVisibleInMode, type RuntimeLogMode } from "./mode.js";
import { runtimeEventIntegrityValid } from "./integrity.js";
import { runtimeLogEventShapeValid } from "./schema.js";
import type { RuntimeLogEventV2 } from "./runtime-event-contract.js";

export type RuntimeFileSinkOptions = Readonly<{
  directoryPath: string;
  maxTotalBytes?: number;
}>;

export type RuntimeFileSink = Readonly<{
  write(event: RuntimeLogEventV2): void;
  currentPath(): string;
}>;

const DEFAULT_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const SEGMENTS_PER_CAPACITY = 16;
const safeToken = (value: string): string => value.replace(/[^A-Za-z0-9_.-]/gu, "-");
const runIdFromPath = (path: string): string | null => /^(.+)-[0-9]{4}\.jsonl$/u.exec(basename(path))?.[1] ?? null;

const segmentFiles = (directoryPath: string): string[] => {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => join(directoryPath, name))
    .sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs || left.localeCompare(right));
};

type RunState = {
  files: string[];
  invalid: boolean;
  openSpans: Set<string>;
  openJobs: Set<string>;
  openMutations: Set<string>;
  pendingOutbox: Set<string>;
  reconciledJobs: Set<string>;
  reconciledLeases: Set<string>;
  reconciledCheckpoints: Set<string>;
  sealed: boolean;
};

const initialRunState = (): RunState => ({
  files: [], invalid: false, openSpans: new Set(), openJobs: new Set(), openMutations: new Set(),
  pendingOutbox: new Set(), reconciledJobs: new Set(), reconciledLeases: new Set(),
  reconciledCheckpoints: new Set(), sealed: false,
});

const updateJobProtection = (state: RunState, event: Extract<RuntimeLogEventV2, { type: "STATE" }>): void => {
  if (event.stateKey !== "job.lifecycle") return;
  const key = event.traceId;
  if (event.reconciledFromAuthority === true) {
    if (["accepted", "running", "recovery_pending"].includes(event.current)) state.reconciledJobs.add(key);
    else state.reconciledJobs.delete(key);
  }
  if (["completed", "failed", "review_required"].includes(event.current)) state.openJobs.delete(key);
  else state.openJobs.add(key);
};

const updateAuthorityProtection = (state: RunState, event: Extract<RuntimeLogEventV2, { type: "STATE" }>): void => {
  if (event.reconciledFromAuthority !== true) return;
  if (event.stateKey === "job.lease") state.reconciledLeases.add(event.traceId);
  if (event.stateKey === "job.checkpoint") state.reconciledCheckpoints.add(event.traceId);
};

const updateOpenSet = (
  values: Set<string>,
  key: string,
  closed: boolean,
): void => {
  if (closed) values.delete(key);
  else values.add(key);
};

const updateProtection = (state: RunState, event: RuntimeLogEventV2): void => {
  state.sealed = event.type === "STATE"
    && event.stateKey === "producer.lifecycle"
    && event.current === "stopped";
  if (event.type === "SPAN") {
    if (event.phase === "started") state.openSpans.add(event.spanId);
    else state.openSpans.delete(event.spanId);
    return;
  }
  updateJobProtection(state, event);
  updateAuthorityProtection(state, event);
  if (event.stateKey === "browser.mutation") {
    const key = event.authorityRef ?? event.traceId;
    updateOpenSet(state.openMutations, key, ["CONFIRMED", "FAILED"].includes(event.current));
  }
  if (event.stateKey === "outbox.delivery") {
    const key = event.authorityRef ?? event.traceId;
    updateOpenSet(state.pendingOutbox, key, event.current === "delivered");
  }
};

const scanRuns = (files: readonly string[]): Map<string, RunState> => {
  const runs = new Map<string, RunState>();
  for (const file of files) {
    const fileRunId = runIdFromPath(file);
    if (!fileRunId) continue;
    const state = runs.get(fileRunId) ?? initialRunState();
    runs.set(fileRunId, state);
    state.files.push(file);
  }
  for (const [fileRunId, state] of runs) {
    let previous: RuntimeLogEventV2 | null = null;
    for (const file of [...state.files].sort((left, right) => left.localeCompare(right))) {
      for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
      let parsed: unknown;
      try { parsed = JSON.parse(line) as unknown; }
      catch { state.invalid = true; continue; }
      if (!runtimeLogEventShapeValid(parsed)
        || safeToken(parsed.producerRunId) !== fileRunId
        || !runtimeEventIntegrityValid(parsed)
        || parsed.producerSeq !== (previous?.producerSeq ?? 0) + 1
        || parsed.previousEventHash !== (previous?.eventHash ?? null)) {
        state.invalid = true;
        continue;
      }
      updateProtection(state, parsed);
      previous = parsed;
      }
    }
  }
  return runs;
};

const eligibleRun = (state: RunState): boolean => state.sealed && !state.invalid
  && state.openSpans.size === 0 && state.openJobs.size === 0
  && state.openMutations.size === 0 && state.pendingOutbox.size === 0
  && [...state.reconciledJobs].every((jobId) =>
    state.reconciledLeases.has(jobId) && state.reconciledCheckpoints.has(jobId));

const freeCapacity = (directoryPath: string, currentRunId: string, requiredBytes: number, maxTotalBytes: number): void => {
  let files = segmentFiles(directoryPath);
  let used = files.reduce((total, file) => total + statSync(file).size, 0);
  if (used + requiredBytes <= maxTotalBytes) return;
  const candidates = [...scanRuns(files).entries()]
    .filter(([runId, state]) => runId !== safeToken(currentRunId) && eligibleRun(state))
    .sort(([, left], [, right]) => statSync(left.files[0]!).mtimeMs - statSync(right.files[0]!).mtimeMs);
  for (const [, state] of candidates) {
    for (const file of state.files) rmSync(file);
    files = segmentFiles(directoryPath);
    used = files.reduce((total, file) => total + statSync(file).size, 0);
    if (used + requiredBytes <= maxTotalBytes) return;
  }
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
      freeCapacity(directoryPath, producerRunId, bytes, maxTotalBytes);
      appendFileSync(pathFor(), line, { encoding: "utf8", flush: true });
    },
  };
};

export const writeTerminalSink = (event: RuntimeLogEventV2, activeMode: RuntimeLogMode): void => {
  if (isEventVisibleInMode(event.visibility, activeMode)) process.stdout.write(`${JSON.stringify(event)}\n`);
};

export const writeEmergencyTerminalSink = (event: RuntimeLogEventV2): void => {
  process.stderr.write(`${JSON.stringify(event)}\n`);
};
