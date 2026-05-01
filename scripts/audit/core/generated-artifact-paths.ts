import path from "node:path";

import { generatedHome } from "./path-roots.js";

export const generatedArtifactPaths = {
  lawRegistry: path.join(generatedHome, "law-registry.generated.json"),
  enforcementMatrixJson: path.join(generatedHome, "enforcement-matrix.generated.json"),
  enforcementMatrixYaml: path.join(generatedHome, "enforcement-matrix.generated.yaml"),
  auditPlan: path.join(generatedHome, "audit-plan.generated.json"),
  auditConflicts: path.join(generatedHome, "audit-conflicts.generated.json"),
  touchedFiles: path.join(generatedHome, "touched-files.generated.json"),
  runnerSummary: path.join(generatedHome, "runner-summary.json"),
} as const;