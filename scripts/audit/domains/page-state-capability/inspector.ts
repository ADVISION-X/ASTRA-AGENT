import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getZodEnumValues,
  hasAnyKeyword,
  hasCallExpression,
  hasCallExpressionPath,
  hasImportModuleSpecifier,
  hasLiteralTextFragment,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/page-state";
const AUDIT_ROOT = "scripts/audit/domains/page-state-capability";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/page-state-executor.ts`;
const INPUT_GATE_PATH = `${ROOT}/runtime/page-state-input-gate.ts`;
const SOURCE_GATE_PATH = `${ROOT}/runtime/observation-source-gate.ts`;
const FRESHNESS_GATE_PATH = `${ROOT}/runtime/snapshot-freshness-gate.ts`;
const PLATFORM_GATE_PATH = `${ROOT}/runtime/platform-profile-gate.ts`;
const CLASSIFICATION_GATE_PATH = `${ROOT}/runtime/state-classification-gate.ts`;
const PROCEED_GATE_PATH = `${ROOT}/runtime/proceed-decision-gate.ts`;
const FINGERPRINT_PATH = `${ROOT}/runtime/page-state-fingerprint.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/page-state-result-builder.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/page-state-proof-builder.ts`;
const DISPATCH_FAILURE_PATH = `${ROOT}/runtime/page-state-dispatch-failure.ts`;
const CLOCK_PATH = `${ROOT}/runtime/page-state-clock.ts`;
const CLOCK_PORT_PATH = `${ROOT}/ports/page-state-clock-port.ts`;
const PROFILE_PORT_PATH = `${ROOT}/ports/page-state-profile-port.ts`;
const POLICY_PATH = `${ROOT}/shared/page-state-policy.ts`;
const COORDINATE_RUNTIME_PATH = "src/lib/local-runtime/tiktok-platform/coordinate-runtime.ts";
const TIKTOK_RUNTIME_PATH = "src/lib/local-runtime/tiktok-platform/runtime.ts";

const CHILDREN = [
  "detect-login-state",
  "detect-safety-page",
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-page-abnormality",
  "detect-platform-page-kind",
] as const;

const REQUIRED_SHARED_FILES = [
  "shared/page-state-types.ts",
  "shared/page-state-policy.ts",
  "shared/page-state-result.ts",
  "shared/page-state-proof.ts",
  "shared/page-state-failure.ts",
  "shared/page-state-observation.ts",
  "shared/page-state-profile.ts",
] as const;

const RETIRED_FILES = [
  `${ROOT}/shared/confidence-policy.ts`,
  `${ROOT}/shared/observation-utils.ts`,
  `${ROOT}/shared/platform-profiles.ts`,
  `${ROOT}/shared/state-policy.ts`,
  `${ROOT}/state-profiles.ts`,
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "capabilities/ai",
  "capabilities/open/children",
  "capabilities/screenshot/children",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/geometry-guard",
  "capabilities/forensics-persistence",
] as const;

function toPascalCase(childId: string): string {
  return childId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function getPageStateSourceFiles(project: ReturnType<typeof createAuditProject>): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

function hasThrowStatement(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
}

function hasDateOutsideClock(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath === CLOCK_PATH) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
      const callee = expression.getExpression();
      return Node.isPropertyAccessExpression(callee)
        && callee.getExpression().getText() === "Date"
        && (callee.getName() === "now" || callee.getName() === "parse");
    });
}

function hasZodRecordUnknown(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
    const callee = expression.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) {
      return false;
    }
    if (callee.getExpression().getText() !== "z" || callee.getName() !== "record") {
      return false;
    }

    return expression.getArguments().some((argument) => argument.getText().includes("unknown"));
  });
}

function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return hasAnyKeyword(sourceFile)
    || text.includes(" as any")
    || text.includes("as unknown as")
    || text.includes("@ts-ignore")
    || text.includes("@ts-expect-error")
    || text.includes("eslint-disable")
    || text.includes("require(")
    || sourceFile.getDescendantsOfKind(SyntaxKind.ImportExpression).length > 0;
}

function getEnumValuesFromSchema(sourceFile: SourceFile, declarationName: string): string[] {
  const directValues = getZodEnumValues(sourceFile, declarationName);
  if (directValues.length > 0) {
    return directValues;
  }

  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isIdentifier(firstArgument)) {
    return [];
  }

  const valuesDeclaration = sourceFile.getVariableDeclaration(firstArgument.getText());
  const valuesInitializerNode = valuesDeclaration?.getInitializer();
  const valuesInitializer = Node.isArrayLiteralExpression(valuesInitializerNode)
    ? valuesInitializerNode
    : Node.isAsExpression(valuesInitializerNode) && Node.isArrayLiteralExpression(valuesInitializerNode.getExpression())
      ? valuesInitializerNode.getExpression()
      : null;
  if (!valuesInitializer) {
    return [];
  }

  return valuesInitializer
    .getElements()
    .filter((element) => Node.isStringLiteral(element))
    .map((element) => element.getLiteralText());
}

function getOrAdd(project: ReturnType<typeof createAuditProject>, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

function getProceedTypesForChild(sourceFile: SourceFile, childId: string): string[] {
  const declaration = sourceFile.getVariableDeclaration("PROCEED_PAGE_STATE_TYPES_BY_CHILD");
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  const property = initializer?.getProperties().find((candidate) => {
    return Node.isPropertyAssignment(candidate) && candidate.getNameNode().getText().replaceAll("\"", "") === childId;
  });

  if (!property || !Node.isPropertyAssignment(property)) {
    return [];
  }

  const value = property.getInitializer();
  const arrayLiteral = Node.isArrayLiteralExpression(value)
    ? value
    : Node.isAsExpression(value) && Node.isArrayLiteralExpression(value.getExpression())
      ? value.getExpression()
      : null;
  if (!arrayLiteral) {
    return [];
  }

  return arrayLiteral.getElements().filter((element) => Node.isStringLiteral(element)).map((element) => element.getLiteralText());
}

export default createPendingDomainInspector({
  inspector: "GrassEye Page State Capability Owner Inspector",
  inspectorId: "page-state-capability-owner",
  capabilityDomain: "page-state-capability",
  inspectorEntry: "scripts/audit/domains/page-state-capability/inspector.ts",
  ownedPaths: [ROOT, AUDIT_ROOT],
  pendingSummary: "page-state rebuild requires the governed package, runtime gates, and ts-morph owner enforcement",
  implementedSummary: "page-state exposes a thin ability-group, governed runtime gates, typed child capabilities, and enforced proof/result boundaries",
  extraChecks: async () => {
    const project = createAuditProject();
    const findings: Finding[] = [];

    const contractSource = getOrAdd(project, CONTRACT_PATH);
    const abilityGroupSource = getOrAdd(project, ABILITY_GROUP_PATH);
    const schemaSource = getOrAdd(project, SCHEMA_PATH);
    const registrySource = getOrAdd(project, REGISTRY_PATH);
    const indexSource = getOrAdd(project, INDEX_PATH);
    const executorSource = getOrAdd(project, EXECUTOR_PATH);
    const policySource = getOrAdd(project, POLICY_PATH);
    const resultBuilderSource = getOrAdd(project, RESULT_BUILDER_PATH);
    const proofBuilderSource = getOrAdd(project, PROOF_BUILDER_PATH);
    const coordinateRuntimeSource = getOrAdd(project, COORDINATE_RUNTIME_PATH);
    const tikTokRuntimeSource = getOrAdd(project, TIKTOK_RUNTIME_PATH);
    const pageStateRootSources = getPageStateSourceFiles(project);

    const requiredFiles = [
      CONTRACT_PATH,
      ABILITY_GROUP_PATH,
      SCHEMA_PATH,
      REGISTRY_PATH,
      INDEX_PATH,
      EXECUTOR_PATH,
      INPUT_GATE_PATH,
      SOURCE_GATE_PATH,
      FRESHNESS_GATE_PATH,
      PLATFORM_GATE_PATH,
      CLASSIFICATION_GATE_PATH,
      PROCEED_GATE_PATH,
      FINGERPRINT_PATH,
      RESULT_BUILDER_PATH,
      PROOF_BUILDER_PATH,
      DISPATCH_FAILURE_PATH,
      CLOCK_PATH,
      CLOCK_PORT_PATH,
      PROFILE_PORT_PATH,
      ...REQUIRED_SHARED_FILES.map((path) => `${ROOT}/${path}`),
      ...CHILDREN.flatMap((child) => [
        `${ROOT}/children/${child}/contract.ts`,
        `${ROOT}/children/${child}/schema.ts`,
        `${ROOT}/children/${child}/implementation.ts`,
      ]),
    ];

    for (const requiredFile of requiredFiles) {
      if (!(await fileExists(pathFromRepoRoot(requiredFile)))) {
        findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: requiredFile, line: 1, severity: "fatal", message: "Required page-state canonical file is missing." }));
      }
    }

    for (const retiredFile of RETIRED_FILES) {
      if (await fileExists(pathFromRepoRoot(retiredFile))) {
        findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: retiredFile, line: 1, severity: "fatal", message: "Retired page-state lightweight helper residue must stay deleted." }));
      }
    }

    const requiredSchemaNames = [
      "PageStateChildCapabilityIdSchema",
      "PageStateStatusSchema",
      "PageStateDecisionSchema",
      "PageStateTypeSchema",
      "PageStateSnapshotSchema",
      "PageStateObservationSchema",
      "PageStateFreshnessPolicySchema",
      "PageStateConfidencePolicySchema",
      "PageStateRuntimeProofSchema",
      "PageStateAbilityResultSchema",
    ];
    for (const schemaName of requiredSchemaNames) {
      if (!schemaSource.getVariableDeclaration(schemaName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Page State schema must define ${schemaName}.` }));
      }
    }

    const childEnumValues = getEnumValuesFromSchema(schemaSource, "PageStateChildCapabilityIdSchema");
    if (childEnumValues.sort().join(",") !== [...CHILDREN].sort().join(",")) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Page State schema child ids must match the governed child registry." }));
    }

    const contractInterface = contractSource.getInterface("PageStateAbilityGroup");
    const contractMethods = contractInterface?.getMethods().map((method) => method.getName()) ?? [];
    if (!contractInterface || contractMethods.join(",") !== "listChildCapabilityIds,execute") {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Page State contract must expose only listChildCapabilityIds and execute on the public ability-group surface." }));
    }
    if (!contractSource.getInterface("PageStateChildCapability") || !contractSource.getFullText().includes("PageStateChildDetection")) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Page State child contract must return typed child detections, not final result objects." }));
    }

    if (!hasCallExpressionPath(abilityGroupSource, ["PageStateAbilityInputSchema", "safeParse"]) || !hasCallExpression(abilityGroupSource, "createPageStateRegistry") || !hasCallExpression(abilityGroupSource, "executePageState")) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Page State ability-group must stay thin and route through input parse, registry, and page-state executor." }));
    }
    if (hasThrowStatement(abilityGroupSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Page State ability-group must not throw across the capability boundary." }));
    }

    const requiredExecutorCalls = [
      "gatePageStateInput",
      "gateObservationSources",
      "gateSnapshotFreshness",
      "gatePlatformProfile",
      "classifyPageState",
      "decideProceed",
      "createPageStateFingerprint",
      "buildPageStateRuntimeProof",
      "buildPageStateResult",
    ];
    for (const callName of requiredExecutorCalls) {
      if (!hasCallExpression(executorSource, callName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Page State executor must route through ${callName}.` }));
      }
    }

    if (!hasCallExpressionPath(resultBuilderSource, ["PageStateAbilityResultSchema", "parse"])) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Page State result builder must parse public output with PageStateAbilityResultSchema." }));
    }
    if (!hasCallExpressionPath(proofBuilderSource, ["PageStateRuntimeProofSchema", "parse"])) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Page State proof builder must parse runtime proof with PageStateRuntimeProofSchema." }));
    }
    if (!hasLiteralTextFragment(schemaSource, "reviewRequiredReason cannot coexist with success status")
      || !hasLiteralTextFragment(schemaSource, "success result must proceed")
      || !hasLiteralTextFragment(schemaSource, "blocked or review_required result cannot proceed")
      || !hasLiteralTextFragment(schemaSource, "success proof must proceed")
      || !hasLiteralTextFragment(schemaSource, "blocked or review_required proof cannot proceed")) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Page State schema must enforce success/review/block invariants for result and runtime proof outputs." }));
    }

    const loginProceedTypes = getProceedTypesForChild(policySource, "detect-login-state");
    const safetyProceedTypes = getProceedTypesForChild(policySource, "detect-safety-page");
    if (loginProceedTypes.join(",") !== "logged_in" || safetyProceedTypes.join(",") !== "page_normal") {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: POLICY_PATH, line: 1, severity: "fatal", message: "Page State proceed policy must keep login-state gated to logged_in and safety-page gated to page_normal only." }));
    }

    for (const childId of CHILDREN) {
      if (!registrySource.getFullText().includes(childId)) {
        findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: `Page State registry must register ${childId}.` }));
      }

      const implementationPath = `${ROOT}/children/${childId}/implementation.ts`;
      const implementationSource = getOrAdd(project, implementationPath);
      const pascalName = `${toPascalCase(childId)}Child`;
      if (!hasCallExpressionPath(implementationSource, [`${pascalName}InputSchema`, "parse"]) || !hasCallExpressionPath(implementationSource, [`${pascalName}OutputSchema`, "parse"])) {
        findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: implementationPath, line: 1, severity: "fatal", message: "Page State child implementation must parse child input and output through its own schema files." }));
      }
    }

    const feedReadySource = getOrAdd(project, `${ROOT}/children/detect-feed-ready/implementation.ts`);
    if (!hasCallExpression(feedReadySource, "findPageMarker") || !hasCallExpression(feedReadySource, "findPlatformCaptures") || !hasCallExpression(feedReadySource, "findVisualTargets")) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/children/detect-feed-ready/implementation.ts`, line: 1, severity: "fatal", message: "Feed-ready child must rely on governed observations, not currentUrl-only classification." }));
    }

    if (hasZodRecordUnknown(schemaSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Page State schema must not use z.record with unknown payload for production observations." }));
    }

    if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Page State index must not use export-star barrels." }));
    }

    const forbiddenImportFile = pageStateRootSources.find((sourceFile) => FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)));
    if (forbiddenImportFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: toRepoRelativePath(forbiddenImportFile.getFilePath()), line: 1, severity: "fatal", message: "Page State root must not import AI, Open, Screenshot, Mouse, Geometry, or Forensics implementations." }));
    }

    const privateChildLeak = project.getSourceFiles().find((sourceFile) => {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath.startsWith(`${ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
        return false;
      }
      return sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue().includes("/capabilities/page-state/children/"));
    });
    if (privateChildLeak) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: toRepoRelativePath(privateChildLeak.getFilePath()), line: 1, severity: "fatal", message: "Page State children must stay private to the canonical root." }));
    }

    const directDateFile = pageStateRootSources.find((sourceFile) => hasDateOutsideClock(sourceFile));
    if (directDateFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: toRepoRelativePath(directDateFile.getFilePath()), line: 1, severity: "fatal", message: "Page State runtime must use the clock port instead of scattered Date constructors or Date.now/parse." }));
    }

    const antiEscapeFile = pageStateRootSources.find((sourceFile) => hasForbiddenEscape(sourceFile));
    if (antiEscapeFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: toRepoRelativePath(antiEscapeFile.getFilePath()), line: 1, severity: "fatal", message: "Page State root must not use any/escape hatches/dynamic import/require." }));
    }

    if (!coordinateRuntimeSource.getFullText().includes("buildPageStateAbilityInput") || !tikTokRuntimeSource.getFullText().includes("buildPageStateAbilityInput")) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: COORDINATE_RUNTIME_PATH, line: 1, severity: "error", message: "Local runtime must hand page-state a governed snapshot/observation request shape instead of legacy currentUrl-only inputs." }));
    }
    if (!tikTokRuntimeSource.getFullText().includes('status !== "success"')) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V1", file: TIKTOK_RUNTIME_PATH, line: 1, severity: "error", message: "Runtime consumers must stop on blocked/review_required page-state results instead of continuing execution." }));
    }

    const requiredShapePassed = !findings.some((finding) => finding.message === "Required page-state canonical file is missing." || finding.message === "Retired page-state lightweight helper residue must stay deleted." || finding.file === SCHEMA_PATH && finding.severity === "fatal");
    const packageShapePassed = !findings.some((finding) => finding.file === CONTRACT_PATH || finding.file === ABILITY_GROUP_PATH || finding.file === REGISTRY_PATH || finding.file === INDEX_PATH);
    const runtimeChainPassed = !findings.some((finding) => finding.file === EXECUTOR_PATH || finding.file === INPUT_GATE_PATH || finding.file === SOURCE_GATE_PATH || finding.file === FRESHNESS_GATE_PATH || finding.file === PLATFORM_GATE_PATH || finding.file === CLASSIFICATION_GATE_PATH || finding.file === PROCEED_GATE_PATH || finding.file === RESULT_BUILDER_PATH || finding.file === PROOF_BUILDER_PATH || finding.file === DISPATCH_FAILURE_PATH || finding.file === CLOCK_PATH);
    const boundaryPassed = !findings.some((finding) => finding.message.includes("must not import") || finding.message.includes("must stay private") || finding.message.includes("must stop on blocked"));
    const antiEscapePassed = !findings.some((finding) => finding.message.includes("must not use any") || finding.message.includes("must not use export-star") || finding.message.includes("must use the clock port"));

    return {
      findings,
      phases: [
        createPhase("page-state-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Page State canonical package shape is present." : "Page State canonical package shape is incomplete."),
        createPhase("page-state-package-contract", packageShapePassed ? "PASS" : "CODE VIOLATION", packageShapePassed, packageShapePassed ? "Page State public contract, thin ability-group, registry, and explicit index are governed." : "Page State public package contract still leaks lightweight-classifier residue."),
        createPhase("page-state-runtime-chain", runtimeChainPassed ? "PASS" : "CODE VIOLATION", runtimeChainPassed, runtimeChainPassed ? "Page State executor routes through all governed gates, fingerprint, result, and proof builders." : "Page State runtime chain is missing one or more governed gates or builders."),
        createPhase("page-state-boundary", boundaryPassed ? "PASS" : "CODE VIOLATION", boundaryPassed, boundaryPassed ? "Page State boundary is isolated from forbidden imports and private child leaks." : "Page State boundary still leaks or is consumed unsafely."),
        createPhase("page-state-anti-escape", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Page State root avoids export-star, escape hatches, and scattered Date usage." : "Page State anti-escape protections are violated."),
      ],
    };
  },
});