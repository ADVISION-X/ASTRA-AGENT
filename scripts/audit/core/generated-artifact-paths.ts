import path from "node:path";

import { generatedHome } from "./path-roots.js";

export const generatedArtifactPaths = {
  lawRegistry: path.join(generatedHome, "law-registry.generated.json"),
  enforcementMatrixJson: path.join(generatedHome, "enforcement-matrix.generated.json"),
  enforcementMatrixYaml: path.join(generatedHome, "enforcement-matrix.generated.yaml"),
  auditPlan: path.join(generatedHome, "audit-plan.generated.json"),
  auditConflicts: path.join(generatedHome, "audit-conflicts.generated.json"),
  staticClauseCoverage: path.join(generatedHome, "static-clause-coverage.generated.json"),
  touchedFiles: path.join(generatedHome, "touched-files.generated.json"),
  ciFullSummary: path.join(generatedHome, "ci-full-summary.generated.json"),
} as const;
