import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { Node, Project, SyntaxKind } from "ts-morph";

const repoRoot = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requireFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function listRepoFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextRelativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", ".grasseye-data", ".grasseye-local", ".grasseye-demo-data"].includes(entry.name)) {
        continue;
      }

      files.push(...await listRepoFiles(rootDir, nextRelativePath));
      continue;
    }

    files.push(nextRelativePath);
  }

  return files;
}

function getSourceFile(project, relativePath) {
  const sourceFile = project.getSourceFile(path.join(repoRoot, relativePath));
  if (!sourceFile) {
    throw new Error(`Missing source file: ${relativePath}`);
  }

  return sourceFile;
}

function debug(message) {
  process.stdout.write(`[verify:local-browser-session] ${message}\n`);
}

function getSchemaPropertyNames(sourceFile, declarationName) {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getProperties()
      .filter((property) => Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
}

function getEnumValues(sourceFile, declarationName) {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
    return [];
  }

  return firstArgument
    .getElements()
    .filter((element) => Node.isStringLiteral(element))
    .map((element) => element.getLiteralText());
}

function getImportedNamedBindings(sourceFile, moduleSpecifier) {
  const importDeclaration = sourceFile.getImportDeclarations().find((item) => item.getModuleSpecifierValue() === moduleSpecifier);
  if (!importDeclaration) {
    return new Set();
  }

  return new Set(
    importDeclaration
      .getNamedImports()
      .map((namedImport) => namedImport.getName()),
  );
}

function findCallExpressionByIdentifier(sourceFile, identifierName) {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  }) ?? null;
}

function getObjectLiteralArgument(callExpression, index = 0) {
  const argument = callExpression?.getArguments()[index];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : null;
}

function getPropertyInitializerText(objectLiteral, propertyName) {
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
}

function variableReadsEnv(sourceFile, variableName, envKey) {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  return Boolean(initializer?.getText().includes(`process.env.${envKey}`));
}

async function main() {
  const [law, blueprint, gitignore, packageJson, controllerText, helperText, runtimeText, startupLaunchText, startupOpenText, repoFiles] = await Promise.all([
    requireFile(".github/instructions/cursor-rules/modules/module-local-browser-session.instructions.md"),
    requireFile("docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md"),
    requireFile(".gitignore"),
    requireFile("package.json"),
    requireFile("src/lib/browser/playwright-browser-controller.ts"),
    requireFile("src/lib/browser/local-browser-session.ts"),
    requireFile("src/types/runtime.ts"),
    requireFile("scripts/startup/launch-grasseye.mjs"),
    requireFile("scripts/startup/lib/open-main-page.mjs"),
    listRepoFiles(repoRoot),
  ]);

  const project = new Project({
    tsConfigFilePath: path.join(repoRoot, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  const typesSource = getSourceFile(project, "src/types/local-browser-session.ts");
  const helperSource = getSourceFile(project, "src/lib/browser/local-browser-session.ts");
  const workbenchSource = getSourceFile(project, "src/lib/local-runtime/workbench.ts");
  const serverSource = getSourceFile(project, "src/app/server.ts");

  debug("loaded law, blueprint, runtime text, and AST project");

  assert(law.includes("Law GRASSEYE-LOCAL-BROWSER-SESSION-001-V1"), "local-browser-session law must exist");
  assert(law.includes("persistent local user profile"), "law must require a persistent local profile");
  assert(law.includes("must not contain raw cookies or tokens"), "law must forbid raw cookie or token logging");
  assert(law.includes("Headless mode must be disabled by default"), "law must forbid headless default for real-platform mode");

  assert(blueprint.includes("real_chrome_persistent"), "local-browser-session blueprint must define real_chrome_persistent mode");
  assert(blueprint.includes(".grasseye-local/browser-profiles/<platform>/"), "blueprint must define the governed persistent profile path");
  assert(blueprint.includes("GrassEye 不读取 cookies"), "blueprint must forbid cookie reads");
  assert(blueprint.includes("当前本地浏览器 handoff 是固定页面打开的简单主路径"), "blueprint must define current local browser handoff as the simple fixed-page path");
  assert(blueprint.includes("open <url>"), "blueprint must define macOS open <url> handoff");
  assert(blueprint.includes("HANDOFF_FIXED_URL_TO_CURRENT_LOCAL_BROWSER"), "blueprint must define current-browser handoff in the startup state machine");
  assert(blueprint.includes("handoff_fixed_url_to_current_local_browser"), "blueprint must define current-browser handoff structured log event");
  assert(blueprint.includes("profile.last_used"), "blueprint must define Local State profile.last_used fallback for real Chrome profile directory resolution");
  assert(blueprint.includes("browserProfileDirectory"), "blueprint must require browserProfileDirectory visibility");

  const browserModes = getEnumValues(typesSource, "BrowserModeSchema");
  const provisioningModes = getEnumValues(typesSource, "BrowserProfileProvisioningSchema");
  const verificationModes = getEnumValues(typesSource, "BrowserProfileVerificationStatusSchema");
  assert(browserModes.includes("real_chrome_persistent"), "BrowserMode must include real_chrome_persistent");
  assert(provisioningModes.includes("operator_supplied") && provisioningModes.includes("managed_default"), "Browser profile provisioning enum must distinguish operator_supplied and managed_default");
  assert(verificationModes.includes("operator_verified") && verificationModes.includes("default_unverified"), "Browser profile verification enum must distinguish operator_verified and default_unverified");

  const configFields = getSchemaPropertyNames(typesSource, "LocalBrowserSessionConfigSchema");
  const stateFields = getSchemaPropertyNames(typesSource, "LocalBrowserSessionStateSchema");

  for (const fieldName of ["browserMode", "platform", "chromeExecutablePath", "profileRef", "userDataDir", "profileDirectory", "profileProvisioning", "profileVerificationStatus", "profileVerificationReason", "headlessAllowed", "createdAt", "updatedAt"]) {
    assert(configFields.has(fieldName), `LocalBrowserSessionConfigSchema is missing ${fieldName}`);
  }

  for (const fieldName of ["browserMode", "browserProfileRef", "profileStatus", "profileDirectory", "profileProvisioning", "profileVerificationStatus", "profileVerificationReason", "loginState", "currentUrl", "lastLoginCheckAt", "reviewRequiredReason"]) {
    assert(stateFields.has(fieldName), `LocalBrowserSessionStateSchema is missing ${fieldName}`);
  }

  for (const bannedField of ["cookie", "cookies", "session", "sessions", "token", "tokens", "storageState", "localStorage", "sessionStorage"]) {
    assert(!configFields.has(bannedField), `LocalBrowserSessionConfigSchema must not include ${bannedField}`);
    assert(!stateFields.has(bannedField), `LocalBrowserSessionStateSchema must not include ${bannedField}`);
  }

  assert(helperText.includes(".grasseye-local"), "local browser session helper must resolve .grasseye-local profile paths");
  assert(helperText.includes("browser-profiles"), "local browser session helper must resolve browser-profiles path");
  assert(helperText.includes('browserMode: "real_chrome_persistent"'), "local browser session helper must default to real_chrome_persistent");
  assert(helperText.includes("headlessAllowed: false"), "local browser session helper must forbid headless by default");
  assert(helperText.includes("Local State"), "local browser session helper must support Chrome Local State profile resolution");
  assert(helperText.includes("profile.last_used"), "local browser session helper must resolve the last used Chrome profile directory");
  assert(getImportedNamedBindings(workbenchSource, "../browser/local-browser-session.js").has("createOperatorVerifiedLocalBrowserSessionConfig"), "workbench must import createOperatorVerifiedLocalBrowserSessionConfig");
  assert(!getImportedNamedBindings(workbenchSource, "../browser/local-browser-session.js").has("createLocalBrowserSessionConfig"), "workbench must not import silent default browser session config helper");

  const verifiedConfigCall = findCallExpressionByIdentifier(workbenchSource, "createOperatorVerifiedLocalBrowserSessionConfig");
  const verifiedConfigArg = getObjectLiteralArgument(verifiedConfigCall);
  assert(verifiedConfigCall && verifiedConfigArg, "workbench must call createOperatorVerifiedLocalBrowserSessionConfig with an object literal");
  assert(getPropertyInitializerText(verifiedConfigArg, "profileRef") === "options.browserProfileRef", "workbench must pass options.browserProfileRef into verified browser session config");
  assert(getPropertyInitializerText(verifiedConfigArg, "userDataDir") === "options.browserUserDataDir", "workbench must pass options.browserUserDataDir into verified browser session config");
  assert(workbenchSource.getFullText().includes("browserProfileDirectory"), "workbench must carry browserProfileDirectory through runtime surfaces");

  const genericConfigCall = findCallExpressionByIdentifier(workbenchSource, "createLocalBrowserSessionConfig");
  assert(!genericConfigCall, "workbench must not call createLocalBrowserSessionConfig directly in real-platform mode");

  assert(variableReadsEnv(serverSource, "browserProfileRef", "GRASSEYE_BROWSER_PROFILE_REF"), "server must derive browserProfileRef from GRASSEYE_BROWSER_PROFILE_REF");
  assert(variableReadsEnv(serverSource, "browserUserDataDir", "GRASSEYE_BROWSER_USER_DATA_DIR"), "server must derive browserUserDataDir from GRASSEYE_BROWSER_USER_DATA_DIR");
  assert(variableReadsEnv(serverSource, "browserProfileDirectory", "GRASSEYE_BROWSER_PROFILE_DIRECTORY"), "server must support explicit GRASSEYE_BROWSER_PROFILE_DIRECTORY override");

  const workbenchConstruction = serverSource.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => expression.getExpression().getText() === "GrassEyeWorkbench") ?? null;
  const workbenchOptions = getObjectLiteralArgument(workbenchConstruction, 0);
  assert(workbenchConstruction && workbenchOptions, "server must construct GrassEyeWorkbench with an object literal");
  assert(getPropertyInitializerText(workbenchOptions, "browserProfileRef") === "browserProfileRef", "server must pass explicit browserProfileRef into workbench");
  assert(getPropertyInitializerText(workbenchOptions, "browserUserDataDir") === "browserUserDataDir", "server must pass explicit browserUserDataDir into workbench");
  assert(serverSource.getFullText().includes("browserProfileDirectory"), "server must thread browserProfileDirectory toward the workbench");

  debug("verified AST-level browser proof gate on workbench and server");

  assert(startupLaunchText.includes('import { openMainPage } from "./lib/open-main-page.mjs";'), "startup launch must import openMainPage helper");
  assert(startupLaunchText.includes("await openMainPage(baseUrl);"), "startup launch must hand off the fixed page to openMainPage");
  assert(startupOpenText.includes('if (platform === "darwin")'), "startup open helper must branch on darwin");
  assert(startupOpenText.includes('{ command: "open", args: [url] }'), "startup open helper must use macOS open <url> current-browser handoff");

  debug("verified startup fixed-page handoff uses current local browser open command on macOS");

  assert(controllerText.includes("launchPersistentContext"), "browser controller must use persistent browser profile launch");
  assert(controllerText.includes("executablePath"), "browser controller must target a real Chrome executable");
  assert(controllerText.includes("headless: false"), "browser controller must disable headless for real-platform mode");
  assert(controllerText.includes("--profile-directory="), "browser controller must launch real Chrome with an explicit profile directory");
  assert(controllerText.includes("forbids headless browser launch"), "browser controller must reject headless real-platform mode");
  assert(!controllerText.includes("storageState"), "browser controller must not use storageState as login persistence");
  assert(!controllerText.includes("addCookies"), "browser controller must not inject cookies");
  assert(!controllerText.includes("cookies("), "browser controller must not read cookies");

  assert(runtimeText.includes("browserProfileRef"), "runtime snapshot must expose browserProfileRef");
  assert(runtimeText.includes("browserProfileDirectory"), "runtime snapshot must expose browserProfileDirectory");
  assert(runtimeText.includes("browserProfileStatus"), "runtime snapshot must expose browserProfileStatus");
  assert(runtimeText.includes("browserProfileProvisioning"), "runtime snapshot must expose browserProfileProvisioning");
  assert(runtimeText.includes("browserProfileVerificationStatus"), "runtime snapshot must expose browserProfileVerificationStatus");
  assert(runtimeText.includes("browserProfileVerificationReason"), "runtime snapshot must expose browserProfileVerificationReason");
  assert(runtimeText.includes("loginState"), "runtime snapshot must expose loginState");

  assert(gitignore.includes(".grasseye-local/browser-profiles/"), ".gitignore must exclude local browser profiles");
  assert(packageJson.includes('"verify:local-browser-session"'), "package.json must expose verify:local-browser-session");
  assert(packageJson.includes("verify:local-browser-session &&"), "phase or CI command chain must invoke verify:local-browser-session");

  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  assert(forbiddenTests.length === 0, `local-browser-session verification forbids repository test artifacts: ${forbiddenTests.join(", ")}`);

  const committedProfiles = repoFiles.filter((file) => file.startsWith(".grasseye-local/browser-profiles/"));
  assert(committedProfiles.length === 0, `browser profile directories must not be committed: ${committedProfiles.join(", ")}`);

  const governedSourceFiles = repoFiles.filter((file) => /^(src\/lib\/browser|src\/lib\/local-runtime|src\/features\/platform-action|src\/features\/agent)\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file));
  for (const governedSourceFile of governedSourceFiles) {
    const content = await requireFile(governedSourceFile);
    for (const forbiddenPattern of ["storageState", "addCookies", "cookies(", "localStorage", "sessionStorage"]) {
      assert(!content.includes(forbiddenPattern), `${governedSourceFile} must not use ${forbiddenPattern} for login persistence`);
    }
  }

  debug("verified forbidden cookie/session persistence APIs are absent");

  process.stdout.write("verify-local-browser-session: PASS\n");
}

await main();