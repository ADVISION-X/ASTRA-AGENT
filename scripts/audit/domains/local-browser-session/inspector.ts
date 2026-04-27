import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { getAuditProject, getExpressionPath, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";

const LAW_ID = "GRASSEYE-LOCAL-BROWSER-SESSION-001-V1";
const LAW_PATH = ".github/instructions/cursor-rules/modules/module-local-browser-session.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md";
const TYPES_PATH = "src/types/local-browser-session.ts";
const HELPER_PATH = "src/lib/browser/local-browser-session.ts";
const CONTROLLER_PATH = "src/lib/browser/playwright-browser-controller.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const SERVER_PATH = "src/app/server.ts";
const RUNTIME_PATH = "src/types/runtime.ts";
const STARTUP_ENTRY_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_OPEN_HELPER_PATH = "scripts/startup/lib/open-main-page.mjs";
const GITIGNORE_PATH = ".gitignore";
const GOVERNED_ROOTS = ["src/lib/browser/", "src/lib/local-runtime/", "src/features/platform-action/", "src/features/agent/"] as const;
const SCRIPT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const FORBIDDEN_TEXT_TOKENS = ["storageState", "addCookies", "cookies(", "localStorage", "sessionStorage"] as const;

const includesAll = (text: string, markers: readonly string[]): boolean => markers.every((marker) => text.includes(marker));

const hasScriptExtension = (filePath: string): boolean => SCRIPT_EXTENSIONS.some((extension) => filePath.endsWith(extension));

const isForbiddenTestPath = (filePath: string): boolean =>
  filePath.includes("/__tests__/")
  || filePath.startsWith("tests/")
  || filePath.includes("/tests/")
  || SCRIPT_EXTENSIONS.some((extension) => filePath.endsWith(`.test${extension}`));

const getZodObjectPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getProperties()
      .filter((property): property is import("ts-morph").PropertyAssignment | import("ts-morph").ShorthandPropertyAssignment =>
        Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
};

const getZodEnumValues = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getElements()
      .filter((element): element is import("ts-morph").StringLiteral => Node.isStringLiteral(element))
      .map((element) => element.getLiteralText()),
  );
};

const hasCallPath = (sourceFile: SourceFile, expectedPath: string[]): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const actualPath = getExpressionPath(callExpression.getExpression());
    return actualPath.length === expectedPath.length && actualPath.every((segment, index) => segment === expectedPath[index]);
  });

const hasHeadlessFalse = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const actualPath = getExpressionPath(callExpression.getExpression());
    if (actualPath.join(".") !== "chromium.launchPersistentContext") {
      return false;
    }

    const optionsArgument = callExpression.getArguments()[1];
    if (!optionsArgument || !Node.isObjectLiteralExpression(optionsArgument)) {
      return false;
    }

    const headlessProperty = optionsArgument.getProperty("headless");
    if (!headlessProperty || !Node.isPropertyAssignment(headlessProperty)) {
      return false;
    }

    const initializer = headlessProperty.getInitializer();
    return Boolean(initializer && Node.isFalseLiteral(initializer));
  });

const getImportedNamedBindings = (sourceFile: SourceFile, moduleSpecifier: string): Set<string> => {
  const importDeclaration = sourceFile.getImportDeclarations().find((item) => item.getModuleSpecifierValue() === moduleSpecifier);
  if (!importDeclaration) {
    return new Set();
  }

  return new Set(importDeclaration.getNamedImports().map((namedImport) => namedImport.getName()));
};

const findCallByIdentifier = (sourceFile: SourceFile, identifierName: string) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  }) ?? null;

const getObjectLiteralArgument = (expression: import("ts-morph").CallExpression | import("ts-morph").NewExpression | null, index = 0) => {
  const argument = expression?.getArguments()[index];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : null;
};

const getPropertyInitializerText = (objectLiteral: import("ts-morph").ObjectLiteralExpression | null, propertyName: string): string | null => {
  const property = objectLiteral?.getProperty(propertyName);
  if (!property) {
    return null;
  }

  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getName();
  }

  if (!Node.isPropertyAssignment(property)) {
    return null;
  }

  return property.getInitializer()?.getText() ?? null;
};

const variableReadsEnv = (sourceFile: SourceFile, variableName: string, envKey: string): boolean => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  return Boolean(initializer?.getText().includes(`process.env.${envKey}`));
};

export default async function inspectLocalBrowserSession(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "local-browser-session",
    inspectorId: "local-browser-session-owner",
    inspectorEntry: "scripts/audit/domains/local-browser-session/inspector.ts",
  });

  const [law, blueprint, gitignore, repoFiles, helperText, controllerText, workbenchText, runtimeText, startupEntryText, startupOpenHelperText] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(GITIGNORE_PATH)),
    listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-data"] }),
    readTextFile(pathFromRepoRoot(HELPER_PATH)),
    readTextFile(pathFromRepoRoot(CONTROLLER_PATH)),
    readTextFile(pathFromRepoRoot(WORKBENCH_PATH)),
    readTextFile(pathFromRepoRoot(RUNTIME_PATH)),
    readTextFile(pathFromRepoRoot(STARTUP_ENTRY_PATH)),
    readTextFile(pathFromRepoRoot(STARTUP_OPEN_HELPER_PATH)),
  ]);

  const findings = [...base.findings];
  const project = getAuditProject();
  const typesSource = getSourceFileOrThrow(project, TYPES_PATH);
  const controllerSource = getSourceFileOrThrow(project, CONTROLLER_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const serverSource = getSourceFileOrThrow(project, SERVER_PATH);
  const controllerPath = toRelativeSourcePath(controllerSource);

  const lawPassed = includesAll(law, ["persistent local user profile", "must not store raw cookies", "Headless mode must be disabled by default"]);
  const blueprintPassed = includesAll(blueprint, [
    "real_chrome_persistent",
    ".grasseye-local/browser-profiles/<platform>/",
    "GrassEye 不读取 cookies",
    "当前本地浏览器 handoff 是固定页面打开的简单主路径",
    "open <url>",
    "HANDOFF_FIXED_URL_TO_CURRENT_LOCAL_BROWSER",
    "handoff_fixed_url_to_current_local_browser",
    "profile.last_used",
    "browserProfileDirectory",
  ]);
  if (!lawPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: LAW_PATH, line: 1, severity: "error", message: "Local browser session law is missing a persistent-profile or cookie-boundary requirement." }));
  }
  if (!blueprintPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: BLUEPRINT_PATH, line: 1, severity: "error", message: "Local browser session blueprint is missing real_chrome_persistent or cookie-boundary guidance." }));
  }

  const browserModes = getZodEnumValues(typesSource, "BrowserModeSchema");
  const configFields = getZodObjectPropertyNames(typesSource, "LocalBrowserSessionConfigSchema");
  const stateFields = getZodObjectPropertyNames(typesSource, "LocalBrowserSessionStateSchema");

  if (!browserModes.has("real_chrome_persistent")) {
    findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "fatal", message: "BrowserMode must include real_chrome_persistent." }));
  }

  for (const requiredField of ["browserMode", "platform", "chromeExecutablePath", "profileRef", "userDataDir", "profileDirectory", "profileProvisioning", "profileVerificationStatus", "profileVerificationReason", "headlessAllowed", "createdAt", "updatedAt"]) {
    if (!configFields.has(requiredField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "error", message: `LocalBrowserSessionConfigSchema is missing ${requiredField}.` }));
    }
  }

  for (const requiredField of ["browserMode", "browserProfileRef", "profileStatus", "profileDirectory", "profileProvisioning", "profileVerificationStatus", "profileVerificationReason", "loginState", "currentUrl", "lastLoginCheckAt", "reviewRequiredReason"]) {
    if (!stateFields.has(requiredField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "error", message: `LocalBrowserSessionStateSchema is missing ${requiredField}.` }));
    }
  }

  for (const bannedField of ["cookie", "cookies", "session", "sessions", "token", "tokens", "storageState"]) {
    if (configFields.has(bannedField) || stateFields.has(bannedField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "fatal", message: `Local browser session schemas must not expose raw ${bannedField} fields.` }));
    }
  }

  if (!includesAll(helperText, [".grasseye-local", "browser-profiles", 'browserMode: "real_chrome_persistent"', "headlessAllowed: false", "Local State", "profile.last_used"])) {
    findings.push(createFinding({ lawId: LAW_ID, file: HELPER_PATH, line: 1, severity: "error", message: "Local browser session helper must resolve the governed persistent profile path, Chrome profile directory, and forbid headless by default." }));
  }

  if (!includesAll(startupEntryText, ['import { openMainPage } from "./lib/open-main-page.mjs";', "await openMainPage(baseUrl);"])) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_ENTRY_PATH, line: 1, severity: "error", message: "Startup entry must hand off the fixed page through openMainPage so current local browser reuse stays simple." }));
  }

  if (!includesAll(startupOpenHelperText, ['if (platform === "darwin")', '{ command: "open", args: [url] }'])) {
    findings.push(createFinding({ lawId: LAW_ID, file: STARTUP_OPEN_HELPER_PATH, line: 1, severity: "error", message: "Startup open helper must use macOS open <url> handoff for current local browser page opening." }));
  }

  const workbenchImports = getImportedNamedBindings(workbenchSource, "../browser/local-browser-session.js");
  if (!workbenchImports.has("createOperatorVerifiedLocalBrowserSessionConfig") || workbenchImports.has("createLocalBrowserSessionConfig")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must import only the operator-verified browser session config helper." }));
  }

  const verifiedConfigCall = findCallByIdentifier(workbenchSource, "createOperatorVerifiedLocalBrowserSessionConfig");
  const verifiedConfigArg = getObjectLiteralArgument(verifiedConfigCall);
  if (!verifiedConfigCall || !verifiedConfigArg) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must call createOperatorVerifiedLocalBrowserSessionConfig with an object literal." }));
  } else {
    if (getPropertyInitializerText(verifiedConfigArg, "profileRef") !== "options.browserProfileRef") {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "error", message: "Workbench must pass options.browserProfileRef into the verified browser session helper." }));
    }
    if (getPropertyInitializerText(verifiedConfigArg, "userDataDir") !== "options.browserUserDataDir") {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "error", message: "Workbench must pass options.browserUserDataDir into the verified browser session helper." }));
    }
    if (!workbenchText.includes("browserProfileDirectory")) {
      findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "error", message: "Workbench must expose browserProfileDirectory through runtime surfaces." }));
    }
  }

  if (findCallByIdentifier(workbenchSource, "createLocalBrowserSessionConfig")) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must not silently fall back to createLocalBrowserSessionConfig in real-platform mode." }));
  }

  const workbenchConstruction = serverSource.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => expression.getExpression().getText() === "GrassEyeWorkbench") ?? null;
  const workbenchOptions = getObjectLiteralArgument(workbenchConstruction, 0);
  if (!variableReadsEnv(serverSource, "browserProfileRef", "GRASSEYE_BROWSER_PROFILE_REF") || !variableReadsEnv(serverSource, "browserUserDataDir", "GRASSEYE_BROWSER_USER_DATA_DIR") || !variableReadsEnv(serverSource, "browserProfileDirectory", "GRASSEYE_BROWSER_PROFILE_DIRECTORY")) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "fatal", message: "Server startup must read explicit browser profile environment variables before constructing the workbench." }));
  }
  if (!workbenchConstruction || !workbenchOptions) {
    findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "fatal", message: "Server must construct GrassEyeWorkbench with an object literal that carries explicit browser profile fields." }));
  } else {
    if (getPropertyInitializerText(workbenchOptions, "browserProfileRef") !== "browserProfileRef") {
      findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "error", message: "Server must pass explicit browserProfileRef into the workbench." }));
    }
    if (getPropertyInitializerText(workbenchOptions, "browserUserDataDir") !== "browserUserDataDir") {
      findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "error", message: "Server must pass explicit browserUserDataDir into the workbench." }));
    }
    if (!workbenchText.includes("browserProfileDirectory") || !serverSource.getFullText().includes("browserProfileDirectory")) {
      findings.push(createFinding({ lawId: LAW_ID, file: SERVER_PATH, line: 1, severity: "error", message: "Server and workbench must thread browserProfileDirectory into the runtime boundary." }));
    }
  }

  if (!hasCallPath(controllerSource, ["chromium", "launchPersistentContext"])) {
    findings.push(createFinding({ lawId: LAW_ID, file: CONTROLLER_PATH, line: getNodeLine(controllerSource), severity: "fatal", message: "Real-platform browser controller must use chromium.launchPersistentContext for a persistent profile." }));
  }

  if (!hasHeadlessFalse(controllerSource)) {
    findings.push(createFinding({ lawId: LAW_ID, file: CONTROLLER_PATH, line: getNodeLine(controllerSource), severity: "error", message: "Real-platform browser controller must launch with headless: false." }));
  }

  if (!includesAll(controllerText, ["executablePath", "forbids headless browser launch", "--profile-directory="])) {
    findings.push(createFinding({ lawId: LAW_ID, file: controllerPath, line: 1, severity: "error", message: "Real-platform browser controller must target a real Chrome executable, reject headless mode, and launch with an explicit profile directory." }));
  }

  if (!includesAll(workbenchText, ["sessionConfig:", "browserProfileRef", "browserProfileDirectory", "browserProfileStatus", "browserProfileVerificationStatus", "loginState"])) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_PATH, line: 1, severity: "error", message: "Workbench must expose browser session metadata through mode or snapshot surfaces." }));
  }

  if (!includesAll(runtimeText, ["browserMode", "browserProfileRef", "browserProfileDirectory", "browserProfileStatus", "browserProfileProvisioning", "browserProfileVerificationStatus", "browserProfileVerificationReason", "loginState"])) {
    findings.push(createFinding({ lawId: LAW_ID, file: RUNTIME_PATH, line: 1, severity: "error", message: "Runtime snapshot types must expose browser session metadata." }));
  }

  if (!gitignore.includes(".grasseye-local/browser-profiles/")) {
    findings.push(createFinding({ lawId: LAW_ID, file: GITIGNORE_PATH, line: 1, severity: "fatal", message: ".gitignore must exclude .grasseye-local/browser-profiles/." }));
  }

  const forbiddenTests = repoFiles.filter((file) => hasScriptExtension(file) && isForbiddenTestPath(file));
  if (forbiddenTests.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: forbiddenTests[0] ?? "tests", line: 1, severity: "fatal", message: "Local browser session enforcement forbids repository test artifacts." }));
  }

  const committedProfiles = repoFiles.filter((file) => file.startsWith(".grasseye-local/browser-profiles/"));
  if (committedProfiles.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: committedProfiles[0] ?? ".grasseye-local/browser-profiles", line: 1, severity: "fatal", message: "Browser profile directories must not be committed into repository truth." }));
  }

  for (const filePath of repoFiles) {
    if (!hasScriptExtension(filePath) || !GOVERNED_ROOTS.some((root) => filePath.startsWith(root))) {
      continue;
    }

    const content = await readTextFile(pathFromRepoRoot(filePath));
    const forbiddenToken = FORBIDDEN_TEXT_TOKENS.find((token) => content.includes(token));
    if (!forbiddenToken) {
      continue;
    }

    findings.push(createFinding({ lawId: LAW_ID, file: filePath, line: 1, severity: "fatal", message: `Governed browser session code must not use ${forbiddenToken} for login persistence.` }));
  }

  return finalizeInspectorResult({
    inspector: "GrassEye Local Browser Session Owner Inspector",
    inspectorId: "local-browser-session-owner",
    capabilityDomain: "local-browser-session",
    findings,
    phases: [
      ...base.phases,
      createPhase("local-browser-session-law", lawPassed ? "PASS" : "CODE VIOLATION", lawPassed, lawPassed ? "Local browser session law defines persistent-profile and cookie privacy boundaries." : "Local browser session law is missing required boundaries."),
      createPhase("local-browser-session-blueprint", blueprintPassed ? "PASS" : "CODE VIOLATION", blueprintPassed, blueprintPassed ? "Blueprint defines real Chrome persistent profile startup, current-browser handoff, and Local State profile directory resolution boundaries." : "Blueprint is missing required startup or privacy guidance."),
      createPhase("local-browser-session-type-contract", findings.some((finding) => finding.file === TYPES_PATH) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => finding.file === TYPES_PATH), !findings.some((finding) => finding.file === TYPES_PATH) ? "Browser session types expose profile metadata, including profile directory, without raw cookie fields." : "Browser session types are incomplete or expose forbidden fields."),
      createPhase("local-browser-session-runtime-boundary", findings.some((finding) => [HELPER_PATH, CONTROLLER_PATH, WORKBENCH_PATH, SERVER_PATH, RUNTIME_PATH, STARTUP_ENTRY_PATH, STARTUP_OPEN_HELPER_PATH].includes(finding.file)) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => [HELPER_PATH, CONTROLLER_PATH, WORKBENCH_PATH, SERVER_PATH, RUNTIME_PATH, STARTUP_ENTRY_PATH, STARTUP_OPEN_HELPER_PATH].includes(finding.file)), !findings.some((finding) => [HELPER_PATH, CONTROLLER_PATH, WORKBENCH_PATH, SERVER_PATH, RUNTIME_PATH, STARTUP_ENTRY_PATH, STARTUP_OPEN_HELPER_PATH].includes(finding.file)) ? "Runtime uses governed persistent Chrome profile wiring, explicit profile proof, and current-browser fixed-page handoff." : "Runtime browser session wiring is missing a governed real Chrome, explicit profile proof, or current-browser handoff boundary."),
      createPhase("local-browser-session-forbidden-apis", findings.some((finding) => finding.message.includes("must not use")) ? "FAKE ENFORCEMENT" : "PASS", !findings.some((finding) => finding.message.includes("must not use")), !findings.some((finding) => finding.message.includes("must not use")) ? "Governed browser session code avoids storageState, cookie reads, cookie injection, and browser storage dumps." : "Governed browser session code still uses forbidden login persistence APIs."),
      createPhase("local-browser-session-repo-boundary", forbiddenTests.length === 0 && committedProfiles.length === 0 && gitignore.includes(".grasseye-local/browser-profiles/") ? "PASS" : "CODE VIOLATION", forbiddenTests.length === 0 && committedProfiles.length === 0 && gitignore.includes(".grasseye-local/browser-profiles/"), forbiddenTests.length === 0 && committedProfiles.length === 0 && gitignore.includes(".grasseye-local/browser-profiles/") ? "Repository excludes test artifacts and committed browser profile directories." : "Repository or gitignore still allows forbidden browser session artifacts."),
    ],
    summary: findings.length === 0 ? "local browser session governance enforces real Chrome persistent profile usage without cookie exposure" : "local browser session governance is missing a persistent-profile or privacy boundary",
  });
}