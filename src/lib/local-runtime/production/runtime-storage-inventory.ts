import type { Dirent, Stats } from "node:fs";
import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { executionFailure } from "../../execution-failure.js";

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

export const productionRuntimeTaskRoot = (dataDir: string): string =>
  path.join(dataDir, "plugin-tasks", "production-runtime");
export function productionRuntimeTaskPath(dataDir: string, jobId: string): string {
  if (!jobId || jobId === "." || jobId === ".." || /[\\/\0]/u.test(jobId)) {
    throw executionFailure("failed", "PRODUCTION_STORAGE_JOB_ID_INVALID");
  }
  return path.join(productionRuntimeTaskRoot(dataDir), jobId);
}

export async function purgeProductionRuntimeTask(dataDir: string, jobId: string): Promise<void> {
  const taskPath = productionRuntimeTaskPath(dataDir, jobId);
  let metadata: Stats;
  try { metadata = await lstat(taskPath); }
  catch (error) {
    if (nativeCode(error) === "ENOENT") return;
    return storageFailure("PRODUCTION_STORAGE_PURGE_UNREADABLE", error);
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    return storageFailure("PRODUCTION_STORAGE_PURGE_STRUCTURE_INVALID");
  }
  try { await rm(taskPath, { recursive: true, force: false }); }
  catch (error) { return storageFailure("PRODUCTION_STORAGE_PURGE_FAILED", error); }
  try { await lstat(taskPath); return storageFailure("PRODUCTION_STORAGE_PURGE_INCOMPLETE"); }
  catch (error) {
    if (nativeCode(error) !== "ENOENT") return storageFailure("PRODUCTION_STORAGE_PURGE_INCOMPLETE", error);
  }
}

const nativeCode = (error: unknown): string | null =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code : null;

const storageFailure = (code: string, cause?: unknown): never => {
  throw executionFailure("failed", code, cause === undefined ? {} : { cause });
};

const entryBytes = async (entryPath: string): Promise<number> => {
  let metadata: Stats;
  try { metadata = await lstat(entryPath); }
  catch (error) { return storageFailure("PRODUCTION_STORAGE_INVENTORY_UNREADABLE", error); }
  if (metadata.isSymbolicLink()) storageFailure("PRODUCTION_STORAGE_SYMLINK_INVALID");
  if (metadata.isFile()) return metadata.size;
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
  if (entries.some((entry) => !entry.isDirectory() || entry.isSymbolicLink())) {
    storageFailure("PRODUCTION_STORAGE_STRUCTURE_INVALID");
  }
  const owners = new Set(responsibilities.task_ids.map((jobId) => {
    productionRuntimeTaskPath(dataDir, jobId);
    return jobId;
  }));
  const directoryNames = entries.map((entry) => entry.name).sort();
  const orphanJobIds = directoryNames.filter((name) => !owners.has(name));
  const orphanSet = new Set(orphanJobIds);
  let orphanBytes = 0;
  for (const jobId of directoryNames) {
    const bytes = await entryBytes(productionRuntimeTaskPath(dataDir, jobId));
    if (orphanSet.has(jobId)) orphanBytes += bytes;
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
