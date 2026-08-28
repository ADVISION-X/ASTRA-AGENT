import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { runtimeEventIntegrityValid } from "./integrity.js";
import {
  runtimeLogEventShapeValid,
} from "./schema.js";
import type {
  RuntimeLogEventV2,
  RuntimeStateEvent,
} from "./runtime-event-contract.js";

const activeJsonlFiles = (root: string, findings: string[]): string[] => {
  if (!existsSync(root)) return [];
  const rootStat = statSync(root);
  if (rootStat.isFile()) return [root];
  if (!rootStat.isDirectory()) return [];
  const found: string[] = [];
  for (const producer of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const producerDirectory = join(root, producer.name);
    for (const entry of readdirSync(producerDirectory, { withFileTypes: true })) {
      const path = join(producerDirectory, entry.name);
      if (entry.isDirectory()) findings.push(`ACTIVE_SOURCE_LAYOUT_INVALID:${path}`);
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      if (!/^.+-[0-9]{4}\.jsonl$/u.test(entry.name)) findings.push(`ACTIVE_SEGMENT_NAME_INVALID:${path}`);
      found.push(path);
    }
  }
  return found.sort();
};

export const parseRuntimeLogSource = (source: string, findings: string[]): Readonly<{
  events: RuntimeLogEventV2[];
  status: { source: string; available: boolean; files: number; events: number };
}> => {
  let files: string[];
  try {
    files = activeJsonlFiles(source, findings);
  } catch {
    files = [];
  }
  if (files.length === 0) findings.push(`SOURCE_UNAVAILABLE:${source}`);
  const events: RuntimeLogEventV2[] = [];
  for (const path of files) {
    const lines = readFileSync(path, "utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch {
        findings.push(index === lines.length - 1
          ? `TRUNCATED_FINAL_LINE:${path}` : `INVALID_JSONL_LINE:${path}:${index + 1}`);
        continue;
      }
      if (!runtimeLogEventShapeValid(parsed)) findings.push(`EVENT_SCHEMA_INVALID:${path}:${index + 1}`);
      else events.push(parsed);
    }
  }
  return { events, status: { source, available: files.length > 0, files: files.length, events: events.length } };
};

export const orderedRuntimeEventsByProducer = (events: readonly RuntimeLogEventV2[]): RuntimeLogEventV2[] =>
  [...events].sort((left, right) => left.producerRunId.localeCompare(right.producerRunId)
    || left.producerSeq - right.producerSeq);

const verifyProducerRun = (runId: string, runEvents: readonly RuntimeLogEventV2[], findings: string[]): void => {
  const ordered = [...runEvents].sort((left, right) => left.producerSeq - right.producerSeq);
  let previous: RuntimeLogEventV2 | null = null;
  for (const event of ordered) {
    if (!runtimeEventIntegrityValid(event)) findings.push(`EVENT_HASH_INVALID:${event.eventId}`);
    if (!previous) {
      if (event.producerSeq !== 1 || event.previousEventHash !== null) findings.push(`PRODUCER_CHAIN_START_INVALID:${runId}`);
    } else if (event.producerSeq !== previous.producerSeq + 1 || event.previousEventHash !== previous.eventHash) {
      findings.push(`PRODUCER_CHAIN_BROKEN:${runId}:${event.producerSeq}`);
    }
    previous = event;
  }
  const stopped = [...ordered].reverse().find((event): event is RuntimeStateEvent =>
    event.type === "STATE" && event.stateKey === "producer.lifecycle" && event.current === "stopped");
  if (stopped && stopped.eventId !== ordered.at(-1)?.eventId) findings.push(`PRODUCER_NORMAL_STOP_NOT_SEALED:${runId}`);
};

export const verifyRuntimeProducerChains = (events: readonly RuntimeLogEventV2[], findings: string[]): void => {
  const runs = new Map<string, RuntimeLogEventV2[]>();
  for (const event of events) runs.set(event.producerRunId, [...(runs.get(event.producerRunId) ?? []), event]);
  for (const [runId, runEvents] of runs) verifyProducerRun(runId, runEvents, findings);
};
