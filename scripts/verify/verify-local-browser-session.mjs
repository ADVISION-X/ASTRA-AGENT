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

async function main() {
  const [law, blueprint, gitignore, packageJson, controllerText, helperText, runtimeText, repoFiles] = await Promise.all([
    requireFile(".github/instructions/cursor-rules/modules/module-local-browser-session.instructions.md"),
    requireFile("docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md"),
    requireFile(".gitignore"),
    requireFile("package.json"),
    requireFile("src/lib/browser/playwright-browser-controller.ts"),
    requireFile("src/lib/browser/local-browser-session.ts"),
    requireFile("src/types/runtime.ts"),
    listRepoFiles(repoRoot),
  ]);

  const project = new Project({
    tsConfigFilePath: path.join(repoRoot, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  const typesSource = getSourceFile(project, "src/types/local-browser-session.ts");

  assert(law.includes("Law GRASSEYE-LOCAL-BROWSER-SESSION-001-V1"), "local-browser-session law must exist");
  assert(law.includes("persistent local user profile"), "law must require a persistent local profile");
  assert(law.includes("must not contain raw cookies or tokens"), "law must forbid raw cookie or token logging");
  assert(law.includes("Headless mode must be disabled by default"), "law must forbid headless default for real-platform mode");

  assert(blueprint.includes("real_chrome_persistent"), "local-browser-session blueprint must define real_chrome_persistent mode");
  assert(blueprint.includes(".grasseye-local/browser-profiles/<platform>/"), "blueprint must define the governed persistent profile path");
  assert(blueprint.includes("GrassEye 不读取 cookies"), "blueprint must forbid cookie reads");

  const browserModes = getEnumValues(typesSource, "BrowserModeSchema");
  assert(browserModes.includes("real_chrome_persistent"), "BrowserMode must include real_chrome_persistent");

  const configFields = getSchemaPropertyNames(typesSource, "LocalBrowserSessionConfigSchema");
  const stateFields = getSchemaPropertyNames(typesSource, "LocalBrowserSessionStateSchema");

  for (const fieldName of ["browserMode", "platform", "chromeExecutablePath", "profileRef", "userDataDir", "headlessAllowed", "createdAt", "updatedAt"]) {
    assert(configFields.has(fieldName), `LocalBrowserSessionConfigSchema is missing ${fieldName}`);
  }

  for (const fieldName of ["browserMode", "browserProfileRef", "profileStatus", "loginState", "currentUrl", "lastLoginCheckAt", "reviewRequiredReason"]) {
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

  assert(controllerText.includes("launchPersistentContext"), "browser controller must use persistent browser profile launch");
  assert(controllerText.includes("executablePath"), "browser controller must target a real Chrome executable");
  assert(controllerText.includes("headless: false"), "browser controller must disable headless for real-platform mode");
  assert(controllerText.includes("forbids headless browser launch"), "browser controller must reject headless real-platform mode");
  assert(!controllerText.includes("storageState"), "browser controller must not use storageState as login persistence");
  assert(!controllerText.includes("addCookies"), "browser controller must not inject cookies");
  assert(!controllerText.includes("cookies("), "browser controller must not read cookies");

  assert(runtimeText.includes("browserProfileRef"), "runtime snapshot must expose browserProfileRef");
  assert(runtimeText.includes("browserProfileStatus"), "runtime snapshot must expose browserProfileStatus");
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

  process.stdout.write("verify-local-browser-session: PASS\n");
}

await main();