import { Node, SyntaxKind } from "ts-morph";

import { readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getNodeLine } from "../../core/ts-morph.js";
import { getIdentifierCallWithin } from "../local-app-shell/inspection-utils.js";

const STARTUP_GATE_LAW_ID = "GRASSEYE-STARTUP-ENTRYPOINT-005-V1";
const APP_SERVER_PATH = "src/app/server.ts";
const PACKAGE_JSON_PATH = "package.json";
const PAGE_STATE_DISPATCH_PATH = "src/lib/local-runtime/workbench-page-state-dispatch-input.ts";
const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_PLATFORM_HELPER_IMPORT = "./lib/platform-target.mjs";
const STARTUP_PLATFORM_HELPER_PATH = "scripts/startup/lib/platform-target.mjs";
const WORKBENCH_CONTRACT_PATH = "src/lib/local-runtime/workbench-contract.ts";

type PackageJsonShape = {
  scripts?: Record<string, string>;
};

const createStartupGateFinding = (input: { file: string; message: string; line?: number; detail?: string }): Finding => {
  return createFinding({
    lawId: STARTUP_GATE_LAW_ID,
    file: input.file,
    line: input.line ?? 1,
    severity: "error",
    message: input.message,
    ...(input.detail ? { detail: input.detail } : {}),
  });
};

function getObjectLiteralPropertyInitializer(node: import("ts-morph").Node | undefined, propertyName: string) {
  if (!node || !Node.isObjectLiteralExpression(node)) {
    return undefined;
  }

  const property = node.getProperty(propertyName);
  return property && Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
}

function getStartServiceEnvInitializer(launchSource: import("ts-morph").SourceFile, propertyName: string) {
  const startService = launchSource.getFunction("startService");
  const startLocalServiceCall = startService ? getIdentifierCallWithin(startService, "startLocalService") : undefined;
  const options = startLocalServiceCall?.getArguments()[0];
  return getObjectLiteralPropertyInitializer(getObjectLiteralPropertyInitializer(options, "env"), propertyName);
}

async function collectStartupPackageScriptFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const packageJson = await readJsonFile<PackageJsonShape>(pathFromRepoRoot(PACKAGE_JSON_PATH));
  const internalAppServerScript = packageJson.scripts?.["internal:app-server:dev"];

  if (!internalAppServerScript) {
    findings.push(createStartupGateFinding({ file: PACKAGE_JSON_PATH, message: "package.json must keep internal:app-server:dev as the single local app shell start script." }));
  } else if (internalAppServerScript.includes("GRASSEYE_PLATFORM_TARGET=")) {
    findings.push(createStartupGateFinding({ file: PACKAGE_JSON_PATH, message: "internal:app-server:dev must not hardcode GRASSEYE_PLATFORM_TARGET. Startup must stay shell-neutral." }));
  }

  return findings;
}

function collectStartupLaunchFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  const helperImport = launchSource.getImportDeclaration(STARTUP_PLATFORM_HELPER_IMPORT);
  const parseFlags = launchSource.getFunction("parseFlags");
  const performLaunch = launchSource.getFunction("performLaunch");
  const helperEventNames = launchSource.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue());
  const platformTargetInitializer = getStartServiceEnvInitializer(launchSource, "GRASSEYE_PLATFORM_TARGET");

  if (helperImport) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, line: getNodeLine(helperImport), message: "Startup must not import the deleted platform-target helper. Platform binding belongs to mission start, not bootstrap." }));
  }
  if (parseFlags && getIdentifierCallWithin(parseFlags, "parseStartupFlags")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, line: getNodeLine(parseFlags), message: "Startup parseFlags must stay local to update/no-open parsing and must not delegate to platform selection helpers." }));
  }
  if (performLaunch && getIdentifierCallWithin(performLaunch, "resolveStartupPlatformTarget")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, line: getNodeLine(performLaunch), message: "Startup must not resolve a requested platform before update preflight or service start." }));
  }
  if (performLaunch && getIdentifierCallWithin(performLaunch, "shouldPromptForStartupPlatform")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, line: getNodeLine(performLaunch), message: "Startup must not prompt for Facebook/TikTok selection during bootstrap." }));
  }
  if (helperEventNames.includes("platform_target_selection_required") || helperEventNames.includes("platform_target_resolved")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup structured logs must not carry startup platform selection events." }));
  }
  if (platformTargetInitializer) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, line: getNodeLine(platformTargetInitializer), message: "Startup must not pass GRASSEYE_PLATFORM_TARGET into the app server child process." }));
  }
  if (!getStartServiceEnvInitializer(launchSource, "GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must still pass governed startup readiness JSON into the app server child process." }));
  }

  return findings;
}

function collectDeletedHelperFindings(project: import("ts-morph").Project): Finding[] {
  const helperPath = pathFromRepoRoot(STARTUP_PLATFORM_HELPER_PATH);
  const helperSource = project.getSourceFile(helperPath) ?? project.addSourceFileAtPathIfExists(helperPath);

  return helperSource
    ? [createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must stay deleted. Reintroducing startup platform selection is forbidden." })]
    : [];
}

function collectAppServerFindings(project: import("ts-morph").Project): Finding[] {
  const serverPath = pathFromRepoRoot(APP_SERVER_PATH);
  const serverSource = project.getSourceFile(serverPath) ?? project.addSourceFileAtPathIfExists(serverPath);
  if (!serverSource) {
    return [createStartupGateFinding({ file: APP_SERVER_PATH, message: "App server source must be available for startup shell-neutrality checks." })];
  }

  const findings: Finding[] = [];
  const parsePlatformTargetDeclaration = serverSource.getVariableDeclaration("parsePlatformTarget");
  const shellResolverDeclaration = serverSource.getVariableDeclaration("resolveStartupShellPlatformTarget");
  const shellResolverInitializer = shellResolverDeclaration?.getInitializer();
  const serverText = serverSource.getFullText();

  if (parsePlatformTargetDeclaration) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, line: getNodeLine(parsePlatformTargetDeclaration), message: "App server must not require an explicit Facebook/TikTok startup platform gate." }));
  }
  if (!shellResolverInitializer || !Node.isArrowFunction(shellResolverInitializer)) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, message: "App server must resolve a shell-neutral startup platform through resolveStartupShellPlatformTarget." }));
  } else if (!serverText.includes('"agent-shell"')) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, line: getNodeLine(shellResolverInitializer), message: "App server startup shell resolver must fall back to agent-shell when no explicit platform env is present." }));
  }
  if (serverText.includes("requires explicit GRASSEYE_PLATFORM_TARGET")) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, message: "App server must not fail closed on missing GRASSEYE_PLATFORM_TARGET during startup." }));
  }

  return findings;
}

function collectWorkbenchShellFindings(project: import("ts-morph").Project): Finding[] {
  const contractPath = pathFromRepoRoot(WORKBENCH_CONTRACT_PATH);
  const contractSource = project.getSourceFile(contractPath) ?? project.addSourceFileAtPathIfExists(contractPath);
  if (!contractSource) {
    return [createStartupGateFinding({ file: WORKBENCH_CONTRACT_PATH, message: "Workbench contract must be available for startup shell-neutrality checks." })];
  }

  return contractSource.getFullText().includes('"agent-shell"')
    ? []
    : [createStartupGateFinding({ file: WORKBENCH_CONTRACT_PATH, message: "Workbench shell contract must include the agent-shell startup platform so bootstrap stays mission-neutral." })];
}

function collectPageStateDispatchFindings(project: import("ts-morph").Project): Finding[] {
  const dispatchPath = pathFromRepoRoot(PAGE_STATE_DISPATCH_PATH);
  const dispatchSource = project.getSourceFile(dispatchPath) ?? project.addSourceFileAtPathIfExists(dispatchPath);
  if (!dispatchSource) {
    return [createStartupGateFinding({ file: PAGE_STATE_DISPATCH_PATH, message: "Page-state dispatch source must be available for startup platform anti-coupling checks." })];
  }

  const findings: Finding[] = [];
  const dispatchText = dispatchSource.getFullText();
  const resolvePlatformDeclaration = dispatchSource.getVariableDeclaration("resolvePageStatePlatformProfile");

  if (!resolvePlatformDeclaration) {
    findings.push(createStartupGateFinding({ file: PAGE_STATE_DISPATCH_PATH, message: "Page-state dispatch must resolve platformProfileId from mission state or current real-platform URL." }));
  }
  if (dispatchText.includes("const platformProfileId = runtime.options.platformTarget;")) {
    findings.push(createStartupGateFinding({ file: PAGE_STATE_DISPATCH_PATH, message: "Page-state dispatch must not consume startup shell platform directly as platformProfileId." }));
  }
  if (!dispatchText.includes("mission.requestedPlatform")) {
    findings.push(createStartupGateFinding({ file: PAGE_STATE_DISPATCH_PATH, message: "Page-state dispatch must fall back to mission.requestedPlatform before any shell-level fallback." }));
  }

  return findings;
}

export async function collectStartupPlatformGovernanceFindings(
  project: import("ts-morph").Project,
  launchSource: import("ts-morph").SourceFile,
): Promise<Finding[]> {
  return [
    ...(await collectStartupPackageScriptFindings()),
    ...collectStartupLaunchFindings(launchSource),
    ...collectDeletedHelperFindings(project),
    ...collectAppServerFindings(project),
    ...collectWorkbenchShellFindings(project),
    ...collectPageStateDispatchFindings(project),
  ];
}