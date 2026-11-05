import { lstatSync, readdirSync, type Dirent, type Stats } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { executionFailure, TypedExecutionFailure, typedExecutionFailure } from "../../execution-failure.js";

export type ProductionRuntimeStorageInventory = Readonly<{
  root: string;
  database_task_count: number;
  outbox_responsibility_count: number;
  pending_outbox_count: number;
  directory_count: number;
  owned_directory_count: number;
  orphan_directory_count: number;
  orphan_bytes: number;
  orphan_job_ids: readonly string[];
}>;
export type ProductionRuntimeStorageResponsibilities = Readonly<{
  task_ids: readonly string[];
  outbox_responsibility_count: number;
  pending_outbox_count: number;
}>;

function assertTaskDirectory(directory: string): void {
  let metadata: Stats | undefined;
  try { metadata = lstatSync(directory, { throwIfNoEntry: false }); }
  catch (error) { return storageFailure("PRODUCTION_STORAGE_INVENTORY_UNREADABLE", error); }
  if (metadata?.isSymbolicLink()) storageFailure("PRODUCTION_STORAGE_SYMLINK_INVALID");
  if (metadata && !metadata.isDirectory()) storageFailure("PRODUCTION_STORAGE_STRUCTURE_INVALID");
}

export function productionRuntimeTaskRoot(dataDir: string): string {
  const tasks = path.join(dataDir, "plugin-tasks");
  const root = path.join(tasks, "production-runtime");
  for (const directory of [dataDir, tasks, root]) assertTaskDirectory(directory);
  return root;
}
function assertTaskJobId(jobId: string): void {
  if (!jobId || jobId === "." || jobId === ".." || /[\\/\0]/u.test(jobId)) {
    throw executionFailure("failed", "PRODUCTION_STORAGE_JOB_ID_INVALID");
  }
}

export function productionRuntimeTaskPath(dataDir: string, jobId: string): string {
  assertTaskJobId(jobId);
  const directory = path.join(productionRuntimeTaskRoot(dataDir), jobId);
  assertTaskDirectory(directory);
  return directory;
}

const nativeCode = (error: unknown): string | null =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code : null;

const storageFailure = (code: string, cause?: unknown): never => {
  throw executionFailure("failed", code, cause === undefined ? {} : { cause });
};

export class ProductionRuntimeTaskStorageFailure extends TypedExecutionFailure {
  public constructor(public readonly jobId: string, code: string, cause: unknown) {
    super("failed", code, cause);
  }
}

export function assertProductionFileLinks(filePath: string, metadata: Stats): void {
  if (metadata.nlink === 1) return;
  const directory = path.dirname(filePath);
  if (path.basename(directory) !== "materials") storageFailure("PRODUCTION_STORAGE_STRUCTURE_INVALID");
  let localLinks: number;
  try {
    localLinks = readdirSync(directory, { withFileTypes: true }).filter((entry) => {
      if (!entry.isFile()) return false;
      const sibling = lstatSync(path.join(directory, entry.name));
      return sibling.dev === metadata.dev && sibling.ino === metadata.ino;
    }).length;
  } catch (error) {
    return storageFailure("PRODUCTION_STORAGE_INVENTORY_UNREADABLE", error);
  }
  if (localLinks !== metadata.nlink) storageFailure("PRODUCTION_STORAGE_STRUCTURE_INVALID");
}

const entryBytes = async (entryPath: string): Promise<number> => {
  let metadata: Stats;
  try { metadata = await lstat(entryPath); }
  catch (error) { return storageFailure("PRODUCTION_STORAGE_INVENTORY_UNREADABLE", error); }
  if (metadata.isSymbolicLink()) storageFailure("PRODUCTION_STORAGE_SYMLINK_INVALID");
  if (metadata.isFile()) {
    assertProductionFileLinks(entryPath, metadata);
    return metadata.size;
  }
  if (!metadata.isDirectory()) storageFailure("PRODUCTION_STORAGE_STRUCTURE_INVALID");
  let names: string[];
  try { names = await readdir(entryPath); }
  catch (error) { return storageFailure("PRODUCTION_STORAGE_INVENTORY_UNREADABLE", error); }
  let total = metadata.size;
  for (const name of names.sort()) total += await entryBytes(path.join(entryPath, name));
  return total;
};

export async function readProductionRuntimeStorageInventory(
  dataDir: string,
  responsibilities: ProductionRuntimeStorageResponsibilities,
): Promise<ProductionRuntimeStorageInventory> {
  const root = productionRuntimeTaskRoot(dataDir);
  const base = {
    database_task_count: responsibilities.task_ids.length,
    outbox_responsibility_count: responsibilities.outbox_responsibility_count,
    pending_outbox_count: responsibilities.pending_outbox_count,
  };
  let rootMetadata: Stats;
  try { rootMetadata = await lstat(root); }
  catch (error) {
    if (nativeCode(error) === "ENOENT") return Object.freeze({
      root, ...base, directory_count: 0, owned_directory_count: 0,
      orphan_directory_count: 0, orphan_bytes: 0, orphan_job_ids: Object.freeze([]),
    });
    return storageFailure("PRODUCTION_STORAGE_INVENTORY_UNREADABLE", error);
  }
  if (rootMetadata.isSymbolicLink()) storageFailure("PRODUCTION_STORAGE_SYMLINK_INVALID");
  if (!rootMetadata.isDirectory()) storageFailure("PRODUCTION_STORAGE_STRUCTURE_INVALID");
  let entries: Dirent[];
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) { return storageFailure("PRODUCTION_STORAGE_INVENTORY_UNREADABLE", error); }
  const owners = new Set(responsibilities.task_ids.map((jobId) => {
    assertTaskJobId(jobId);
    return jobId;
  }));
  const directoryNames = entries.map((entry) => entry.name).sort();
  const orphanJobIds = directoryNames.filter((name) => !owners.has(name));
  const orphanSet = new Set(orphanJobIds);
  let orphanBytes = 0;
  for (const jobId of directoryNames) {
    try {
      const entry = entries.find((candidate) => candidate.name === jobId)!;
      if (!entry.isDirectory() || entry.isSymbolicLink()) storageFailure("PRODUCTION_STORAGE_STRUCTURE_INVALID");
      const bytes = await entryBytes(productionRuntimeTaskPath(dataDir, jobId));
      if (orphanSet.has(jobId)) orphanBytes += bytes;
    } catch (error) {
      const typed = typedExecutionFailure(error);
      if (!typed || !["PRODUCTION_STORAGE_SYMLINK_INVALID", "PRODUCTION_STORAGE_STRUCTURE_INVALID",
        "PRODUCTION_STORAGE_INVENTORY_UNREADABLE"].includes(typed.code)) throw error;
      throw new ProductionRuntimeTaskStorageFailure(jobId, typed.code, error);
    }
  }
  return Object.freeze({
    root,
    ...base,
    directory_count: directoryNames.length,
    owned_directory_count: directoryNames.length - orphanJobIds.length,
    orphan_directory_count: orphanJobIds.length,
    orphan_bytes: orphanBytes,
    orphan_job_ids: Object.freeze(orphanJobIds),
  });
}
