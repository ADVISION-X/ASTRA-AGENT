import { createFinding, createPhase } from "../../../core/result.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import { defaultPhaseGatePath } from "../../../core/path-roots.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";

type AuditSystemFindingInput = Omit<Parameters<typeof createFinding>[0], "lawId"> & {
  lawId?: string;
};

const DEFAULT_LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";

export type AuditSystemFinding = ReturnType<typeof createFinding>;
export type AuditSystemPhase = ReturnType<typeof createPhase>;

export const createAuditSystemFinding = ({ lawId = DEFAULT_LAW_ID, ...finding }: AuditSystemFindingInput): AuditSystemFinding => {
  return createFinding({ lawId, ...finding });
};

export const createAuditSystemPhase = createPhase;

export { defaultPhaseGatePath, generatedArtifactPaths, pathFromRepoRoot, toRepoRelativePath };