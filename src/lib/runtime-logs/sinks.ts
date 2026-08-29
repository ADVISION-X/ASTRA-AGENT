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
  if (isEventVisibleInMode(event.visibility, activeMode)) process.stdout.write(`${JSON.stringify(event)}\n`);
};

export const writeEmergencyTerminalSink = (event: RuntimeLogEventV2): void => {
  process.stderr.write(`${JSON.stringify(event)}\n`);
};
