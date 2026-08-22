import assert from "node:assert/strict";

import { Project, SyntaxKind } from "ts-morph";

import { inspectCiControlIntegrity } from "../audit/domains/audit-system/ci-control-integrity-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const paths = [
  "scripts/audit/ci-full.ts",
  "scripts/audit/ci-full-phase-plan.ts",
  "scripts/audit/ci-phase-sealer.ts",
] as const;
const project = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
const reset = (): Project => {
  for (const path of paths) project.getSourceFileOrThrow(resolveFromRepo(path)).refreshFromFileSystemSync();
  return project;
};

const context = (current: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return { checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-phase-plan").checks, completedReports: {}, generatedPlan, planEntry, project: current };
};

const rejected = (current: Project): boolean => {
  const findings: import("../audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  inspectCiControlIntegrity(context(current), findings, new Set(), "APEX-AUDIT-005-V1");
  return findings.some((finding) => finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton"));
};

const runDiscardedLeavesAttack = (): void => {
  const current = reset();
  const builder = current.getSourceFileOrThrow(resolveFromRepo(paths[1]))
    .getVariableDeclarationOrThrow("buildCiPhasePlan").getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const planned = builder.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "plannedSteps");
  if (!planned) throw new Error("planned steps fixture is missing.");
  planned.setInitializer("Object.freeze([...preArtifactPlannedSteps])");
  assert.equal(rejected(current), true,
    "receipt governance must reject acceptanceSteps omitted from plannedSteps.");
};

const runConditionalSealerAttack = (): void => {
  const current = reset();
  const sealer = current.getSourceFileOrThrow(resolveFromRepo(paths[2]))
    .getVariableDeclarationOrThrow("sealCiPhasePlanOrFail").getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const catchBlock = sealer.getBody().getFirstDescendantByKindOrThrow(SyntaxKind.CatchClause).getBlock();
  const terminal = catchBlock.getStatements().at(-1);
  if (!terminal) throw new Error("phase sealer fail-fast fixture is missing.");
  terminal.replaceWithText(`if (Number.isNaN(0)) { ${terminal.getText()} } throw error;`);
  assert.equal(rejected(current), true,
    "receipt governance must reject a phase-seal exception path that escapes fail-fast.");
};

const runPreSealerSkeletonBypassAttack = (): void => {
  const current = reset();
  const source = current.getSourceFileOrThrow(resolveFromRepo(paths[0]));
  const main = source.getVariableDeclarationOrThrow("main").getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const call = main.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((candidate) => candidate.getExpression().getText() === "buildAcceptancePackageSkeletonsOrFail");
  if (!call) throw new Error("package skeleton fail-fast fixture is missing.");
  source.addImportDeclaration({
    moduleSpecifier: "./ci-acceptance-leaf-plan.js",
    namedImports: ["buildAcceptancePackageSkeletons"],
  });
  call.replaceWithText("buildAcceptancePackageSkeletons()");
  assert.equal(rejected(current), true,
    "receipt governance must reject package skeleton discovery moved outside the fail-fast sealer chain.");
};

export const runPhasePlanAttacks = (): void => {
  runDiscardedLeavesAttack();
  runConditionalSealerAttack();
  runPreSealerSkeletonBypassAttack();
};
