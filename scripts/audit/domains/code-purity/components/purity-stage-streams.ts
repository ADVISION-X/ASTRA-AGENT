import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { fileExists } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import type { Finding } from "../../../core/schema.js";
import { CODE_PURITY_FINDINGS_NDJSON, CODE_PURITY_INVENTORY_NDJSON, CODE_PURITY_WORK_DIR } from "./purity-stage-paths.js";
import type { CodePurityInventoryRecord } from "./purity-stage-types.js";

const writtenNdjsonLinesByPath = new Map<string, Set<string>>();

const toStableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => toStableValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entry]) => [key, toStableValue(entry)]),
    );
  }

  return value;
};

const createNdjsonDedupeKey = (value: unknown): string => JSON.stringify(toStableValue(value));

export const resetCodePurityStreamArtifacts = async (): Promise<void> => {
  writtenNdjsonLinesByPath.clear();
  await rm(pathFromRepoRoot(CODE_PURITY_WORK_DIR), { recursive: true, force: true });
  await mkdir(pathFromRepoRoot(CODE_PURITY_WORK_DIR), { recursive: true });
  await Promise.all([
    writeFile(pathFromRepoRoot(CODE_PURITY_FINDINGS_NDJSON), "", "utf8"),
    writeFile(pathFromRepoRoot(CODE_PURITY_INVENTORY_NDJSON), "", "utf8"),
  ]);
};

const appendNdjson = async (relativePath: string, value: unknown): Promise<void> => {
  const absolutePath = pathFromRepoRoot(relativePath);
  const serializedValue = JSON.stringify(value);
  const dedupeKey = createNdjsonDedupeKey(value);
  const writtenLines = writtenNdjsonLinesByPath.get(relativePath) ?? new Set<string>();
  if (writtenLines.has(dedupeKey)) {
    return;
  }

  writtenLines.add(dedupeKey);
  writtenNdjsonLinesByPath.set(relativePath, writtenLines);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await appendFile(absolutePath, `${serializedValue}\n`, "utf8");
};

const readNdjson = async <T>(relativePath: string): Promise<T[]> => {
  const absolutePath = pathFromRepoRoot(relativePath);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const text = await readFile(absolutePath, "utf8");
  const values = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);

  const dedupedValues: T[] = [];
  const seenKeys = new Set<string>();
  for (const value of values) {
    const dedupeKey = createNdjsonDedupeKey(value);
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    dedupedValues.push(value);
  }

  return dedupedValues;
};

export const appendCodePurityFinding = async (finding: Finding): Promise<void> => {
  await appendNdjson(CODE_PURITY_FINDINGS_NDJSON, finding);
};

export const appendCodePurityInventory = async (record: CodePurityInventoryRecord): Promise<void> => {
  await appendNdjson(CODE_PURITY_INVENTORY_NDJSON, record);
};

export const readCodePurityFindings = async (): Promise<Finding[]> =>
  readNdjson<Finding>(CODE_PURITY_FINDINGS_NDJSON);

export const readCodePurityInventoryRecords = async (): Promise<CodePurityInventoryRecord[]> =>
  readNdjson<CodePurityInventoryRecord>(CODE_PURITY_INVENTORY_NDJSON);
