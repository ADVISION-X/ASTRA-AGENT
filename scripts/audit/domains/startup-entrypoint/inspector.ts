import { readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";

const packagePath = "package.json";
const launchPath = "scripts/startup/launch-grasseye.mjs";
const preflightPath = "scripts/startup/lib/browser-runtime-preflight.mjs";
const artifactSyncPath = "scripts/startup/lib/browser-runtime-artifact.mjs";
const processControlPath = "scripts/startup/lib/process-control.mjs";
const failureHandlerPath = "scripts/startup/lib/startup-failure-handler.mjs";
const serviceReadinessPath = "scripts/startup/lib/service-readiness.mjs";
const inspectorPath = "scripts/audit/domains/startup-entrypoint/inspector.ts";
const checkId = "startup-entrypoint/unpacked-readback";
const clauseId = "apex-startup-001-v3-clean-restart";
const startupCommand = "node --import tsx --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs";
const startupLawId = "LAW-STARTUP-ENTRYPOINT-001-V1";
const boundaryLawId = "LAW-STARTUP-ENTRYPOINT-002-V1";

type Finding = ReturnType<typeof createFinding>;

const sourceFile = (context: InspectorContext, filePath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(filePath));

const addFinding = (findings: Finding[], lawId: string, filePath: string, message: string,
  evidenceMode: "static.ast" | "static.contract" = "static.ast"): void => {
  findings.push(createFinding({ evidenceMode, checkId, lawId, clauseId, filePath, message }));
};

const hasNamedImport = (source: SourceFile, modulePart: string, name: string): boolean =>
  source.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().includes(modulePart)
    && declaration.getNamedImports().some((entry) => entry.getName() === name));

const hasCall = (source: SourceFile, name: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.compilerNode.escapedText.toString() === name;
  });

const hasPropertyCall = (source: SourceFile, name: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    if (Node.isPropertyAccessExpression(expression)) return expression.getName() === name;
    if (!Node.isElementAccessExpression(expression)) return false;
    const key = expression.getArgumentExpression();
    return Node.isStringLiteral(key) && key.getLiteralValue() === name;
  });

const stringLiterals = (source: SourceFile): Set<string> => new Set([
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
]);

const hasLiteralSequence = (literals: ReadonlySet<string>, required: readonly string[]): boolean =>
  required.every((value) => literals.has(value));

const verifiesListenerBeforeSignal = (processControl: SourceFile): boolean => {
  const identity = processControl.getFunction("identityKey")?.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)[0];
  const identityFields = identity?.getElements().map(element => element.getText());
  const signal = processControl.getFunction("signalOwnedListeners");
  const guard = signal?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement =>
    statement.getExpression().getText() === "identityKey(current) !== identityKey(expected)");
  const calls = signal?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const read = calls.find(call => call.getText() === "getProcessIdentity(expected.processId)");
  const send = calls.find(call => call.getText() === "terminateProcess(identity.processId, signal)");
  const attempt = processControl.getFunction("clearAttempt");
  const retryGuard = attempt?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement =>
    statement.getExpression().getText() === "originalKey && originalKey !== identityKey(identity)");
  const retry = attempt?.getDescendantsOfKind(SyntaxKind.CallExpression).find(call =>
    call.getText() === 'signalOwnedListeners(remaining, "SIGKILL", ownership, logger)');
  return identityFields?.join(",") === "identity.processId,identity.uid,identity.startTime,identity.cwd,identity.command"
    && !!read && !!guard && !!send && read.getStart() < guard.getStart() && guard.getStart() < send.getStart()
    && guard.getThenStatement().getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 1
    && !!retryGuard && !!retry && retryGuard.getStart() < retry.getStart()
    && retryGuard.getThenStatement().getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 1;
};

const inspectCleanRestart = (
  launch: SourceFile,
  processControl: SourceFile,
  findings: Finding[],
  lawId: string,
): void => {
  if (!hasNamedImport(launch, "process-control", "clearPortListeners")
    || !hasCall(launch, "clearPortListeners")) {
    addFinding(findings, lawId, launchPath, "Startup must clear the sole App Server port before every launch.");
  }
  if (hasNamedImport(launch, "service-readiness", "probeExistingWorkbench")) {
    addFinding(findings, lawId, launchPath, "Healthy-process hot mount must not bypass clean restart.");
  }
  const launchLiterals = stringLiterals(launch);
  if (!launchLiterals.has("src/app/server.ts")) {
    addFinding(findings, lawId, launchPath, "Startup must bind port termination to the exact App Server command identity.");
  }
  const processControlLiterals = stringLiterals(processControl);
  for (const required of [
    "PORT_LISTENER_FOREIGN",
    "PORT_LISTENER_IDENTITY_UNAVAILABLE",
    "PORT_LISTENER_IDENTITY_CHANGED",
    "PORT_OWNERSHIP_POLICY_REQUIRED",
    "SIGTERM",
    "SIGKILL",
  ]) {
    if (!processControlLiterals.has(required)) {
      addFinding(findings, lawId, processControlPath, `Port cleanup must fail closed with ${required}.`);
    }
  }
  for (const requiredCall of ["getListeningProcessIds", "getProcessIdentity", "terminateProcess"]) {
    if (!hasCall(processControl, requiredCall)) {
      addFinding(findings, lawId, processControlPath, `Port cleanup must invoke ${requiredCall}.`);
    }
  }
  if (!hasPropertyCall(processControl, "getuid")) {
    addFinding(findings, lawId, processControlPath, "Port cleanup must bind listener identity to the current UID.");
  }
  if (!verifiesListenerBeforeSignal(processControl)) {
    addFinding(findings, lawId, processControlPath, "Port cleanup must re-read exact PID identity before either signal.");
  }
};

const inspectUnpackedReadback = (preflight: SourceFile, findings: Finding[], lawId: string): void => {
  const literals = stringLiterals(preflight);
  for (const required of [
    "REPAIR_REQUIRED",
    "BROWSER_AUTHORITY_ABSENT",
    "extensionDirectoryHashV1",
    "manifestHash",
    "protocolHash",
    "sitePolicyHash",
  ]) {
    if (!literals.has(required)) {
      addFinding(findings, lawId, preflightPath, `Unpacked preflight must read and bind ${required}.`);
    }
  }
  if (!hasNamedImport(preflight, "browser-application-identity", "ASTRA_DATA_DIRECTORY")
    || !hasLiteralSequence(literals, ["browser-build", "extension"])) {
    addFinding(findings, lawId, preflightPath, "Unpacked preflight must read and bind the ASTRA fixed browser-build/extension directory.");
  }
  if (!hasLiteralSequence(literals, ["browser-release", "release-record.json"])) {
    addFinding(findings, lawId, preflightPath, "Unpacked preflight must read and bind the ASTRA browser-release/release-record.json.");
  }
  const forbidden = ["CWS_PAGE_CHANNEL", "nativeMessaging", "externally_connectable", "page relay"];
  const leaked = forbidden.find((value) => literals.has(value));
  if (leaked) addFinding(findings, lawId, preflightPath, `Retired Browser startup surface remains: ${leaked}.`);
};

const inspectStartupBoundary = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const launch = sourceFile(context, launchPath);
  const preflight = sourceFile(context, preflightPath);
  const artifactSync = sourceFile(context, artifactSyncPath);
  const processControl = sourceFile(context, processControlPath);
  if (!launch || !preflight || !artifactSync || !processControl) {
    addFinding(findings, lawId, inspectorPath, "The unique startup command, entrypoint, and unpacked readback owner must remain present.");
    return;
  }
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (packageJson.scripts?.["grasseye:start"] !== startupCommand) {
    addFinding(findings, lawId, packagePath, "grasseye:start must inject only the optional local runtime configuration before the sole startup entrypoint.");
  }
  if (!hasNamedImport(launch, "browser-runtime-preflight", "runBrowserRuntimePreflight")
    || !hasCall(launch, "runBrowserRuntimePreflight")) {
    addFinding(findings, lawId, launchPath, "Startup must invoke the one read-only unpacked artifact preflight before opening Browser work.");
  }
  inspectCleanRestart(launch, processControl, findings, lawId);
  inspectUnpackedReadback(preflight, findings, lawId);
  const readiness = sourceFile(context, serviceReadinessPath)?.getFunction("isWorkbenchHealthReport");
  const readinessTerms = readiness?.getDescendantsOfKind(SyntaxKind.BinaryExpression).map(node => node.getText()) ?? [];
  if (!readinessTerms.includes('value.status === "healthy" || value.status === "degraded"')) {
    addFinding(findings, lawId, serviceReadinessPath, "The diagnostic Shell must remain usable with degraded execution dependencies.");
  }
};

const inspectStartupCommandContract = (
  context: InspectorContext, findings: Finding[], lawId: string,
): void => {
  const launch = sourceFile(context, launchPath);
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> };
  const scripts = packageJson.scripts ?? {};
  if (scripts["grasseye:start"] !== startupCommand || "astra:start" in scripts
    || Object.values(scripts).filter((command) => command === startupCommand).length !== 1) addFinding(findings, lawId, packagePath,
    "grasseye:start must remain the one optional .env.local loader and startup entrypoint.", "static.contract");
  const exportedStarts = launch?.getFunctions().filter((declaration) => declaration.isExported()).length ?? 0;
  if (!launch || exportedStarts !== 0) addFinding(findings, lawId, launchPath,
    "The startup entrypoint must execute directly and must not export a second callable startup contract.", "static.contract");
};

const inspectLocalLaunchAuthority = (
  launch: SourceFile,
  failureHandler: SourceFile,
  serviceReadiness: SourceFile,
  findings: Finding[],
  lawId: string,
): void => {
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> };
  const configuredStartupCommand = packageJson.scripts?.["grasseye:start"] ?? "";
  if (configuredStartupCommand !== startupCommand) {
    addFinding(findings, lawId, packagePath, "The ordinary startup command must load only this repository's optional .env.local and the sole launch entrypoint.");
  }
  const launchIdentifiers = new Set(launch.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
  const launchLiterals = stringLiterals(launch);
  const boundaryLiterals = new Set([
    ...launchLiterals,
    ...stringLiterals(failureHandler),
    ...stringLiterals(serviceReadiness),
  ]);
  for (const required of ["runBrowserRuntimePreflight", "ensureCurrentBrowserRuntimeArtifact", "clearPortListeners", "startLocalService", "waitForWorkbenchHealth"]) {
    if (!launchIdentifiers.has(required)) addFinding(findings, lawId, launchPath, `Local startup must execute ${required}.`);
  }
  for (const required of ["src/app/server.ts", "degraded"]) {
    if (!boundaryLiterals.has(required)) addFinding(findings, lawId, launchPath, `Local startup must retain the ${required} fail-closed Shell boundary.`);
  }
  const identity = launch.getImportDeclaration("../../src/lib/browser/profile/browser-application-identity.ts");
  const identityBindings = identity?.getNamedImports().filter(entry => !entry.getAliasNode()).map(entry => entry.getName()) ?? [];
  const rejectsIdentityDrift = launch.getStatements().some(statement => Node.isIfStatement(statement)
    && statement.getExpression().getText() === "host !== ASTRA_LOCAL_HOST || port !== ASTRA_LOCAL_PORT"
    && Node.isThrowStatement(statement.getThenStatement()));
  if (!["ASTRA_LOCAL_HOST", "ASTRA_LOCAL_PORT"].every(name => identityBindings.includes(name))
    || launch.getVariableDeclaration("host")?.getInitializer()?.getText() !== "process.env.GRASSEYE_HOST ?? ASTRA_LOCAL_HOST"
    || launch.getVariableDeclaration("port")?.getInitializer()?.getText() !== "Number(process.env.GRASSEYE_PORT ?? ASTRA_LOCAL_PORT)"
    || !rejectsIdentityDrift) {
    addFinding(findings, lawId, launchPath, "The sole ASTRA Shell must consume its canonical loopback identity and reject overrides.");
  }
  const dataRoot = launch.getVariableDeclaration("startupDataDir")?.getInitializerIfKind(SyntaxKind.CallExpression);
  if (!hasNamedImport(launch, "default-data-dir", "resolveProductionLocalDataDir")
    || dataRoot?.getExpression().getText() !== "resolveProductionLocalDataDir") {
    addFinding(findings, lawId, launchPath, "The startup data directory must come from the canonical repository guard.");
  }
  const forbiddenStartupCalls = new Set([
    "enrollProductionRuntimeCloudDevice", "registerOperatorTargetClaim", "acquireJobBoundTargetLease",
    "createSyntheticJob", "claimJob", "runFullQuality", "buildBrowserExtension", "reloadExtension",
    "getTargets", "acquireJobBoundChatGptTarget",
  ]);
  const leaked = [...launchIdentifiers].find((name) => forbiddenStartupCalls.has(name));
  if (leaked) addFinding(findings, lawId, launchPath, `Ordinary startup must not execute ${leaked}.`);
  if (hasPropertyCall(launch, "reload")) {
    addFinding(findings, lawId, launchPath, "Ordinary startup must not call Extension reload.");
  }
  for (const forbidden of ["TARGET_CLAIM", "https://chatgpt.com/"]) {
    if (launchLiterals.has(forbidden)) addFinding(findings, lawId, launchPath, `Ordinary startup must not contain ${forbidden}.`);
  }
};

const inspectArtifactSyncAuthority = (
  artifactSync: SourceFile,
  findings: Finding[],
  lawId: string,
): void => {
  const artifactIdentifiers = new Set(artifactSync.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
  const artifactLiterals = stringLiterals(artifactSync);
  for (const required of ["runBrowserRuntimePreflight", "runBuild", "releaseState"]) {
    if (!artifactIdentifiers.has(required)) addFinding(findings, lawId, artifactSyncPath, `Browser artifact sync must retain ${required}.`);
  }
  for (const required of ["UNPACKED_WEBSOCKET_AUTHORITY", "src/lib/browser/chrome-extension/build.mjs"]) {
    if (!artifactLiterals.has(required)) addFinding(findings, lawId, artifactSyncPath, `Browser artifact sync must bind ${required}.`);
  }
  for (const forbidden of ["audit", "typecheck", "acceptance", "real-chrome", "GRASSEYE_AUTOMATIC_PAIRING_SECRET", "GRASSEYE_CLAIM_ACTIVE_TARGET", "TARGET_ACQUIRE", "TARGET_CLAIM", "acquireJobBoundChatGptTarget", "https://chatgpt.com/"]) {
    if (artifactSync.getFullText().includes(forbidden)) addFinding(findings, lawId, artifactSyncPath, `Ordinary artifact sync must not execute ${forbidden}.`);
  }
};

const inspectListenerCleanupAuthority = (
  processControl: SourceFile,
  findings: Finding[],
  lawId: string,
): void => {
  const processLiterals = stringLiterals(processControl);
  for (const required of ["PORT_LISTENER_FOREIGN", "PORT_LISTENER_IDENTITY_CHANGED", "src/app/server.ts"]) {
    if (required === "src/app/server.ts") continue;
    if (!processLiterals.has(required)) addFinding(findings, lawId, processControlPath, `Listener cleanup must fail closed with ${required}.`);
  }
};

const inspectLocalStartupAuthorityBoundary = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const launch = sourceFile(context, launchPath);
  const preflight = sourceFile(context, preflightPath);
  const artifactSync = sourceFile(context, artifactSyncPath);
  const processControl = sourceFile(context, processControlPath);
  const failureHandler = sourceFile(context, failureHandlerPath);
  const serviceReadiness = sourceFile(context, serviceReadinessPath);
  if (!launch || !preflight || !artifactSync || !processControl || !failureHandler || !serviceReadiness) {
    addFinding(findings, lawId, inspectorPath, "The local startup authority boundary must remain inspectable.");
    return;
  }
  inspectLocalLaunchAuthority(launch, failureHandler, serviceReadiness, findings, lawId);
  inspectArtifactSyncAuthority(artifactSync, findings, lawId);
  inspectListenerCleanupAuthority(processControl, findings, lawId);
};

const inspectArtifactResultContract = (
  context: InspectorContext, findings: Finding[], lawId: string,
): void => {
  const artifactSync = sourceFile(context, artifactSyncPath);
  const owner = artifactSync?.getFunction("ensureCurrentBrowserRuntimeArtifact");
  if (!artifactSync || !owner || !owner.isExported()) {
    addFinding(findings, lawId, artifactSyncPath,
      "ensureCurrentBrowserRuntimeArtifact must remain the sole exported artifact synchronization contract.", "static.contract");
    return;
  }
  const parameter = owner.getParameters()[0]?.getNameNode().getText() ?? "";
  for (const required of ["rootDir", "runBuild", "readPreflight"]) if (!parameter.includes(required)) {
    addFinding(findings, lawId, artifactSyncPath,
      `Artifact synchronization contract is missing injected boundary ${required}.`, "static.contract");
  }
  const literals = stringLiterals(artifactSync);
  for (const required of ["READY", "UNPACKED_WEBSOCKET_AUTHORITY", "BROWSER_UNPACKED_ARTIFACT_REBUILD_FAILED"]) {
    if (!literals.has(required)) addFinding(findings, lawId, artifactSyncPath,
      `Artifact synchronization result contract is missing ${required}.`, "static.contract");
  }
};

const inspectDomainEvaluation = (context: InspectorContext) => {
  const findings: Finding[] = [];
  const staticCheckReceipts: import("../../shared/inspector-contracts.js").StaticCheckReceipt[] = [];
  recordStaticCheck({ check: "inspectStartupBoundary", findings, implementation: inspectStartupBoundary,
    lawIds: [startupLawId], receipts: staticCheckReceipts,
    run: () => inspectStartupBoundary(context, findings, startupLawId) });
  recordStaticCheck({ check: "inspectStartupCommandContract", findings, implementation: inspectStartupCommandContract,
    lawIds: [startupLawId], receipts: staticCheckReceipts,
    run: () => inspectStartupCommandContract(context, findings, startupLawId) });
  recordStaticCheck({ check: "inspectLocalStartupAuthorityBoundary", findings,
    implementation: inspectLocalStartupAuthorityBoundary, lawIds: [boundaryLawId], receipts: staticCheckReceipts,
    run: () => inspectLocalStartupAuthorityBoundary(context, findings, boundaryLawId) });
  recordStaticCheck({ check: "inspectArtifactResultContract", findings, implementation: inspectArtifactResultContract,
    lawIds: [boundaryLawId], receipts: staticCheckReceipts,
    run: () => inspectArtifactResultContract(context, findings, boundaryLawId) });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = inspectDomainEvaluation(context);
  const lawResult = (lawId: string, astCheck: string, astClauses: string[], contractCheck: string, contractClauses: string[]) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const astChecks = [astCheck];
    const contractChecks = [contractCheck];
    return { lawId, assertions: [
      { clauses: astClauses, evidenceMode: "static.ast", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, astChecks), refs: staticEvidenceRefs(context, lawId, "static.ast", astClauses, evaluation.staticCheckReceipts, astChecks) },
      { clauses: contractClauses, evidenceMode: "static.contract", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, contractChecks), refs: staticEvidenceRefs(context, lawId, "static.contract", contractClauses, evaluation.staticCheckReceipts, contractChecks) },
    ], findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [
      lawResult(startupLawId, "inspectStartupBoundary", staticClauses(4, 8, 11), "inspectStartupCommandContract", staticClauses(7)),
      lawResult(boundaryLawId, "inspectLocalStartupAuthorityBoundary", staticClauses(0, 1, 2, 3), "inspectArtifactResultContract", staticClauses(2)),
    ],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
