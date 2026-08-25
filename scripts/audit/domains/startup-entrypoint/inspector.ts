import { readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { finalizeStaticInspection, staticLawCoverage } from "../../shared/static-inspector-result.js";

const packagePath = "package.json";
const launchPath = "scripts/startup/launch-grasseye.mjs";
const preflightPath = "scripts/startup/lib/browser-runtime-preflight.mjs";
const processControlPath = "scripts/startup/lib/process-control.mjs";
const inspectorPath = "scripts/audit/domains/startup-entrypoint/inspector.ts";
const checkId = "startup-entrypoint/unpacked-readback";
const clauseId = "apex-startup-001-v3-clean-restart";

type Finding = ReturnType<typeof createFinding>;

const sourceFile = (context: InspectorContext, filePath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(filePath));

const addFinding = (findings: Finding[], lawId: string, filePath: string, message: string): void => {
  findings.push(createFinding({ checkId, lawId, clauseId, filePath, message }));
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
  const processControl = sourceFile(context, processControlPath);
  if (!launch || !preflight || !processControl) {
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

const inspectLocalStartupAuthorityBoundary = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const launch = sourceFile(context, launchPath);
  const preflight = sourceFile(context, preflightPath);
  const processControl = sourceFile(context, processControlPath);
  if (!launch || !preflight || !processControl) {
    addFinding(findings, lawId, inspectorPath, "The local startup authority boundary must remain inspectable.");
    return;
  }
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> };
  const startupCommand = packageJson.scripts?.["grasseye:start"] ?? "";
  if (startupCommand !== "node --env-file-if-exists=.env.local scripts/startup/launch-grasseye.mjs") {
    addFinding(findings, lawId, packagePath, "The ordinary startup command must load only this repository's optional .env.local and the sole launch entrypoint.");
  }
  const launchIdentifiers = new Set(launch.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
  const launchLiterals = stringLiterals(launch);
  for (const required of ["runBrowserRuntimePreflight", "clearPortListeners", "startLocalService", "waitForWorkbenchHealth"]) {
    if (!launchIdentifiers.has(required)) addFinding(findings, lawId, launchPath, `Local startup must execute ${required}.`);
  }
  for (const required of ["127.0.0.1", "src/app/server.ts", "degraded"]) {
    if (!launchLiterals.has(required)) addFinding(findings, lawId, launchPath, `Local startup must retain the ${required} fail-closed Shell boundary.`);
  }
  if (!launch.getDescendantsOfKind(SyntaxKind.NumericLiteral).some((node) => node.getLiteralValue() === 4173)) {
    addFinding(findings, lawId, launchPath, "The sole local Shell must default to port 4173.");
  }
  const forbiddenStartupCalls = new Set([
    "enrollXuanxueAiProductionCloudDevice", "registerOperatorTargetClaim", "acquireOperatorClaimedTargetLease",
    "createSyntheticJob", "claimJob", "runFullQuality", "buildBrowserExtension", "reloadExtension",
  ]);
  const leaked = [...launchIdentifiers].find((name) => forbiddenStartupCalls.has(name));
  if (leaked) addFinding(findings, lawId, launchPath, `Ordinary startup must not execute ${leaked}.`);
  const processLiterals = stringLiterals(processControl);
  for (const required of ["PORT_LISTENER_FOREIGN", "PORT_LISTENER_IDENTITY_CHANGED", "src/app/server.ts"]) {
    if (required === "src/app/server.ts") continue;
    if (!processLiterals.has(required)) addFinding(findings, lawId, processControlPath, `Listener cleanup must fail closed with ${required}.`);
  }
};

const inspectDomainEvaluation = (context: InspectorContext) => {
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-STARTUP-ENTRYPOINT-001-V4");
  const boundaryLawId = selectLawId(context.planEntry.lawIds, "LAW-STARTUP-ENTRYPOINT-002-V1");
  const findings: Finding[] = [];
  inspectStartupBoundary(context, findings, lawId);
  inspectLocalStartupAuthorityBoundary(context, findings, boundaryLawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    coverage: [
      staticLawCoverage("LAW-STARTUP-ENTRYPOINT-001-V4", 12, ["static.ast", "static.contract"]),
      staticLawCoverage("LAW-STARTUP-ENTRYPOINT-002-V1", 5, ["static.ast", "static.contract"]),
    ],
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, inspectDomainEvaluation);
};
