import assert from "node:assert/strict";

import { Node, Project, SyntaxKind } from "ts-morph";

import {
  inspectPhysicalCheckReceiptContract,
  inspectRetiredEnforcementSurfaces,
} from "../audit/domains/audit-system/physical-check-receipt-inspector.js";
import { inspectOwnerRegistrations } from "../audit/domains/audit-system/owner-registration-inspector.js";
import { appendDomainArtifactsFromIndexes } from "../audit/build/compose-artifact-domain-artifacts.js";
import { discoverLawFiles } from "../audit/build/discover-law-files.js";
import { loadManifests } from "../audit/build/load-manifests.js";
import { parseApexLaws } from "../audit/build/parse-apex-laws.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import type { LawSource } from "../audit/shared/law-contracts.js";
import type { ManifestSource } from "../audit/shared/manifest-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";
import {
  runOwnerFilesystemWriterEscapeAttacks,
  runSourceEvidenceReachabilityAttacks,
} from "./audit-source-evidence-reachability.attacks.js";
import { runGrasseyeRunnerLawTruthAttack } from "./audit-runner-law-truth.attacks.js";
import { assertStandaloneAuditEntrypointRejected } from "./audit-standalone-entry.attacks.js";

const mediaProcessingInspectorPath = resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts");
const legacyFixturePath = resolveFromRepo("scripts/audit/shared/legacy-receipt-attack.fixture.ts");
const attackProject = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });

const resetAttackProject = (): Project => {
  attackProject.getSourceFile(legacyFixturePath)?.forget();
  attackProject.getSourceFileOrThrow(mediaProcessingInspectorPath).refreshFromFileSystemSync();
  return attackProject;
};

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-physical-check-receipts").checks,
    completedReports: {},
    generatedPlan,
    planEntry,
    project,
  };
};

const inspectOwnerSurface = (context: InspectorContext) => {
  const findings: import("../audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  const generatedPlan = context.generatedPlan.filter((entry) => entry.capabilityDomain === "media-processing-capability");
  inspectOwnerRegistrations({ ...context, generatedPlan }, findings, new Set<string>(), "APEX-AUDIT-005-V1");
  return { findings };
};

const runRegistrationAttack = (): void => {
  const project = resetAttackProject();
  const context = buildContext(project);
  const generatedPlan = context.generatedPlan.map((entry) => entry.capabilityDomain !== "media-processing-capability"
    ? entry
    : {
        ...entry,
        bindings: entry.bindings.map((binding, index) => index !== 0
          ? binding
          : { ...binding, checkIds: [...binding.checkIds, "media-processing-capability/diagnostic-category-laundered-as-physical"] }),
      });
  const result = inspectOwnerSurface({ ...context, generatedPlan });
  assert.equal(
    result.findings.some((finding) => finding.checkId === "audit-system/runner-source"),
    true,
    "receipt governance must reject diagnostic categories laundered into manifest physical checks.",
  );
};

const runLegacyHelperAttack = (): void => {
  const project = resetAttackProject();
  project.createSourceFile(
    legacyFixturePath,
    "export const executedChecksForPlan = () => [];",
    { overwrite: true },
  );
  const result = inspectRetiredEnforcementSurfaces(buildContext(project), "APEX-AUDIT-009-V1");
  assert.equal(
    result.findings.some((finding) =>
      finding.checkId === "audit-system/runner-law-truth"
      && finding.message.includes("Legacy plan-derived")),
    true,
    "receipt governance must reject resurrection of the plan-derived receipt helper.",
  );
};

const mutateMediaProcessingInspectDomain = (bodyText: string): Project => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(mediaProcessingInspectorPath);
  const inspectDomain = inspector.getVariableDeclarationOrThrow("inspectDomain")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  inspectDomain.setBodyText(bodyText);
  return project;
};

const assertSignedWindowAttackRejected = (project: Project, label: string): void => {
  const result = inspectOwnerSurface(buildContext(project));
  assert.equal(
    result.findings.some((finding) =>
      finding.checkId === "audit-system/runner-source"
      && finding.message.includes("post-hoc or hollow")),
    true,
    `receipt governance must reject ${label}.`,
  );
};

const assertBuilderSessionReceiverRejected = (project: Project): void => {
  const laws = parseApexLaws(discoverLawFiles()).laws.filter((law) => law.status === "active");
  const manifest = loadManifests().manifests.find((entry) => entry.capabilityDomain === "media-processing-capability");
  if (!manifest) throw new Error("media-processing-capability manifest fixture is missing.");
  const lawsById = new Map<string, typeof laws>();
  for (const law of laws) lawsById.set(law.lawId, [...(lawsById.get(law.lawId) ?? []), law]);
  const outputs: Parameters<typeof appendDomainArtifactsFromIndexes>[0] = {
    conflicts: [],
    matrixRows: [],
    planEntries: [],
    staticCoverage: [],
  };
  appendDomainArtifactsFromIndexes(
    outputs,
    { lawsById, manifestsByDomain: new Map([[manifest.capabilityDomain, [manifest]]]) },
    project,
    laws,
  );
  assert.equal(outputs.conflicts.some((conflict) =>
    conflict.kind === "missing-check-evidence"
    && conflict.capabilityDomain === "media-processing-capability"), true,
  "generated artifact composition must reject a shadow checks receiver as owner check evidence.");
};

const runPostHocReceiptAttack = (): void => {
  assertSignedWindowAttackRejected(mutateMediaProcessingInspectDomain(`
    const evaluation = await inspectDomainEvaluation(context);
    await context.checks.runAll(() => ({ findings: evaluation.findings, evidenceRefs: evaluation.inspectedFiles }));
    return context.checks.output();
  `), "post-hoc filtering of a precomputed owner verdict");
};

const runAliasedPostHocReceiptAttack = (): void => {
  assertSignedWindowAttackRejected(mutateMediaProcessingInspectDomain(`
    const renamedEvaluation = inspectDomainEvaluation;
    const evaluation = await renamedEvaluation(context);
    await context.checks.runAll(() => ({ findings: evaluation.findings, evidenceRefs: evaluation.inspectedFiles }));
    return context.checks.output();
  `), "aliased post-hoc owner evaluation");
};

const runHollowCallbackAttack = (): void => {
  assertSignedWindowAttackRejected(mutateMediaProcessingInspectDomain(`
    await context.checks.runAll(() => ({ findings: [], evidenceRefs: [context.planEntry.ownerInspectorPath] }));
    return context.checks.output();
  `), "a hollow callback with arbitrary non-empty evidence");
};

const runUnrelatedHelperHollowAttack = (): void => {
  assertSignedWindowAttackRejected(mutateMediaProcessingInspectDomain(`
    await context.checks.runAll(() => {
      values([]);
      return { findings: [], evidenceRefs: [context.planEntry.ownerInspectorPath] };
    });
    return context.checks.output();
  `), "an unrelated owner helper masking a hollow callback");
};

const runOwnerLocalHollowEvaluationAttack = (): void => {
  const project = mutateMediaProcessingInspectDomain(`
    await context.checks.runAll(() => {
      const evaluation = hollowOwnerEvaluation();
      return { findings: evaluation.findings, evidenceRefs: evaluation.inspectedFiles };
    });
    return context.checks.output();
  `);
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  inspector.insertStatements(inspector.getImportDeclarations().length,
    "const hollowOwnerEvaluation = () => ({ findings: [], inspectedFiles: ['decoy'] });");
  assertSignedWindowAttackRejected(project, "an owner-local hollow evaluation helper replacing the governed owner entrypoint");
};

const runGovernedEntrypointHollowAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  evaluation.setBodyText(`
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings: [],
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(project, "the governed inspectDomainEvaluation entrypoint returning a hollow verdict");
};

const runGovernedEntrypointDecoyCallAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  evaluation.setBodyText(`
    const findings = [];
    Boolean(findings);
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings,
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(project, "an empty governed evaluation laundered through a decoy call argument");
};

const runGovernedEntrypointDecoyReceiverAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  inspector.insertStatements(inspector.getImportDeclarations().length, `
    const decoyAssertion = (findings: unknown[]) => {
      const unrelated: unknown[] = [];
      unrelated.push("decoy");
      void findings;
    };
  `);
  evaluation.setBodyText(`
    const findings: unknown[] = [];
    decoyAssertion(findings);
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings,
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(
    project,
    "a governed evaluation laundered through a helper that pushes only to an unrelated receiver",
  );
};

const runGovernedEntrypointDiscardedFindingAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  inspector.insertStatements(inspector.getImportDeclarations().length, `
    const discardedFindingEvaluation = () => {
      createFinding({ checkId: "decoy", lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1", message: "discarded" });
      return [];
    };
  `);
  evaluation.setBodyText(`
    const findings = discardedFindingEvaluation();
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings,
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(
    project,
    "a governed evaluation laundered through a discarded finding constructor result",
  );
};

const runGovernedEntrypointInlineDiscardedFindingAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  inspector.insertStatements(inspector.getImportDeclarations().length, `
    const discardInlineFinding = (_finding: unknown) => [];
  `);
  evaluation.setBodyText(`
    const findings = discardInlineFinding(createFinding({
      checkId: "decoy",
      lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1",
      message: "discarded argument",
    }));
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings,
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(
    project,
    "a governed evaluation laundered through a finding constructor discarded as an inline argument",
  );
};

const runGovernedEntrypointNestedDiscardedFindingAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  inspector.insertStatements(inspector.getImportDeclarations().length, `
    const collectNestedFinding = () => [createFinding({
      checkId: "decoy",
      lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1",
      message: "discarded nested result",
    })];
    const discardNestedFindingCollection = () => {
      collectNestedFinding();
      return [];
    };
  `);
  evaluation.setBodyText(`
    const findings = discardNestedFindingCollection();
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings,
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(
    project,
    "a nested helper that executes a real finding collector but discards its returned collection",
  );
};

const runGovernedEntrypointUnreachableFindingAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  evaluation.setBodyText(`
    const findings = [];
    if (false) {
      findings.push(createFinding({
        checkId: "decoy",
        lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1",
        message: "unreachable",
      }));
    }
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings,
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(
    project,
    "an owner assertion that exists only in a statically unreachable branch",
  );
};


const runGovernedEntrypointFakeFindingShapeAttack = (): void => {
  const project = resetAttackProject();
  const inspector = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/domains/media-processing-capability/inspector.ts"));
  const evaluation = inspector.getVariableDeclarationOrThrow("inspectDomainEvaluation")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  inspector.insertStatements(inspector.getImportDeclarations().length, `
    const fakeFinding = () => ({
      checkId: "decoy",
      lawId: "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1",
      message: "shape-only object",
    });
  `);
  evaluation.setBodyText(`
    const findings = [];
    findings.push(fakeFinding());
    return {
      capabilityDomain: context.planEntry.capabilityDomain,
      reportedLawIds: context.planEntry.lawIds,
      findings,
      inspectedFiles: [context.planEntry.ownerInspectorPath],
    };
  `);
  assertSignedWindowAttackRejected(
    project,
    "a shape-compatible object that did not flow from the canonical finding factory",
  );
};

const runOwnerCallbackShadowAttack = (): void => {
  assertSignedWindowAttackRejected(mutateMediaProcessingInspectDomain(`
    await context.checks.runAll(async () => {
      const evaluation = await inspectDomainEvaluation(context);
      {
        const evaluation = { findings: [], inspectedFiles: ["decoy"] };
        return { findings: evaluation.findings, evidenceRefs: evaluation.inspectedFiles };
      }
    });
    return context.checks.output();
  `), "an owner callback that discards the real evaluation behind a same-name shadow");
};

const runOwnerSessionReceiverShadowAttack = (): void => {
  const project = mutateMediaProcessingInspectDomain(`
    const { checks } = context;
    const shadowSession = {
      checks: {
        runAll: async (body: () => unknown) => body(),
        output: () => ({ findings: [], inspectedFiles: [], executedChecks: [] }),
      },
    };
    await shadowSession.checks.runAll(async () => {
      const evaluation = await inspectDomainEvaluation(context);
      return { findings: evaluation.findings, evidenceRefs: evaluation.inspectedFiles };
    });
    await checks.runAll(() => ({ findings: [], evidenceRefs: [context.planEntry.ownerInspectorPath] }));
    return checks.output();
  `);
  assertSignedWindowAttackRejected(
    project,
    "a shadow checks receiver hiding an authentic but hollow destructured session receipt",
  );
  assertBuilderSessionReceiverRejected(project);
};

const runOwnerSessionUncalledRunAllAttack = (): void => {
  assertSignedWindowAttackRejected(mutateMediaProcessingInspectDomain(`
    const discardedSignedWindow = async () => {
      await context.checks.runAll(async () => {
        const evaluation = await inspectDomainEvaluation(context);
        return { findings: evaluation.findings, evidenceRefs: evaluation.inspectedFiles };
      });
    };
    void discardedSignedWindow;
    return context.checks.output();
  `), "a complete signed owner window trapped in an uncalled closure");
};

const runOwnerSessionUncalledOutputAttack = (): void => {
  const project = mutateMediaProcessingInspectDomain(`
    await context.checks.runAll(async () => {
      const evaluation = await inspectDomainEvaluation(context);
      return { findings: evaluation.findings, evidenceRefs: evaluation.inspectedFiles };
    });
    const discardedOutput = () => context.checks.output();
    void discardedOutput;
    return { findings: [], inspectedFiles: [], executedChecks: [] };
  `);
  const result = inspectOwnerSurface(buildContext(project));
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/runner-law-truth"
    && finding.message.includes("output signed")), true,
  "receipt governance must reject a session output call trapped in an uncalled closure.");
};

const runOwnerCallbackNestedReturnAttack = (): void => {
  assertSignedWindowAttackRejected(mutateMediaProcessingInspectDomain(`
    await context.checks.runAll(async () => {
      const evaluation = await inspectDomainEvaluation(context);
      const discardedOwnerReturn = () => ({
        findings: evaluation.findings,
        evidenceRefs: evaluation.inspectedFiles,
      });
      void discardedOwnerReturn;
      return { findings: [], evidenceRefs: [context.planEntry.ownerInspectorPath] };
    });
    return context.checks.output();
  `), "owner findings returned only by an uncalled nested callback");
};

export const runPhysicalCheckReceiptAttacks = async (): Promise<void> => {
  runRegistrationAttack();
  runLegacyHelperAttack();
  assertStandaloneAuditEntrypointRejected(resetAttackProject(), buildContext);
  await runGrasseyeRunnerLawTruthAttack();
  runPostHocReceiptAttack();
  runAliasedPostHocReceiptAttack();
  runHollowCallbackAttack();
  runUnrelatedHelperHollowAttack();
  runOwnerLocalHollowEvaluationAttack();
  runGovernedEntrypointHollowAttack();
  runGovernedEntrypointDecoyCallAttack();
  runGovernedEntrypointDecoyReceiverAttack();
  runGovernedEntrypointDiscardedFindingAttack();
  runGovernedEntrypointInlineDiscardedFindingAttack();
  runGovernedEntrypointNestedDiscardedFindingAttack();
  runGovernedEntrypointUnreachableFindingAttack();
  runGovernedEntrypointFakeFindingShapeAttack();
  runOwnerCallbackShadowAttack();
  runOwnerSessionReceiverShadowAttack();
  runOwnerSessionUncalledRunAllAttack();
  runOwnerSessionUncalledOutputAttack();
  runOwnerCallbackNestedReturnAttack();
  runSourceEvidenceReachabilityAttacks();
  runOwnerFilesystemWriterEscapeAttacks();
};
