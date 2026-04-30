import path from "node:path";

export const repoRoot = path.resolve(process.cwd());
export const auditHome = path.join(repoRoot, "scripts", "audit");
export const lawHome = path.join(repoRoot, ".github", "instructions", "cursor-rules");
export const moduleLawHome = path.join(lawHome, "modules");
export const domainsHome = path.join(auditHome, "domains");
export const generatedHome = path.join(auditHome, "generated");
export const phaseGatesHome = path.join(auditHome, "phase-gates");
export const defaultPhaseGatePath = path.join(phaseGatesHome, "phase-04-full-enforcement.json");

export const generatedArtifactPaths = {
  lawRegistry: path.join(generatedHome, "law-registry.generated.json"),
  enforcementMatrixJson: path.join(generatedHome, "enforcement-matrix.generated.json"),
  enforcementMatrixYaml: path.join(generatedHome, "enforcement-matrix.generated.yaml"),
  auditPlan: path.join(generatedHome, "audit-plan.generated.json"),
  auditConflicts: path.join(generatedHome, "audit-conflicts.generated.json"),
  runnerSummary: path.join(generatedHome, "runner-summary.json"),
} as const;

export const pathFromRepoRoot = (relativePath: string): string =>
  path.join(repoRoot, ...relativePath.split("/"));

export const toRepoRelativePath = (absolutePath: string): string =>
  path.relative(repoRoot, absolutePath).split(path.sep).join("/");
