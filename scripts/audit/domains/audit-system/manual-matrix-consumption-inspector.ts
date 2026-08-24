import type { Project } from "ts-morph";

type Finding = { code: string; detail: string; path: string };

const retiredTruthFragments = ["audit-conflicts", "audit-plan", "enforcement-matrix", "manual-matrix", "run-generated-plan"];

export const inspectManualMatrixConsumption = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const source of project.getSourceFiles()) {
    for (const declaration of source.getImportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      if (specifier === "./manual-matrix-consumption-inspector.js") continue;
      const fragment = retiredTruthFragments.find((candidate) => specifier.includes(candidate));
      if (fragment) findings.push({ code: "AUDIT_RETIRED_TRUTH_CONSUMED", detail: specifier, path: source.getFilePath() });
    }
  }
  return findings;
};
