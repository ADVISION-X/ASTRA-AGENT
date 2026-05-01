import { fileExists, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

const LEGACY_FORENSICS_STORE_PATH = "src/capabilities/forensics-persistence/shared/store/evidence-store-service.ts";
const STORAGE_CONTEXT_PATH = "src/lib/storage/evidence-store/evidence-store-service-context.ts";

export const resolveEvidenceStorePath = async (): Promise<string> => {
  const legacyPath = pathFromRepoRoot(LEGACY_FORENSICS_STORE_PATH);
  return await fileExists(legacyPath) ? LEGACY_FORENSICS_STORE_PATH : STORAGE_CONTEXT_PATH;
};

export const readEvidenceStoreSource = async (): Promise<string> => {
  const evidenceStorePath = await resolveEvidenceStorePath();
  return readTextFile(pathFromRepoRoot(evidenceStorePath));
};
