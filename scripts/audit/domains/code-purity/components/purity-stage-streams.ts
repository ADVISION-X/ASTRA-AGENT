import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { fileExists } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import type { Finding } from "../../../core/schema.js";
import { CODE_PURITY_FINDINGS_NDJSON, CODE_PURITY_INVENTORY_NDJSON, CODE_PURITY_WORK_DIR } from "./purity-stage-paths.js";
import type { CodePurityInventoryRecord } from "./purity-stage-types.js";

export const resetCodePurityStreamArtifacts = async (): Promise<void> => {
  await rm(pathFromRepoRoot(CODE_PURITY_WORK_DIR), { recursive: true, force: true });
};

export const appendNdjson = async (relativePath: string, value: unknown): Promise<void> => {
  const absolutePath = pathFromRepoRoot(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await appendFile(absolutePath, `${JSON.stringify(value)}\n`, "utf8");
};

export const readNdjson = async <T>(relativePath: string): Promise<T[]> => {
  const absolutePath = pathFromRepoRoot(relativePath);
  if (!(await fileExists(absolutePath))) {
    return [];
  }

  const text = await readFile(absolutePath, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
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
