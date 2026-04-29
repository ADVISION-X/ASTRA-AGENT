import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  hasAnyKeyword,
  hasCallExpression,
  hasCallExpressionPath,
  hasInterfaceMethod,
  hasImportModuleSpecifier,
  hasPropertyAccessPath,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/post-action-verification";
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/post-action-verification-executor.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const SHARED_TYPES_PATH = `${ROOT}/shared/post-action-types.ts`;
const SHARED_RESULT_PATH = `${ROOT}/shared/post-action-result.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/verification-result-builder.ts`;

const REQUIRED_FILES = [
  SCHEMA_PATH,
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  `${ROOT}/runtime/verification-input-gate.ts`,
  `${ROOT}/runtime/action-proof-gate.ts`,
  `${ROOT}/runtime/evidence-source-gate.ts`,
  `${ROOT}/runtime/before-after-consistency-gate.ts`,
  `${ROOT}/runtime/verification-policy-gate.ts`,
  `${ROOT}/runtime/verification-decision-gate.ts`,
  `${ROOT}/runtime/verification-result-builder.ts`,
  `${ROOT}/runtime/verification-proof-builder.ts`,
  `${ROOT}/runtime/verification-dispatch-failure.ts`,
  `${ROOT}/runtime/verification-clock.ts`,
  `${ROOT}/ports/post-action-verification-clock-port.ts`,
  `${ROOT}/ports/post-action-evidence-read-port.ts`,
] as const;

const CHILDREN = [
  "verify-page-opened",
  "verify-comments-panel-opened",
  "verify-comments-panel-closed",
  "verify-video-changed-after-scroll",
  "verify-not-interested-result",
  "verify-target-state-changed",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "capabilities/ai/",
  "capabilities/open/",
  "capabilities/screenshot/children",
  "capabilities/mouse-click/children",
  "capabilities/mouse-scroll/children",
  "capabilities/geometry-guard/",
  "capabilities/page-state/",
  "capabilities/forensics-persistence/",
] as const;

function hasForbiddenComment(sourceText: string): boolean {
  return sourceText.includes("@ts-ignore")
    || sourceText.includes("@ts-expect-error")
    || sourceText.includes("eslint-disable");
}

function hasRequireOrDynamicImport(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return (Node.isIdentifier(expression) && expression.getText() === "require")
      || expression.getKind() === SyntaxKind.ImportKeyword;
  });
}

function hasNewDate(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
}

export default createPendingDomainInspector({
  inspector: "GrassEye Post-action Verification Capability Owner Inspector",
  inspectorId: "post-action-verification-capability-owner",
  capabilityDomain: "post-action-verification-capability",
  inspectorEntry: "scripts/audit/domains/post-action-verification-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "post-action-verification-capability is pending until executor, gates, proof builder, and child contracts match the standard package shape",
  implementedSummary: "post-action-verification-capability is implemented as a governed post-action judge with executor, gates, proof builder, and anti-escape boundaries",
  extraChecks: async () => {
    const project = createAuditProject();
    const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const sharedTypesSource = getSourceFileOrThrow(project, SHARED_TYPES_PATH);
    const sharedResultSource = getSourceFileOrThrow(project, SHARED_RESULT_PATH);
    const resultBuilderSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
    const ownedFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const findings: Finding[] = [];

    const requiredFilesPresent = (await Promise.all(REQUIRED_FILES.map((filePath) => fileExists(pathFromRepoRoot(filePath))))).every(Boolean);
    if (!requiredFilesPresent) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: ROOT, line: 1, severity: "fatal", message: "Post Action Verification must contain the standard schema, runtime gates, builders, executor, and ports." }));
    }

    const childFilesPresent = (await Promise.all(
      CHILDREN.flatMap((child) => [
        fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/contract.ts`)),
        fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/schema.ts`)),
        fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/implementation.ts`)),
      ]),
    )).every(Boolean);
    if (!childFilesPresent) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: ROOT, line: 1, severity: "error", message: "Every Post Action Verification child must expose contract/schema/implementation files." }));
    }

    const childIdsMatch = CHILDREN.every((child) => sharedTypesSource.getFullText().includes(`"${child}"`))
      && CHILDREN.every((child) => registrySource.getFullText().includes(`"${child}"`));
    if (!childIdsMatch) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "error", message: "schema.ts and registry.ts must agree on every child capability id." }));
    }

    const schemaShapePassed = sharedResultSource.getFullText().includes('"review_required"')
      && sharedResultSource.getFullText().includes('"blocked"')
      && hasInterfaceMethod(contractSource, "PostActionVerificationAbilityGroup", "execute");
    if (!schemaShapePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "error", message: "schema.ts must expose review_required and blocked statuses plus the public execute interface." }));
    }

    const decisionStatusGuardPassed = schemaSource.getFullText().includes("success status requires verified decision")
      && schemaSource.getFullText().includes("reviewRequiredReason cannot exist on success")
      && !resultBuilderSource.getFullText().includes('status: "success"');
    if (!decisionStatusGuardPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "error", message: "Result/status guard is incomplete: failed/review_required/blocked must not be wrapped as success." }));
    }

    const rawPayloadGuardPassed = !schemaSource.getFullText().includes("z.record(z.string(), z.unknown())");
    if (!rawPayloadGuardPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Raw Record<string, unknown> payloads are forbidden in Post Action Verification observations." }));
    }

    const executorShapePassed = hasCallExpression(executorSource, "validatePostActionVerificationInput")
      && hasCallExpression(executorSource, "validateActionProof")
      && hasCallExpression(executorSource, "validateEvidenceSources")
      && hasCallExpression(executorSource, "validateBeforeAfterConsistency")
      && hasCallExpression(executorSource, "validateVerificationPolicy")
      && hasCallExpression(executorSource, "finalizeVerificationDecision")
      && hasCallExpression(executorSource, "buildPostActionVerificationResult")
      && hasCallExpression(executorSource, "buildPostActionRuntimeProof");
    if (!executorShapePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "post-action-verification-executor must run input gate, action proof gate, evidence gate, before/after gate, policy gate, decision gate, result builder, and proof builder." }));
    }

    const thinAbilityGroupPassed = hasCallExpressionPath(abilityGroupSource, ["PostActionVerificationAbilityInputSchema", "safeParse"])
      && hasCallExpression(abilityGroupSource, "executePostActionVerification")
      && hasCallExpression(abilityGroupSource, "dispatchPostActionVerificationFailure")
      && abilityGroupSource.getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 0;
    if (!thinAbilityGroupPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "error", message: "ability-group.ts must stay thin: parse, route, execute, and governed-failure only." }));
    }

    const noExportStar = !indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
    if (!noExportStar) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Post Action Verification index.ts must not use export *." }));
    }

    const noCapabilityCheckRemnants = !ownedFiles.some((filePath) => filePath.endsWith("/capability-check.ts"));
    if (!noCapabilityCheckRemnants) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: ROOT, line: 1, severity: "fatal", message: "capability-check.ts remnants must be removed from Post Action Verification." }));
    }

    const forbiddenImports = ownedFiles.flatMap((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }

      return FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker))
        ? [toRepoRelativePath(filePath)]
        : [];
    });
    if (forbiddenImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V1", file: forbiddenImports[0]!, line: 1, severity: "fatal", message: "Post Action Verification must not import AI/Open/Screenshot/Mouse/Geometry/PageState/Forensics implementation details." }));
    }

    const antiEscapeViolations = ownedFiles.flatMap((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }

      const sourceText = sourceFile.getFullText();
      const hasAsUnknownAs = sourceText.includes("as unknown as");
      const hasDateParse = hasPropertyAccessPath(sourceFile, ["Date", "parse"]);
      const allowClockDate = filePath.endsWith("/runtime/verification-clock.ts");
      return hasAnyKeyword(sourceFile)
        || hasAsUnknownAs
        || hasForbiddenComment(sourceText)
        || hasRequireOrDynamicImport(sourceFile)
        || (!allowClockDate && hasNewDate(sourceFile))
        || hasDateParse
        ? [toRepoRelativePath(filePath)]
        : [];
    });
    if (antiEscapeViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: antiEscapeViolations[0]!, line: 1, severity: "fatal", message: "Post Action Verification anti-escape guard failed: found any/unknown laundering, forbidden comments, require/import(), new Date, Date.parse, or re-export laundering." }));
    }

    return {
      findings,
      phases: [
        createPhase("post-action-verification-required-shape", requiredFilesPresent && childFilesPresent && childIdsMatch && schemaShapePassed && executorShapePassed && decisionStatusGuardPassed && rawPayloadGuardPassed, requiredFilesPresent && childFilesPresent && childIdsMatch && schemaShapePassed && executorShapePassed && decisionStatusGuardPassed && rawPayloadGuardPassed ? "PASS" : "CODE VIOLATION", requiredFilesPresent && childFilesPresent && childIdsMatch && schemaShapePassed && executorShapePassed && decisionStatusGuardPassed && rawPayloadGuardPassed ? "Required shape exists: schema, registry, executor, gates, builders, ports, and child contracts are in place." : "Required shape is incomplete."),
        createPhase("post-action-verification-forbidden-shape", noExportStar && noCapabilityCheckRemnants, noExportStar && noCapabilityCheckRemnants ? "PASS" : "CODE VIOLATION", noExportStar && noCapabilityCheckRemnants ? "Forbidden shape remnants such as export * and capability-check.ts are gone." : "Forbidden shape remnants still exist."),
        createPhase("post-action-verification-boundary", thinAbilityGroupPassed && forbiddenImports.length === 0, thinAbilityGroupPassed && forbiddenImports.length === 0 ? "PASS" : "CODE VIOLATION", thinAbilityGroupPassed && forbiddenImports.length === 0 ? "Boundary holds: thin ability group and no forbidden runtime owner imports." : "Boundary is leaking or the ability group is too thick."),
        createPhase("post-action-verification-anti-escape", antiEscapeViolations.length === 0, antiEscapeViolations.length === 0 ? "PASS" : "CODE VIOLATION", antiEscapeViolations.length === 0 ? "Anti-escape checks passed." : "Anti-escape violations were detected."),
      ],
    };
  },
});
