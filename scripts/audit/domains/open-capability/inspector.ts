import { Node, SyntaxKind, type Identifier, type ObjectLiteralExpression, type Project, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { getNodeLine, getReferencePaths } from "../../core/ts-morph.js";
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
  hasMethodNamed,
  hasPropertyNamed,
  hasTypeReference,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectLocalBrowserSessionBoundary } from "../local-browser-session/inspector.js";
import { inspectPlatformActionBoundary } from "../platform-action/inspector.js";

const OPEN_ROOT = "src/capabilities/open";
const CONTRACT_PATH = `${OPEN_ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${OPEN_ROOT}/ability-group.ts`;
const SCHEMA_PATH = `${OPEN_ROOT}/schema.ts`;
const REGISTRY_PATH = `${OPEN_ROOT}/registry.ts`;
const INDEX_PATH = `${OPEN_ROOT}/index.ts`;
const EXECUTOR_PATH = `${OPEN_ROOT}/runtime/open-executor.ts`;
const INPUT_GATE_PATH = `${OPEN_ROOT}/runtime/open-input-gate.ts`;
const TARGET_POLICY_GATE_PATH = `${OPEN_ROOT}/runtime/target-policy-gate.ts`;
const URL_SAFETY_GATE_PATH = `${OPEN_ROOT}/runtime/url-safety-gate.ts`;
const SESSION_GATE_PATH = `${OPEN_ROOT}/runtime/real-chrome-session-gate.ts`;
const NAVIGATION_RUNNER_PATH = `${OPEN_ROOT}/runtime/navigation-runner.ts`;
const POST_OPEN_STATE_GATE_PATH = `${OPEN_ROOT}/runtime/post-open-state-gate.ts`;
const RESULT_BUILDER_PATH = `${OPEN_ROOT}/runtime/open-result-builder.ts`;
const PROOF_BUILDER_PATH = `${OPEN_ROOT}/runtime/open-proof-builder.ts`;
const DISPATCH_FAILURE_PATH = `${OPEN_ROOT}/runtime/open-dispatch-failure.ts`;
const CLOCK_PATH = `${OPEN_ROOT}/runtime/open-clock.ts`;
const CLOCK_PORT_PATH = `${OPEN_ROOT}/ports/open-clock-port.ts`;
const MANIFEST_PATH = "scripts/audit/domains/open-capability/manifest.json";
const NEGATIVE_PROOF_HARNESS_PATH = "scripts/audit/domains/open-capability/negative-proof-harness.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";

const CHILDREN = ["open-tiktok", "open-facebook", "open-local-workbench"] as const;

const REQUIRED_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  SCHEMA_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  EXECUTOR_PATH,
  INPUT_GATE_PATH,
  TARGET_POLICY_GATE_PATH,
  URL_SAFETY_GATE_PATH,
  SESSION_GATE_PATH,
  NAVIGATION_RUNNER_PATH,
  POST_OPEN_STATE_GATE_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  CLOCK_PATH,
  CLOCK_PORT_PATH,
  MANIFEST_PATH,
  NEGATIVE_PROOF_HARNESS_PATH,
  ...CHILDREN.flatMap((child) => [
    `${OPEN_ROOT}/children/${child}/contract.ts`,
    `${OPEN_ROOT}/children/${child}/schema.ts`,
    `${OPEN_ROOT}/children/${child}/implementation.ts`,
  ]),
] as const;

const REQUIRED_SCHEMA_DECLARATIONS = [
  "OpenBoundaryPolicySchema",
  "OpenProofPolicySchema",
  "OpenOutputPolicySchema",
  "OpenFailurePolicySchema",
  "OpenDataQualityFlagSchema",
  "OpenFailureInputParseDecisionSchema",
  "OpenTraceFieldSourceSchema",
  "OpenTargetProfileSchema",
  "OpenRequestSchema",
  "OpenResultSchema",
  "OpenRuntimeProofSchema",
] as const;

const REGISTRY_REQUIRED_FIELDS = [
  "childCapabilityId",
  "platformId",
  "targetKind",
  "inputSchema",
  "outputSchema",
  "implementation",
  "allowedCaller",
  "requiresNerveBus",
  "allowedHostnames",
  "allowedSchemes",
  "defaultUrl",
  "defaultTitle",
  "purpose",
  "requiresRealChromeSession",
  "allowsLocalhost",
  "maxOpenDurationMs",
  "postOpenStatePolicy",
  "pageStateHandoffRequired",
  "allowReplay",
  "timeoutPolicy",
  "idempotencyPolicy",
  "boundaryPolicy",
  "proofPolicy",
  "outputPolicy",
  "failurePolicy",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "capabilities/ai",
  "capabilities/screenshot",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/geometry-guard",
  "capabilities/forensics-persistence",
] as const;

const FORBIDDEN_EXTERNAL_IMPORTS = [
  "/capabilities/open/children/",
  "/capabilities/open/runtime/",
  "/capabilities/open/registry",
] as const;

const FORBIDDEN_COMMENT_DIRECTIVES = ["@ts-ignore", "@ts-expect-error", "eslint-disable"] as const;

function getOpenSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${OPEN_ROOT}/`));
}

function getOpenSourceOrThrow(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

function getRegistryEntries(sourceFile: SourceFile): ObjectLiteralExpression[] {
  const declaration = sourceFile.getVariableDeclaration("OPEN_CHILDREN");
  const initializer = declaration?.getInitializer();
  const arrayLiteral = unwrapExpression(initializer);
  if (!arrayLiteral || !Node.isArrayLiteralExpression(arrayLiteral)) {
    return [];
  }

  return arrayLiteral.getElements().filter(Node.isObjectLiteralExpression);
}

function unwrapExpression(node: Node | undefined): Node | undefined {
  if (!node) {
    return undefined;
  }

  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }

  return node;
}

function hasStrictSuccessStatusCheck(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsEqualsEqualsToken) {
      return false;
    }

    const left = expression.getLeft();
    const right = expression.getRight();
    const leftPath = Node.isPropertyAccessExpression(left) ? left.getName() : "";
    return leftPath === "status" && Node.isStringLiteral(right) && right.getLiteralText() === "success";
  });
}

function hasReturnedObjectProperty(sourceFile: SourceFile, propertyName: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((returnStatement) => {
    const expression = returnStatement.getExpression();
    if (!expression || !Node.isCallExpression(expression)) {
      return false;
    }

    const argument = expression.getArguments()[0];
    if (!argument || !Node.isObjectLiteralExpression(argument)) {
      return false;
    }

    return argument.getProperties().some((property) => {
      return (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
        && property.getName() === propertyName;
    });
  });
}

function getObjectPropertyNames(objectLiteral: ObjectLiteralExpression): Set<string> {
  return new Set(
    objectLiteral
      .getProperties()
      .filter((property) => Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
}

function collectComments(sourceFile: SourceFile): string[] {
  const comments = new Set<string>();
  const nodes = [sourceFile, ...sourceFile.getDescendants()];
  for (const node of nodes) {
    for (const range of node.getLeadingCommentRanges()) {
      comments.add(range.getText());
    }
    for (const range of node.getTrailingCommentRanges()) {
      comments.add(range.getText());
    }
  }
  return [...comments];
}

function hasCommentDirective(sourceFile: SourceFile): boolean {
  return collectComments(sourceFile).some((comment) => FORBIDDEN_COMMENT_DIRECTIVES.some((directive) => comment.includes(directive)));
}

function hasDateUsageOutsideClock(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath === CLOCK_PATH) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
      const callee = expression.getExpression();
      return Node.isPropertyAccessExpression(callee)
        && callee.getExpression().getText() === "Date"
        && callee.getName() === "now";
    });
}

function hasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function hasRequireCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
    const callee = expression.getExpression();
    return Node.isIdentifier(callee) && callee.getText() === "require";
  });
}

function hasCookieRead(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isIdentifier(node)) {
      const text = node.getText().toLowerCase();
      return text === "cookie" || text === "cookies";
    }
    if (Node.isPropertyAccessExpression(node)) {
      const name = node.getName().toLowerCase();
      return name === "cookie" || name === "cookies" || name === "storageState".toLowerCase();
    }
    return false;
  });
}

function resolveModuleSourcePath(declaration: import("ts-morph").ImportDeclaration | import("ts-morph").ExportDeclaration): string | null {
  const sourceFile = declaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRepoRelativePath(sourceFile.getFilePath()) : null;
}

function getFunctionIdentifier(sourceFile: SourceFile, functionName: string): Identifier | null {
  return sourceFile.getFunction(functionName)?.getNameNode() ?? null;
}

function hasUnknownAsChain(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => expression.getExpression().getText().includes(" as unknown"));
}

function hasDispatchFailureFabrication(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    const name = property.getName();
    const initializer = property.getInitializer();
    if (!initializer) {
      return false;
    }

    if (name === "status" && Node.isStringLiteral(initializer) && initializer.getLiteralText() === "allow") {
      return true;
    }

    if (name === "targetProfileRef") {
      if (Node.isStringLiteral(initializer) && initializer.getLiteralText().includes("open-target-profile:")) {
        return true;
      }
      if (initializer.getText() !== "null") {
        return true;
      }
    }

    return false;
  });
}

function hasStatusClassificationObject(sourceFile: SourceFile, status: string, classification: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    let statusMatches = false;
    let classificationMatches = false;

    for (const property of objectLiteral.getProperties()) {
      if (!Node.isPropertyAssignment(property)) {
        continue;
      }

      const initializer = property.getInitializer();
      if (!initializer || !Node.isStringLiteral(initializer)) {
        continue;
      }

      if (property.getName() === "status" && initializer.getLiteralText() === status) {
        statusMatches = true;
      }

      if (property.getName() === "classification" && initializer.getLiteralText() === classification) {
        classificationMatches = true;
      }
    }

    return statusMatches && classificationMatches;
  });
}

function hasForbiddenResolvedImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const resolvedPath = resolveModuleSourcePath(declaration);
    if (!resolvedPath) {
      return false;
    }

    return FORBIDDEN_IMPORT_MARKERS.some((marker) => resolvedPath.includes(marker));
  });
}

export const openCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Open Capability Owner Inspector",
  inspectorId: "open-capability-owner",
  capabilityDomain: "open-capability",
  inspectorEntry: "scripts/audit/domains/open-capability/inspector.ts",
  ownedPaths: [OPEN_ROOT],
  pendingSummary: "open-capability must close through the owner inspector, standard package, and negative proof harness",
  implementedSummary: "open-capability exposes one governed package with metadata registry, runtime gates, child-local contracts, and negative proof enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const findings: Finding[] = [];

    for (const requiredFile of REQUIRED_FILES) {
      if (!(await fileExists(pathFromRepoRoot(requiredFile)))) {
        findings.push(createFinding({
          lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
          file: requiredFile,
          line: 1,
          severity: "fatal",
          message: "Open capability required package or audit file is missing.",
        }));
      }
    }

    const contractSource = getOpenSourceOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getOpenSourceOrThrow(project, ABILITY_GROUP_PATH);
    const schemaSource = getOpenSourceOrThrow(project, SCHEMA_PATH);
    const registrySource = getOpenSourceOrThrow(project, REGISTRY_PATH);
    const indexSource = getOpenSourceOrThrow(project, INDEX_PATH);
    const inputGateSource = getOpenSourceOrThrow(project, INPUT_GATE_PATH);
    const targetPolicySource = getOpenSourceOrThrow(project, TARGET_POLICY_GATE_PATH);
    const urlSafetySource = getOpenSourceOrThrow(project, URL_SAFETY_GATE_PATH);
    const sessionGateSource = getOpenSourceOrThrow(project, SESSION_GATE_PATH);
    const navigationRunnerSource = getOpenSourceOrThrow(project, NAVIGATION_RUNNER_PATH);
    const postOpenStateSource = getOpenSourceOrThrow(project, POST_OPEN_STATE_GATE_PATH);
    const resultBuilderSource = getOpenSourceOrThrow(project, RESULT_BUILDER_PATH);
    const proofBuilderSource = getOpenSourceOrThrow(project, PROOF_BUILDER_PATH);
    const dispatchFailureSource = getOpenSourceOrThrow(project, DISPATCH_FAILURE_PATH);
    const workbenchSource = getOpenSourceOrThrow(project, WORKBENCH_PATH);
    const openSources = getOpenSources(project);

    const childIds = getZodEnumValues(schemaSource, "OpenChildCapabilityIdSchema");
    if (childIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: "Open schema child ids must match the governed child catalog exactly.",
      }));
    }

    for (const schemaName of REQUIRED_SCHEMA_DECLARATIONS) {
      if (!schemaSource.getVariableDeclaration(schemaName)) {
        findings.push(createFinding({
          lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
          file: SCHEMA_PATH,
          line: 1,
          severity: "fatal",
          message: `Open schema must define ${schemaName}.`,
        }));
      }
    }

    if (!hasLiteralTextFragment(schemaSource, "failed or review_required result must not expose executable output")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: "Open result schema must reject executable output on failed or review_required results.",
      }));
    }

    if (!hasLiteralTextFragment(schemaSource, "startedMonotonicMs must not be after endedMonotonicMs")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: "Open runtime proof must validate monotonic clock ordering.",
      }));
    }

    const openAbilityGroupInterface = contractSource.getInterface("OpenAbilityGroup");
    const abilityGroupMethods = openAbilityGroupInterface?.getMethods().map((method) => method.getName()) ?? [];
    if (!openAbilityGroupInterface || abilityGroupMethods.join(",") !== "listChildCapabilityIds,execute") {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1",
        file: CONTRACT_PATH,
        line: 1,
        severity: "fatal",
        message: "Open public contract must expose only listChildCapabilityIds and execute.",
      }));
    }

    if (hasTypeReference(contractSource, "BrowserController")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1",
        file: CONTRACT_PATH,
        line: 1,
        severity: "fatal",
        message: "Open public contract must not expose BrowserController.",
      }));
    }

    if (!hasCallExpression(abilityGroupSource, "parseOpenAbilityInput")
      || !hasCallExpression(abilityGroupSource, "extractOpenFailureTrace")
      || !hasCallExpression(abilityGroupSource, "createOpenRegistry")
      || !hasCallExpressionPath(abilityGroupSource, ["entry", "implementation", "execute"])) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-003-V1",
        file: ABILITY_GROUP_PATH,
        line: 1,
        severity: "fatal",
        message: "Open ability-group must parse input, build trace-only failure envelope, resolve metadata registry, and dispatch only through child execute.",
      }));
    }

    const requiredExecutorCalls = [
      "evaluateOpenTargetPolicy",
      "evaluateUrlSafety",
      "evaluateRealChromeSession",
      "runOpenNavigation",
      "evaluatePostOpenState",
      "buildOpenResult",
    ];
    for (const callName of requiredExecutorCalls) {
      if (!hasCallExpression(getOpenSourceOrThrow(project, EXECUTOR_PATH), callName)) {
        findings.push(createFinding({
          lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
          file: EXECUTOR_PATH,
          line: 1,
          severity: "fatal",
          message: `Open executor must route through ${callName}.`,
        }));
      }
    }

    if (hasLiteralTextFragment(abilityGroupSource, "127.0.0.1/unknown-child") || hasLiteralTextFragment(abilityGroupSource, "127.0.0.1/child-execution-failed")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: ABILITY_GROUP_PATH,
        line: 1,
        severity: "fatal",
        message: "Open ability-group must not fabricate fallback targetUrl values on failure paths.",
      }));
    }

    if (!hasCallExpression(targetPolicySource, "includes") || !hasLiteralTextFragment(targetPolicySource, "caller allowlist")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: TARGET_POLICY_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "Target policy gate must enforce caller policy before allowing target resolution.",
      }));
    }

    if (hasLiteralTextFragment(urlSafetySource, "127.0.0.1/invalid")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: URL_SAFETY_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "URL safety gate must not fabricate fallback invalid URLs.",
      }));
    }

    if (!hasLiteralTextFragment(sessionGateSource, "profile_ready") || !hasLiteralTextFragment(sessionGateSource, "logged_in")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: SESSION_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "Real Chrome session gate must allowlist ready profile states.",
      }));
    }

    if (!hasCallExpression(navigationRunnerSource, "safeReadSessionSnapshot") || !hasLiteralTextFragment(navigationRunnerSource, "session_snapshot_failed")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: NAVIGATION_RUNNER_PATH,
        line: 1,
        severity: "fatal",
        message: "Navigation runner must govern browser.open and getSessionSnapshot failures without throwing through the child boundary.",
      }));
    }

    if (!hasLiteralTextFragment(postOpenStateSource, "captcha_wall") || !hasLiteralTextFragment(postOpenStateSource, "permission_wall")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: POST_OPEN_STATE_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "Post-open state gate must classify captcha and permission walls explicitly.",
      }));
    }

    if (!hasStatusClassificationObject(postOpenStateSource, "review_required", "login_wall")
      || !hasStatusClassificationObject(postOpenStateSource, "failed", "wrong_domain")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: POST_OPEN_STATE_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "Post-open state gate must keep explicit login_wall and wrong_domain branches out of success.",
      }));
    }

    if (!hasStrictSuccessStatusCheck(resultBuilderSource)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: RESULT_BUILDER_PATH,
        line: 1,
        severity: "fatal",
        message: "Open result builder must only emit executable output on success.",
      }));
    }

    if (!hasCallExpression(resultBuilderSource, "buildOpenProof")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: RESULT_BUILDER_PATH,
        line: 1,
        severity: "fatal",
        message: "Open result builder must always route through buildOpenProof.",
      }));
    }

    if (!hasReturnedObjectProperty(proofBuilderSource, "targetUrlSource") || !hasReturnedObjectProperty(proofBuilderSource, "failureInputParseDecision")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: PROOF_BUILDER_PATH,
        line: 1,
        severity: "fatal",
        message: "Open proof builder must record trace-field provenance and parse decision data.",
      }));
    }

    if (hasDispatchFailureFabrication(dispatchFailureSource)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: DISPATCH_FAILURE_PATH,
        line: 1,
        severity: "fatal",
        message: "Dispatch failure envelope must not fabricate allow decisions or fake target profiles.",
      }));
    }

    if (hasLiteralTextFragment(inputGateSource, "coerceOpenInputSeed") || !hasCallExpression(inputGateSource, "readOptionalString")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: INPUT_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "Open input gate must use one trace-only raw failure parser and must not coerce fake business requests.",
      }));
    }

    const registryEntries = getRegistryEntries(registrySource);
    if (registryEntries.length !== CHILDREN.length) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
        file: REGISTRY_PATH,
        line: 1,
        severity: "fatal",
        message: "Open registry must contain one metadata entry for each governed child.",
      }));
    }

    for (const entry of registryEntries) {
      const propertyNames = getObjectPropertyNames(entry);
      const missingFields = REGISTRY_REQUIRED_FIELDS.filter((field) => !propertyNames.has(field));
      if (missingFields.length > 0) {
        findings.push(createFinding({
          lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
          file: REGISTRY_PATH,
          line: getNodeLine(entry),
          severity: "fatal",
          message: "Open metadata registry entry is missing required fields.",
          detail: missingFields.join(", "),
        }));
      }
    }

    for (const childId of CHILDREN) {
      const implementationPath = `${OPEN_ROOT}/children/${childId}/implementation.ts`;
      const contractPath = `${OPEN_ROOT}/children/${childId}/contract.ts`;
      const schemaPath = `${OPEN_ROOT}/children/${childId}/schema.ts`;
      const implementationSource = getOpenSourceOrThrow(project, implementationPath);
      const childContractSource = getOpenSourceOrThrow(project, contractPath);
      const childSchemaSource = getOpenSourceOrThrow(project, schemaPath);

      if (!hasPropertyNamed(implementationSource, "inputSchema")
        || !hasPropertyNamed(implementationSource, "outputSchema")
        || !hasMethodNamed(implementationSource, "execute")
        || !hasCallExpression(implementationSource, "executeOpenChild")) {
        findings.push(createFinding({
          lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
          file: implementationPath,
          line: 1,
          severity: "fatal",
          message: "Open child implementation must export inputSchema, outputSchema, and execute backed by executeOpenChild.",
        }));
      }

      const expectedContractFragments = ["BOUNDARY_POLICY", "PROOF_POLICY", "OUTPUT_POLICY", "FAILURE_POLICY", "PURPOSE", "ALLOWED_HOSTNAMES", "ALLOWED_SCHEMES"];
      for (const fragment of expectedContractFragments) {
        if (!childContractSource.getVariableDeclarations().some((declaration) => declaration.getName().includes(fragment))) {
          findings.push(createFinding({
            lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
            file: contractPath,
            line: 1,
            severity: "fatal",
            message: `Open child contract must define child-local ${fragment.toLowerCase()}.`,
          }));
        }
      }

      const expectedSchemaFragments = ["BoundaryPolicySchema", "ProofPolicySchema", "OutputPolicySchema", "FailurePolicySchema", "TargetProfileSchema"];
      for (const fragment of expectedSchemaFragments) {
        if (!childSchemaSource.getVariableDeclarations().some((declaration) => declaration.getName().includes(fragment))) {
          findings.push(createFinding({
            lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
            file: schemaPath,
            line: 1,
            severity: "fatal",
            message: `Open child schema must define child-local ${fragment}.`,
          }));
        }
      }
    }

    const childFactoryNames = [
      ["createOpenTikTokCapability", `${OPEN_ROOT}/children/open-tiktok/implementation.ts`],
      ["createOpenFacebookCapability", `${OPEN_ROOT}/children/open-facebook/implementation.ts`],
      ["createOpenLocalWorkbenchCapability", `${OPEN_ROOT}/children/open-local-workbench/implementation.ts`],
    ] as const;

    for (const [factoryName, implementationPath] of childFactoryNames) {
      const implementationSource = getOpenSourceOrThrow(project, implementationPath);
      const identifier = getFunctionIdentifier(implementationSource, factoryName);
      if (!identifier) {
        findings.push(createFinding({
          lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
          file: implementationPath,
          line: 1,
          severity: "fatal",
          message: `Open child implementation must export ${factoryName}.`,
        }));
        continue;
      }

      const referencePaths = getReferencePaths(identifier);
      const allowedReferencePaths = [implementationPath, REGISTRY_PATH];
      const escapedReference = referencePaths.find((path) => !allowedReferencePaths.includes(path));
      if (escapedReference) {
        findings.push(createFinding({
          lawId: "GRASSEYE-CAPABILITY-GROUP-003-V1",
          file: escapedReference,
          line: 1,
          severity: "fatal",
          message: "Open child implementation factory leaked outside registry-owned wiring.",
          detail: `${factoryName} -> ${referencePaths.join(", ")}`,
        }));
      }
    }

    const forbiddenImportFile = openSources.find((sourceFile) => {
      return FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)) || hasForbiddenResolvedImport(sourceFile);
    });
    if (forbiddenImportFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: toRepoRelativePath(forbiddenImportFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Open root must not import AI, Screenshot, Mouse, Scroll, Geometry, or Forensics implementations.",
      }));
    }

    const privateLeakFile = project.getSourceFiles().find((sourceFile) => {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath.startsWith(`${OPEN_ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
        return false;
      }
      return sourceFile.getImportDeclarations().some((declaration) => {
        const target = resolveModuleSourcePath(declaration);
        return target !== null && FORBIDDEN_EXTERNAL_IMPORTS.some((marker) => target.includes(marker));
      });
    });
    if (privateLeakFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-CAPABILITY-GROUP-003-V1",
        file: toRepoRelativePath(privateLeakFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "External modules must not import Open children, runtime internals, or mutable registry paths.",
      }));
    }

    if (!workbenchSource.getImportDeclarations().some((declaration) => resolveModuleSourcePath(declaration) === `${OPEN_ROOT}/index.ts`)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-003-V1",
        file: WORKBENCH_PATH,
        line: 1,
        severity: "fatal",
        message: "Workbench must compose Open through the public index only.",
      }));
    }

    if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
        file: INDEX_PATH,
        line: 1,
        severity: "fatal",
        message: "Open public index must not use export-star barrels.",
      }));
    }

    if (indexSource.getExportDeclarations().some((declaration) => declaration.getNamedExports().some((specifier) => specifier.getName() === "listOpenChildren"))) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-003-V1",
        file: INDEX_PATH,
        line: 1,
        severity: "fatal",
        message: "Open public index must not leak child-registry listing helpers.",
      }));
    }

    const antiEscapeFile = openSources.find((sourceFile) => {
      return hasAnyKeyword(sourceFile)
        || hasUnknownAsChain(sourceFile)
        || hasCommentDirective(sourceFile)
        || hasDynamicImport(sourceFile)
        || hasRequireCall(sourceFile);
    });
    if (antiEscapeFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-004-V1",
        file: toRepoRelativePath(antiEscapeFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Open root must not use any, unknown-as chains, comment directives, dynamic import, or require.",
      }));
    }

    const dateViolationFile = openSources.find((sourceFile) => hasDateUsageOutsideClock(sourceFile));
    if (dateViolationFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: toRepoRelativePath(dateViolationFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Open runtime must use the governed clock port instead of scattered Date constructors or Date.now.",
      }));
    }

    const cookieReadFile = openSources.find((sourceFile) => hasCookieRead(sourceFile));
    if (cookieReadFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1",
        file: toRepoRelativePath(cookieReadFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Open root must not read cookies or storage state directly.",
      }));
    }

    const repoOpenTsFiles = await listFilesRecursive(pathFromRepoRoot(OPEN_ROOT), { extensions: [".ts"] });
    const openRootBound = repoOpenTsFiles.length > 0;
    const platformBoundary = await inspectPlatformActionBoundary();
    const browserBoundary = await inspectLocalBrowserSessionBoundary();

    const requiredPassed = !findings.some((finding) => finding.message.includes("required") || finding.message.includes("must define"));
    const forbiddenPassed = !findings.some((finding) => finding.message.includes("must not") || finding.message.includes("forbidden"));
    const boundaryPassed = !findings.some((finding) => finding.lawId === "GRASSEYE-CAPABILITY-GROUP-003-V1");
    const antiEscapePassed = !findings.some((finding) => finding.message.includes("any") || finding.message.includes("dynamic import") || finding.message.includes("Date constructors"));

    return {
      findings: [...findings, ...platformBoundary.findings, ...browserBoundary.findings],
      phases: [
        createPhase("open-required-shape-attack", requiredPassed && openRootBound ? "PASS" : "CODE VIOLATION", requiredPassed && openRootBound, requiredPassed && openRootBound ? "Open standard package shape, metadata registry, child-local contracts, and negative proof harness are present." : "Open required shape is incomplete."),
        createPhase("open-forbidden-shape-attack", forbiddenPassed ? "PASS" : "CODE VIOLATION", forbiddenPassed, forbiddenPassed ? "Open forbids fake allow decisions, fake target profiles, export-star barrels, forbidden imports, and cookie access." : "Open still contains forbidden execution or export shapes."),
        createPhase("open-boundary-attack", boundaryPassed ? "PASS" : "CODE VIOLATION", boundaryPassed, boundaryPassed ? "Open child implementations stay private and workbench wiring stays on the public surface." : "Open boundary leaks private children or runtime internals."),
        createPhase("open-anti-escape-attack", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Open avoids any, unknown-as, comment directives, dynamic import, require, and unmanaged time APIs." : "Open still contains anti-escape violations."),
        ...platformBoundary.phases,
        ...browserBoundary.phases,
      ],
    };
  },
});
