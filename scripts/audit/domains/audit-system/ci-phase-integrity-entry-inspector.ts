import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { evaluateCiPhaseIntegrity } from "./ci-phase-integrity-inspector.js";

const inspectedPaths = [
  "scripts/audit/ci-full.ts",
  "scripts/audit/ci-full-phase-plan.ts",
  "scripts/audit/ci-acceptance-leaf-plan.ts",
  "scripts/audit/ci-acceptance-law-bindings.ts",
  "scripts/audit/ci-fail-fast.ts",
  "scripts/audit/ci-phase-sealer.ts",
] as const;

export const inspectCiPhaseIntegrity = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedPaths.forEach((path) => inspectedFiles.add(path));
  if (Object.values(evaluateCiPhaseIntegrity(context)).every(Boolean)) return;
  findings.push(createFinding({
    checkId: "audit-system/ci-full-entry-gate",
    lawId,
    filePath: "scripts/audit/ci-full-phase-plan.ts",
    message: "CI must bind fail-fast to one complete physical skeleton before entry, seal that same skeleton from rebuilt generated authority, and execute only unique direct leaves.",
  }));
};
