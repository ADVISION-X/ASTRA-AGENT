import assert from "node:assert/strict";

import { Project, SyntaxKind } from "ts-morph";

import { inspectOwnerRegistrations } from "../audit/domains/audit-system/owner-registration-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const mediaProcessingInspectorPath = resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts");
const attackProject = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
const resetAttackProject = (): Project => {
  attackProject.getSourceFileOrThrow(mediaProcessingInspectorPath).refreshFromFileSystemSync();
  return attackProject;
};

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return { checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-control-flow-reachability").checks, completedReports: {}, generatedPlan, planEntry, project };
};

const assertSignedWindowAttackRejected = (project: Project, label: string): void => {
  const findings: import("../audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  const context = buildContext(project);
  const generatedPlan = context.generatedPlan.filter((entry) => entry.capabilityDomain === "media-processing-capability");
  inspectOwnerRegistrations({ ...context, generatedPlan }, findings, new Set<string>(), "APEX-AUDIT-005-V1");
  assert.equal(findings.some((finding) => finding.checkId === "audit-system/runner-source"
    && finding.message.includes("post-hoc or hollow")), true, `receipt governance must reject ${label}.`);
};

const mediaProcessingEvaluation = (project: Project) => project
  .getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"))
  .getVariableDeclarationOrThrow("inspectDomainEvaluation")
  .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);

const runPostReturnFindingAttack = (): void => {
  const project = resetAttackProject();
  mediaProcessingEvaluation(project).setBodyText(`
    const findings = [];
    return { findings, inspectedFiles: [context.planEntry.ownerInspectorPath] };
    findings.push(createFinding({ checkId: "decoy", lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1", message: "decoy" }));
  `);
  assertSignedWindowAttackRejected(project, "an owner assertion placed after an unconditional return");
};

const runHelperUnreachableReturnFindingAttack = (): void => {
  const project = resetAttackProject();
  mediaProcessingEvaluation(project).setBodyText(`
    const hollow = () => {
      return [];
      return [createFinding({ checkId: "decoy", lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1", message: "decoy" })];
    };
    const findings = hollow();
    return { findings, inspectedFiles: [context.planEntry.ownerInspectorPath] };
  `);
  assertSignedWindowAttackRejected(project, "a helper whose only finding exists after an unconditional return");
};

const runFalsyLiteralBranchAttacks = (): void => {
  for (const { setup, condition } of [
    { setup: "", condition: "0" },
    { setup: "", condition: '\"\"' },
    { setup: "const never = 0;", condition: "never" },
  ]) {
    const project = resetAttackProject();
    mediaProcessingEvaluation(project).setBodyText(`
      ${setup}
      const findings = [];
      if (${condition}) {
        findings.push(createFinding({ checkId: "decoy", lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1", message: "decoy" }));
      }
      return { findings, inspectedFiles: [context.planEntry.ownerInspectorPath] };
    `);
    assertSignedWindowAttackRejected(project, `an owner assertion hidden in the falsy literal branch ${condition}`);

    const conditionalProject = resetAttackProject();
    mediaProcessingEvaluation(conditionalProject).setBodyText(`
      ${setup}
      const findings = ${condition}
        ? [createFinding({ checkId: "decoy", lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1", message: "decoy" })]
        : [];
      return { findings, inspectedFiles: [context.planEntry.ownerInspectorPath] };
    `);
    assertSignedWindowAttackRejected(
      conditionalProject,
      `an owner assertion hidden in the unreachable conditional-expression branch ${condition}`,
    );
  }
};

const runEmptyFindingSpreadAttack = (): void => {
  const project = resetAttackProject();
  mediaProcessingEvaluation(project).setBodyText(`
    const append = (findings: ReturnType<typeof createFinding>[]) => {
      findings.push(...([] as ReturnType<typeof createFinding>[]));
    };
    const findings: ReturnType<typeof createFinding>[] = [];
    append(findings);
    return { findings, inspectedFiles: [context.planEntry.ownerInspectorPath] };
  `);
  assertSignedWindowAttackRejected(project, "an empty spread presented as canonical finding collection work");
};

const runTypedEmptyMapAttack = (): void => {
  const project = resetAttackProject();
  mediaProcessingEvaluation(project).setBodyText(`
    const findings = ([] as ReturnType<typeof createFinding>[]).map(() =>
      createFinding({ checkId: "decoy", lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1", message: "decoy" }));
    return { findings, inspectedFiles: [context.planEntry.ownerInspectorPath] };
  `);
  assertSignedWindowAttackRejected(project, "a typed empty array map presented as executed finding work");
};

const runEmptyArrayConstructorMapAttacks = (): void => {
  for (const emptyArray of [
    "Array<ReturnType<typeof createFinding>>()",
    "new Array<ReturnType<typeof createFinding>>()",
    "Array<ReturnType<typeof createFinding>>(0)",
    "new Array<ReturnType<typeof createFinding>>(0)",
  ]) {
    const project = resetAttackProject();
    mediaProcessingEvaluation(project).setBodyText(`
      const findings = ${emptyArray}.map(() =>
        createFinding({ checkId: "decoy", lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1", message: "decoy" }));
      return { findings, inspectedFiles: [context.planEntry.ownerInspectorPath] };
    `);
    assertSignedWindowAttackRejected(project, `a zero-length ${emptyArray} receiver presented as executed finding work`);
  }
};

export const runControlFlowReachabilityAttacks = (): void => {
  runPostReturnFindingAttack();
  runHelperUnreachableReturnFindingAttack();
  runFalsyLiteralBranchAttacks();
  runEmptyFindingSpreadAttack();
  runTypedEmptyMapAttack();
  runEmptyArrayConstructorMapAttacks();
};
