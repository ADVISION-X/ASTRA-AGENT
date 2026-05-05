import { writeJsonFile, writeTextFile } from "./filesystem.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import { buildStaticClauseCoverageArtifact } from "./static-clause-coverage-artifact.js";
import { stringifyYaml } from "./yaml.js";
import type {
  AuditConflictsSnapshot,
  AuditPlan,
  GeneratedLawRegistry,
} from "./schema-generated-artifacts.js";
import type { EnforcementMatrix } from "./schema-manifests.js";
import { type TouchedFilesArtifact } from "./touched-files.js";
import { writeTouchedFilesArtifact } from "./touched-files-writer.js";

type CoreGeneratedArtifacts = {
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
  auditConflicts: AuditConflictsSnapshot;
};

export type GeneratedArtifactsWriteInput = CoreGeneratedArtifacts & {
  touchedFilesArtifact: TouchedFilesArtifact;
};

const writeCoreGeneratedArtifacts = async (input: CoreGeneratedArtifacts): Promise<void> => {
  const staticClauseCoverage = await buildStaticClauseCoverageArtifact(input);
  await Promise.all([
    writeJsonFile(generatedArtifactPaths.lawRegistry, input.lawRegistry),
    writeJsonFile(generatedArtifactPaths.enforcementMatrixJson, input.enforcementMatrix),
    writeTextFile(generatedArtifactPaths.enforcementMatrixYaml, `${stringifyYaml(input.enforcementMatrix)}\n`),
    writeJsonFile(generatedArtifactPaths.auditPlan, input.auditPlan),
    writeJsonFile(generatedArtifactPaths.auditConflicts, input.auditConflicts),
    writeJsonFile(generatedArtifactPaths.staticClauseCoverage, staticClauseCoverage),
  ]);
};

export const writeGeneratedArtifacts = async (input: GeneratedArtifactsWriteInput): Promise<void> => {
  await Promise.all([
    writeCoreGeneratedArtifacts(input),
    writeTouchedFilesArtifact(input.touchedFilesArtifact),
  ]);
};
