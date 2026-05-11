import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

const STORAGE_ADAPTER_PATH = "src/capabilities/forensics-persistence/storage-adapter.ts";
const STORAGE_FILE_PATH = "src/lib/storage/file-storage.ts";

export const resolveEvidenceStorePath = async (): Promise<string> => {
  const adapterPath = pathFromRepoRoot(STORAGE_ADAPTER_PATH);
  return await fileExists(adapterPath) ? STORAGE_ADAPTER_PATH : STORAGE_FILE_PATH;
};
