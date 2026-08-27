import { readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { observeStaticAst, observeStaticContract } from "../../shared/static-target-object-inspector.js";

const packagePath = "package.json";
const launchPath = "scripts/startup/launch-grasseye.mjs";
const preflightPath = "scripts/startup/lib/browser-runtime-preflight.mjs";
const artifactSyncPath = "scripts/startup/lib/browser-runtime-artifact.mjs";
const processControlPath = "scripts/startup/lib/process-control.mjs";
const inspectorPath = "scripts/audit/domains/startup-entrypoint/inspector.ts";
const checkId = "startup-entrypoint/unpacked-readback";
const clauseId = "apex-startup-001-v3-clean-restart";

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
    return Node.isPropertyAccessExpression(expression) && expression.getName() === name;
  });

const stringLiterals = (source: SourceFile): Set<string> => new Set([
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
]);

const hasLiteralSequence = (literals: ReadonlySet<string>, required: readonly string[]): boolean =>
  required.every((value) => literals.has(value));

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
  if (!hasLiteralSequence(literals, [".grasseye-local", "browser-build", "extension"])) {
    addFinding(findings, lawId, preflightPath, "Unpacked preflight must read and bind .grasseye-local/browser-build/extension.");
  }
  if (!hasLiteralSequence(literals, [".grasseye-local", "browser-release", "release-record.json"])) {
    addFinding(findings, lawId, preflightPath, "Unpacked preflight must read and bind .grasseye-local/browser-release/release-record.json.");
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
  if (packageJson.scripts?.["grasseye:start"] !== "node --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs") {
    addFinding(findings, lawId, packagePath, "grasseye:start must inject only the optional local runtime configuration before the sole startup entrypoint.");
  }
  if (!hasNamedImport(launch, "browser-runtime-preflight", "runBrowserRuntimePreflight")
    || !hasCall(launch, "runBrowserRuntimePreflight")) {
    addFinding(findings, lawId, launchPath, "Startup must invoke the one read-only unpacked artifact preflight before opening Browser work.");
  }
  inspectCleanRestart(launch, processControl, findings, lawId);
  inspectUnpackedReadback(preflight, findings, lawId);
};

const inspectStartupCommandContract = (
  context: InspectorContext, findings: Finding[], lawId: string,
): void => {
  const launch = sourceFile(context, launchPath);
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> };
  const expected = "node --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs";
  if (packageJson.scripts?.["grasseye:start"] !== expected) addFinding(findings, lawId, packagePath,
    "grasseye:start must remain the one optional .env.local loader and startup entrypoint.", "static.contract");
  const exportedStarts = launch?.getFunctions().filter((declaration) => declaration.isExported()).length ?? 0;
  if (!launch || exportedStarts !== 0) addFinding(findings, lawId, launchPath,
    "The startup entrypoint must execute directly and must not export a second callable startup contract.", "static.contract");
};

const inspectLocalLaunchAuthority = (
  launch: SourceFile,
  findings: Finding[],
  lawId: string,
): void => {
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> };
  const startupCommand = packageJson.scripts?.["grasseye:start"] ?? "";
  if (startupCommand !== "node --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs") {
    addFinding(findings, lawId, packagePath, "The ordinary startup command must load only this repository's optional .env.local and the sole launch entrypoint.");
  }
  const launchIdentifiers = new Set(launch.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
  const launchLiterals = stringLiterals(launch);
  for (const required of ["runBrowserRuntimePreflight", "ensureCurrentBrowserRuntimeArtifact", "clearPortListeners", "startLocalService", "waitForWorkbenchHealth"]) {
    if (!launchIdentifiers.has(required)) addFinding(findings, lawId, launchPath, `Local startup must execute ${required}.`);
  }
  for (const required of ["127.0.0.1", "src/app/server.ts", "degraded"]) {
    if (!launchLiterals.has(required)) addFinding(findings, lawId, launchPath, `Local startup must retain the ${required} fail-closed Shell boundary.`);
  }
  if (!launch.getDescendantsOfKind(SyntaxKind.NumericLiteral).some((node) => node.getLiteralValue() === 4173)) {
    addFinding(findings, lawId, launchPath, "The sole local Shell must default to port 4173.");
  }
  const forbiddenStartupCalls = new Set([
    "enrollProductionRuntimeCloudDevice", "registerOperatorTargetClaim", "acquireJobBoundTargetLease",
    "createSyntheticJob", "claimJob", "runFullQuality", "buildBrowserExtension", "reloadExtension",
    "getTargets", "acquireJobBoundChatGptTarget",
  ]);
  const leaked = [...launchIdentifiers].find((name) => forbiddenStartupCalls.has(name));
  if (leaked) addFinding(findings, lawId, launchPath, `Ordinary startup must not execute ${leaked}.`);
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
  if (!launch || !preflight || !artifactSync || !processControl) {
    addFinding(findings, lawId, inspectorPath, "The local startup authority boundary must remain inspectable.");
    return;
  }
  inspectLocalLaunchAuthority(launch, findings, lawId);
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
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-STARTUP-ENTRYPOINT-001-V4");
  const boundaryLawId = selectLawId(context.planEntry.lawIds, "LAW-STARTUP-ENTRYPOINT-002-V4");
  const findings: Finding[] = [];
  const staticCheckReceipts: import("../../shared/inspector-contracts.js").StaticCheckReceipt[] = [];
  recordStaticCheck({ check: "inspectStartupBoundary", findings, lawIds: [lawId], receipts: staticCheckReceipts,
    run: () => inspectStartupBoundary(context, findings, lawId) });
  recordStaticCheck({ check: "inspectStartupCommandContract", findings, lawIds: [lawId], receipts: staticCheckReceipts,
    run: () => inspectStartupCommandContract(context, findings, lawId) });
  recordStaticCheck({ check: "inspectLocalStartupAuthorityBoundary", findings, lawIds: [boundaryLawId], receipts: staticCheckReceipts,
    run: () => inspectLocalStartupAuthorityBoundary(context, findings, boundaryLawId) });
  recordStaticCheck({ check: "inspectArtifactResultContract", findings, lawIds: [boundaryLawId], receipts: staticCheckReceipts,
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
  const semanticChecks = (lawId: string, evidenceMode: string): string[] => lawId.endsWith("001-V4")
    ? evidenceMode === "static.ast" ? ["inspectStartupBoundary"] : ["inspectStartupCommandContract"]
    : evidenceMode === "static.ast" ? ["inspectLocalStartupAuthorityBoundary"] : ["inspectArtifactResultContract"];
  const lawResult = (lawId: string, astClauses: string[]) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const astChecks = semanticChecks(lawId, "static.ast");
    const contractChecks = semanticChecks(lawId, "static.contract");
    const contractClauses = lawId.endsWith("001-V4") ? staticClauses(7) : staticClauses(2);
    return { lawId, assertions: [
      { clauses: astClauses, evidenceMode: "static.ast", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, astChecks), refs: staticEvidenceRefs(context, lawId, "static.ast", astClauses, evaluation.staticCheckReceipts, astChecks,
        observeStaticAst({ context, lawId, evidenceMode: "static.ast", clauses: astClauses, checks: astChecks,
          executionPassed: producerModePassed(evaluation.staticCheckReceipts, lawId, astChecks) })) },
      { clauses: contractClauses, evidenceMode: "static.contract", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, contractChecks), refs: staticEvidenceRefs(context, lawId, "static.contract", contractClauses, evaluation.staticCheckReceipts, contractChecks,
        observeStaticContract({ context, lawId, evidenceMode: "static.contract", clauses: contractClauses, checks: contractChecks,
          executionPassed: producerModePassed(evaluation.staticCheckReceipts, lawId, contractChecks) })) },
    ], findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [lawResult("LAW-STARTUP-ENTRYPOINT-001-V4", staticClauses(11)),
      lawResult("LAW-STARTUP-ENTRYPOINT-002-V4", staticClauses(0, 1, 2))], inspectedFiles: evaluation.inspectedFiles,
  });
};
