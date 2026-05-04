import { Node, SyntaxKind } from "ts-morph";

import { readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getNodeLine } from "../../core/ts-morph.js";
import { getIdentifierCallWithin, hasNamedImport } from "../local-app-shell/inspection-utils.js";

const STARTUP_GATE_LAW_ID = "GRASSEYE-STARTUP-ENTRYPOINT-005-V1";
const APP_SERVER_PATH = "src/app/server.ts";
const PACKAGE_JSON_PATH = "package.json";
const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_PLATFORM_HELPER_IMPORT = "./lib/platform-target.mjs";
const STARTUP_PLATFORM_HELPER_PATH = "scripts/startup/lib/platform-target.mjs";

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

function hasObjectLiteralProperty(node: import("ts-morph").Node | undefined, propertyName: string): boolean {
  if (!node || !Node.isObjectLiteralExpression(node)) {
    return false;
  }

  const property = node.getProperty(propertyName);
  return Boolean(property && (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)));
}

function getStartServiceEnvInitializer(
  launchSource: import("ts-morph").SourceFile,
  propertyName: string,
) {
  const startService = launchSource.getFunction("startService");
  const startLocalServiceCall = startService ? getIdentifierCallWithin(startService, "startLocalService") : undefined;
  const options = startLocalServiceCall?.getArguments()[0];
  const envObject = getObjectLiteralPropertyInitializer(getObjectLiteralPropertyInitializer(options, "env"), propertyName);
  return envObject;
}

async function collectStartupPackageScriptFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const packageJson = await readJsonFile<PackageJsonShape>(pathFromRepoRoot(PACKAGE_JSON_PATH));
  const internalAppServerScript = packageJson.scripts?.["internal:app-server:dev"];

  if (!internalAppServerScript) {
    findings.push(createStartupGateFinding({ file: PACKAGE_JSON_PATH, message: "package.json must keep internal:app-server:dev as the single local app shell start script." }));
  } else if (internalAppServerScript.includes("GRASSEYE_PLATFORM_TARGET=")) {
    findings.push(createStartupGateFinding({ file: PACKAGE_JSON_PATH, message: "internal:app-server:dev must not hardcode GRASSEYE_PLATFORM_TARGET. Startup must pass an explicit platform target at runtime." }));
  }

  return findings;
}

function collectStartupLaunchImportFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];

  for (const helperName of ["parseStartupFlags", "resolveStartupPlatformTarget", "shouldPromptForStartupPlatform"]) {
    if (!hasNamedImport(launchSource, STARTUP_PLATFORM_HELPER_IMPORT, helperName)) {
      findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: `Startup must import ${helperName} from the governed platform-target helper.` }));
    }
  }

  return findings;
}

function collectStartupParseFlagsFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const parseFlags = launchSource.getFunction("parseFlags");
  const parseStartupFlagsCall = parseFlags?.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "parseStartupFlags";
  });

  return parseStartupFlagsCall
    ? []
    : [createStartupGateFinding({ file: STARTUP_PATH, message: "Startup parseFlags wrapper must delegate to the governed platform-target parser." })];
}

function collectPerformLaunchPlatformFlowFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const performLaunch = launchSource.getFunction("performLaunch");
  if (!performLaunch) {
    return [createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must define performLaunch with governed platform-target resolution." })];
  }

  const findings: Finding[] = [];
  const promptGateCall = getIdentifierCallWithin(performLaunch, "shouldPromptForStartupPlatform");
  const resolveCall = getIdentifierCallWithin(performLaunch, "resolveStartupPlatformTarget");
  const runUpdatePreflightCall = getIdentifierCallWithin(performLaunch, "runUpdatePreflight");

  if (!promptGateCall) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must gate interactive platform prompting through shouldPromptForStartupPlatform before fail-closing." }));
  }
  if (!resolveCall) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must resolve a governed platform target before continuing the bootstrap chain." }));
  }
  if (resolveCall && runUpdatePreflightCall && resolveCall.getStart() > runUpdatePreflightCall.getStart()) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, line: getNodeLine(resolveCall), message: "Startup must resolve platformTarget before update preflight and service start." }));
  }

  return findings;
}

function collectStartupStructuredLogFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const helperEventNames = launchSource.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue());
  const findings: Finding[] = [];

  if (!helperEventNames.includes("platform_target_selection_required")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must structured-log when it needs an interactive platform selection." }));
  }
  if (!helperEventNames.includes("platform_target_resolved")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must structured-log the resolved platform target source." }));
  }

  return findings;
}

function collectStartServiceEnvFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  const platformTargetInitializer = getStartServiceEnvInitializer(launchSource, "GRASSEYE_PLATFORM_TARGET");
  if (!platformTargetInitializer) {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must pass GRASSEYE_PLATFORM_TARGET into the app server child process." }));
  } else if (!Node.isPropertyAccessExpression(platformTargetInitializer) || platformTargetInitializer.getText() !== "runtimeFlags.platformTarget") {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, line: getNodeLine(platformTargetInitializer), message: "Startup must pass the governed resolved platform target into the app server child process without hardcoding." }));
  }

  const startupReadinessInitializer = getStartServiceEnvInitializer(launchSource, "GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON");
  if (!startupReadinessInitializer || startupReadinessInitializer.getText() !== "JSON.stringify(localAiReadiness)") {
    findings.push(createStartupGateFinding({ file: STARTUP_PATH, message: "Startup must pass governed startup readiness JSON into the app server child process." }));
  }

  return findings;
}

function collectStartupLaunchPlatformFindings(
  launchSource: import("ts-morph").SourceFile,
): Finding[] {
  return [
    ...collectStartupLaunchImportFindings(launchSource),
    ...collectStartupParseFlagsFindings(launchSource),
    ...collectPerformLaunchPlatformFlowFindings(launchSource),
    ...collectStartupStructuredLogFindings(launchSource),
    ...collectStartServiceEnvFindings(launchSource),
  ];
}

function collectPlatformHelperInteractiveGateFindings(helperSource: import("ts-morph").SourceFile): Finding[] {
  const shouldPromptFunction = helperSource.getFunction("shouldPromptForStartupPlatform");
  const helperPropertyAccess = helperSource.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).map((expression) => expression.getText());

  return !shouldPromptFunction || !helperPropertyAccess.includes("io.stdin.isTTY") || !helperPropertyAccess.includes("io.stdout.isTTY")
    ? [createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must gate prompting on interactive stdin/stdout TTY state." })]
    : [];
}

function collectPlatformHelperSelectionFindings(helperSource: import("ts-morph").SourceFile): Finding[] {
  const resolveFunction = helperSource.getFunction("resolveStartupPlatformTarget");
  const questionCall = helperSource.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "question";
  });
  const promptGate = resolveFunction?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) => statement.getExpression().getText().includes("shouldPromptForStartupPlatform(flags, io)"));
  const helperLiterals = helperSource.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue());
  const findings: Finding[] = [];

  if (!promptGate) {
    findings.push(createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must only prompt through an explicit shouldPromptForStartupPlatform branch." }));
  }
  if (!questionCall) {
    findings.push(createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must explicitly ask the operator to choose a governed platform target." }));
  }
  if (!helperLiterals.includes("facebook-web") || !helperLiterals.includes("tiktok-web")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must constrain choices to the governed platform target set." }));
  }

  return findings;
}

function collectPlatformHelperFailClosedFindings(helperSource: import("ts-morph").SourceFile): Finding[] {
  const helperLiterals = helperSource.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue());

  return helperLiterals.some((literal) => literal.includes("STARTUP_PLATFORM_TARGET_REQUIRED"))
    ? []
    : [createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must fail closed when no explicit selection path is available." })];
}

function collectStartupPlatformHelperFindings(
  project: import("ts-morph").Project,
): Finding[] {
  const findings: Finding[] = [];
  const helperPath = pathFromRepoRoot(STARTUP_PLATFORM_HELPER_PATH);
  const helperSource = project.getSourceFile(helperPath) ?? project.addSourceFileAtPathIfExists(helperPath);

  if (!helperSource) {
    findings.push(createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must exist as governed bootstrap truth." }));
    return findings;
  }

  if (!hasNamedImport(helperSource, "node:readline/promises", "createInterface")) {
    findings.push(createStartupGateFinding({ file: STARTUP_PLATFORM_HELPER_PATH, message: "Startup platform-target helper must use node:readline/promises createInterface for governed interactive selection." }));
  }

  findings.push(...collectPlatformHelperInteractiveGateFindings(helperSource));
  findings.push(...collectPlatformHelperSelectionFindings(helperSource));
  findings.push(...collectPlatformHelperFailClosedFindings(helperSource));

  return findings;
}

function collectAppServerPlatformTargetFindings(
  serverSource: import("ts-morph").SourceFile,
): Finding[] {
  const findings: Finding[] = [];
  const parsePlatformTargetDeclaration = serverSource.getVariableDeclaration("parsePlatformTarget");
  const parsePlatformTargetInitializer = parsePlatformTargetDeclaration?.getInitializer();
  if (!parsePlatformTargetInitializer || !Node.isArrowFunction(parsePlatformTargetInitializer)) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, message: "App server must validate platformTarget through a dedicated parsePlatformTarget gate." }));
  } else {
    const parsePlatformTargetText = parsePlatformTargetInitializer.getText();
    if (!parsePlatformTargetText.includes('value === "tiktok-web"') || !parsePlatformTargetText.includes('value === "facebook-web"')) {
      findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, line: getNodeLine(parsePlatformTargetInitializer), message: "App server platform validation must explicitly allow the governed platform target set instead of pinning one platform." }));
    }
  }

  const pinnedPlatformCheck = serverSource.getDescendantsOfKind(SyntaxKind.BinaryExpression).find((expression) => {
    const right = expression.getRight();
    return expression.getOperatorToken().getText() === "!=="
      && expression.getLeft().getText().includes("configuredPlatformTarget")
      && Node.isStringLiteral(right)
      && right.getLiteralValue() === "tiktok-web";
  });
  if (pinnedPlatformCheck) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, line: getNodeLine(pinnedPlatformCheck), message: "App server must not pin startup to tiktok-web through a single-platform guard." }));
  }

  return findings;
}

function collectAppServerWorkbenchStartupFindings(
  serverSource: import("ts-morph").SourceFile,
): Finding[] {
  const findings: Finding[] = [];
  const parseStartupReadinessDeclaration = serverSource.getVariableDeclaration("parseStartupReadiness");
  const parseStartupReadinessInitializer = parseStartupReadinessDeclaration?.getInitializer();
  if (!parseStartupReadinessInitializer || !Node.isArrowFunction(parseStartupReadinessInitializer) || !parseStartupReadinessInitializer.getText().includes("LocalAiStartupReadinessSchema.parse")) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, message: "App server must parse governed startup readiness JSON before creating the workbench." }));
  }

  const createWorkbenchHandleCall = getIdentifierCallWithin(serverSource, "createGrassEyeWorkbenchHandle");
  const createWorkbenchOptions = createWorkbenchHandleCall?.getArguments()[0];
  if (!hasObjectLiteralProperty(createWorkbenchOptions, "startupReadiness")) {
    findings.push(createStartupGateFinding({ file: APP_SERVER_PATH, message: "App server must pass startupReadiness into the workbench handle so Commander can expose missionRuntimeAvailable and failureReason." }));
  }

  return findings;
}

function collectAppServerPlatformGovernanceFindings(
  project: import("ts-morph").Project,
): Finding[] {
  const serverSource = project.getSourceFile(pathFromRepoRoot(APP_SERVER_PATH));
  if (!serverSource) {
    return [createStartupGateFinding({ file: APP_SERVER_PATH, message: "App server source must be available for startup platform governance checks." })];
  }

  return [
    ...collectAppServerPlatformTargetFindings(serverSource),
    ...collectAppServerWorkbenchStartupFindings(serverSource),
  ];
}

export async function collectStartupPlatformGovernanceFindings(
  project: import("ts-morph").Project,
  launchSource: import("ts-morph").SourceFile,
): Promise<Finding[]> {
  return [
    ...(await collectStartupPackageScriptFindings()),
    ...collectStartupLaunchPlatformFindings(launchSource),
    ...collectStartupPlatformHelperFindings(project),
    ...collectAppServerPlatformGovernanceFindings(project),
  ];
}