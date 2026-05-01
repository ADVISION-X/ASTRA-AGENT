import { writeJsonFile, writeTextFile } from "./filesystem.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import { stringifyYaml } from "./yaml.js";
import type {
  AuditConflictsSnapshot,
  AuditPlan,
  GeneratedLawRegistry,
} from "./schema-generated-artifacts.js";
import type { EnforcementMatrix } from "./schema-manifests.js";
import { type TouchedFilesArtifact } from "./touched-files.js";
import { writeTouchedFilesArtifact } from "./touched-files-writer.js";

export const writeCoreGeneratedArtifacts = async (
  lawRegistry: GeneratedLawRegistry,
  enforcementMatrix: EnforcementMatrix,
  auditPlan: AuditPlan,
  auditConflicts: AuditConflictsSnapshot,
): Promise<void> => {
  await Promise.all([
    writeJsonFile(generatedArtifactPaths.lawRegistry, lawRegistry),
    writeJsonFile(generatedArtifactPaths.enforcementMatrixJson, enforcementMatrix),
    writeTextFile(generatedArtifactPaths.enforcementMatrixYaml, `${stringifyYaml(enforcementMatrix)}\n`),
    writeJsonFile(generatedArtifactPaths.auditPlan, auditPlan),
    writeJsonFile(generatedArtifactPaths.auditConflicts, auditConflicts),
  ]);
};
