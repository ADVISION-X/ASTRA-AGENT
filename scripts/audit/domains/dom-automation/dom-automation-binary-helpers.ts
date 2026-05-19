import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { repoRoot } from "../../core/path-roots.js";
import { collectStringLiteralNodes, findNamedImport, getSourceFileAtRepoPath, hasIdentifierCall, objectLiteralPropertyNames, resolveImportedDeclarationPaths, resolveModuleTargetPath, resolveStaticString } from "./components/collect-dom-automation-project.js";
import type { DomAutomationBinaryCheckContext, ClauseCheckOutcome } from "./dom-automation-binary-types.js";
import { BROWSER_CONTROLLER_PATH, CURRENT_CHROME_PATH, DOM_BUSINESS_VOCAB, DOM_FACADE_PATH, LOG_FIELD_FORBIDDEN, SENSITIVE_PROPERTY_NAMES, PLUGIN_ROUTE_PATH } from "./dom-automation-binary-constants.js";

export { hasIdentifierCall };

export const pass = (evidence: string): ClauseCheckOutcome => ({ status: "PASS", evidence });
export const fail = (evidence: string, failureReason: string): ClauseCheckOutcome => ({ status: "FAIL", evidence, failureReason });

export const sourceFile = (context: DomAutomationBinaryCheckContext, repoPath: string): SourceFile | null =>
  getSourceFileAtRepoPath(context.auditProject.project, repoPath);

export const sourceText = (context: DomAutomationBinaryCheckContext, repoPath: string): string =>
  sourceFile(context, repoPath)?.getFullText() ?? (existsSync(pathFromRepoRoot(repoPath)) ? readFileSync(pathFromRepoRoot(repoPath), "utf8") : "");

export const variableFields = (file: SourceFile | null, variableName: string): Set<string> => {
  if (!file) {
    return new Set<string>();
  }
  const declaration = file.getVariableDeclaration(variableName);
  if (!declaration) {
    return new Set<string>();
  }
  const fields = new Set<string>();
  for (const objectLiteral of declaration.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    for (const fieldName of objectLiteralPropertyNames(objectLiteral)) {
      fields.add(fieldName);
    }
  }
  return fields;
};

export const typeFields = (file: SourceFile | null, typeName: string): Set<string> => {
  if (!file) {
    return new Set<string>();
  }
  const fields = new Set<string>();
  file.getInterface(typeName)?.getProperties().forEach((property) => fields.add(property.getName()));
  file.getTypeAlias(typeName)?.getDescendantsOfKind(SyntaxKind.PropertySignature).forEach((property) => fields.add(property.getName()));
  return fields;
};

export const hasFields = (fields: Set<string>, expected: readonly string[]): string[] =>
  expected.filter((field) => !fields.has(field));

export const hasPropertyCall = (file: SourceFile | null, receiver: string, propertyName: string): boolean =>
  Boolean(file?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === receiver
      && expression.getName() === propertyName;
  }));

export const classMethods = (file: SourceFile | null, className: string): Set<string> =>
  new Set((file?.getClass(className)?.getMethods() ?? []).map((method) => method.getName()));

export const interfaceMethods = (file: SourceFile | null, interfaceName: string): Set<string> =>
  new Set((file?.getInterface(interfaceName)?.getMethods() ?? []).map((method) => method.getName()));

export const sourceFilesWithin = (context: DomAutomationBinaryCheckContext, repoPath: string): SourceFile[] =>
  context.auditProject.project.getSourceFiles().filter((file) => toRepoRelativePath(file.getFilePath()).startsWith(`${repoPath}/`));

export const repoPathOf = (file: SourceFile): string => toRepoRelativePath(file.getFilePath());

export const findForbiddenImports = (context: DomAutomationBinaryCheckContext, ownerRoot: string, forbiddenRoots: readonly string[]): string[] => {
  const violations: string[] = [];
  for (const file of sourceFilesWithin(context, ownerRoot)) {
    for (const importDeclaration of file.getImportDeclarations()) {
      const moduleTargetPath = resolveModuleTargetPath(importDeclaration);
      if (ownerRoot === "src/plugins/amazon-invoice-upload" && moduleTargetPath === DOM_FACADE_PATH) {
        continue;
      }
      const targets = resolveImportedDeclarationPaths(importDeclaration);
      const matched = targets.find((target) => forbiddenRoots.some((root) => target === root || target.startsWith(`${root}/`)));
      if (matched) {
        violations.push(`${repoPathOf(file)}:${importDeclaration.getStartLineNumber()} -> ${matched}`);
      }
    }
  }
  return violations;
};

export const hasVisualMissionDomImport = (context: DomAutomationBinaryCheckContext): boolean =>
  sourceFilesWithin(context, "src/visual-mission").some((file) => file.getImportDeclarations().some((importDeclaration) => {
    const targets = resolveImportedDeclarationPaths(importDeclaration);
    return targets.some((target) => target.startsWith("src/capabilities/dom-automation/"));
  }));

export const hasSecondBrowserController = (context: DomAutomationBinaryCheckContext): string[] =>
  context.auditProject.project.getSourceFiles("src/**/*.ts")
    .flatMap((file) => file.getClasses()
      .filter((klass) => klass.getName() !== "CurrentChromeBrowserController")
      .filter((klass) => klass.getImplements().some((heritage) => heritage.getText().includes("BrowserController")))
      .map((klass) => `${repoPathOf(file)}:${klass.getStartLineNumber()}`));

export const usesForbiddenPluginPrimitives = (context: DomAutomationBinaryCheckContext): string[] => {
  const violations: string[] = [];
  for (const file of sourceFilesWithin(context, "src/plugins/amazon-invoice-upload")) {
    const text = file.getFullText();
    for (const token of ["runAppleScript", "clickAt", "scrollAt", "chromium.launch", "launchPersistentContext", "CurrentChromeBrowserController"]) {
      if (text.includes(token)) {
        violations.push(`${repoPathOf(file)} contains ${token}`);
      }
    }
    if (file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expr) => ["querySelector", "querySelectorAll"].includes(expr.getName()))) {
      violations.push(`${repoPathOf(file)} bypasses the DOM facade with direct DOM API usage`);
    }
  }
  return violations;
};

export const domCoreContainsBusinessVocabulary = (context: DomAutomationBinaryCheckContext): string[] => {
  const violations: string[] = [];
  for (const file of sourceFilesWithin(context, "src/capabilities/dom-automation")) {
    if (repoPathOf(file).startsWith("src/capabilities/dom-automation/tests/")) {
      continue;
    }
    const literals = collectStringLiteralNodes(file).map((literal) => literal.text.toLowerCase());
    const matched = DOM_BUSINESS_VOCAB.find((token) => literals.some((literal) => literal.includes(token)));
    if (matched) {
      violations.push(`${repoPathOf(file)} contains business vocabulary: ${matched}`);
    }
  }
  return violations;
};

export const hasSensitiveDomAccess = (file: SourceFile | null): boolean => {
  if (!file) {
    return false;
  }
  const propertyAccess = file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const normalized = expression.getText().replace(/\s+/g, "").toLowerCase();
    return normalized === "document.cookie"
      || normalized === "window.localstorage"
      || normalized === "window.sessionstorage"
      || normalized === "globalthis.localstorage"
      || normalized === "globalthis.sessionstorage"
      || normalized === "document.documentelement.innerhtml"
      || normalized.endsWith(".outerhtml");
  });
  const elementAccess = file.getDescendantsOfKind(SyntaxKind.ElementAccessExpression).some((expression) => {
    const propertyName = resolveStaticString(expression.getArgumentExpression())?.toLowerCase();
    return propertyName != null && SENSITIVE_PROPERTY_NAMES.includes(propertyName as (typeof SENSITIVE_PROPERTY_NAMES)[number]);
  });
  const scriptLiteral = collectStringLiteralNodes(file).some((literal) => /(document\s*(?:\.cookie|\[\s*['"]cookie['"]\s*\])|localStorage|sessionStorage|outerHTML|document\.documentElement\.innerHTML)/iu.test(literal.text));
  return propertyAccess || elementAccess || scriptLiteral;
};

export const forbiddenLogFields = (context: DomAutomationBinaryCheckContext): string[] => {
  const violations: string[] = [];
  for (const file of [
    ...sourceFilesWithin(context, "src/capabilities/dom-automation"),
    ...sourceFilesWithin(context, "src/plugins/amazon-invoice-upload"),
  ]) {
    file.forEachDescendant((node) => {
      if (!Node.isPropertyAssignment(node) && !Node.isShorthandPropertyAssignment(node)) {
        return;
      }
      const propertyName = node.getName();
      if (LOG_FIELD_FORBIDDEN.includes(propertyName as (typeof LOG_FIELD_FORBIDDEN)[number])) {
        violations.push(`${repoPathOf(file)}:${node.getStartLineNumber()} -> ${propertyName}`);
      }
    });
  }
  return violations;
};

export const manifestHasAllLawIds = (context: DomAutomationBinaryCheckContext): boolean =>
  [
    "GRASSEYE-DOM-001-V1",
    "GRASSEYE-DOM-002-V1",
    "GRASSEYE-DOM-003-V1",
    "GRASSEYE-DOM-004-V1",
    "GRASSEYE-DOM-005-V1",
    "GRASSEYE-DOM-006-V1",
    "GRASSEYE-DOM-007-V1",
    "GRASSEYE-DOM-008-V1",
    "GRASSEYE-DOM-009-V1",
    "GRASSEYE-DOM-010-V1",
  ].every((lawId) => context.manifest.allowedLawIds?.includes(lawId));

export const pluginUsesFacadeSymbols = (context: DomAutomationBinaryCheckContext, symbols: readonly string[]): string[] =>
  symbols.filter((symbolName) => !sourceFilesWithin(context, "src/plugins/amazon-invoice-upload").some((file) => {
    const importDeclaration = findNamedImport(file, symbolName);
    if (!importDeclaration) {
      return false;
    }
    return resolveModuleTargetPath(importDeclaration) === DOM_FACADE_PATH && hasIdentifierCall(file, symbolName);
  }));

export const routeUsesWorkbenchFacade = (context: DomAutomationBinaryCheckContext): string[] => {
  const file = sourceFile(context, PLUGIN_ROUTE_PATH);
  if (!file) {
    return ["src/app/plugin-task-api-handlers.ts is missing"];
  }
  const issues: string[] = [];
  const requiredCalls = [
    "activeWorkbench.startAmazonInvoiceUploadTask",
    "activeWorkbench.openAdminInvoicePage",
    "activeWorkbench.resumeAmazonInvoiceUploadTask",
    "activeWorkbench.getAmazonInvoiceUploadTaskStatus",
  ] as const;
  for (const callName of requiredCalls) {
    if (!file.getFullText().includes(callName)) {
      issues.push(`missing route workbench call: ${callName}`);
    }
  }
  if (file.getImportDeclarations().some((importDeclaration) => {
    const target = resolveModuleTargetPath(importDeclaration);
    return target === BROWSER_CONTROLLER_PATH || target === CURRENT_CHROME_PATH;
  })) {
    issues.push("plugin route imports browser owner internals instead of the workbench facade");
  }
  return issues;
};

export const runCommand = async (command: readonly [string, ...string[]]): Promise<ClauseCheckOutcome> => {
  const [executable, ...args] = command;
  const child = spawn(executable, args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const append = (chunk: Buffer): void => {
    const text = chunk.toString();
    output = `${output}${text}`.slice(-24000);
    process.stdout.write(text);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  return await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      const lastLines = output.trim().split(/\r?\n/u).slice(-12).join(" | ");
      if (code === 0) {
        resolve(pass(`command passed: ${command.join(" ")} :: ${lastLines || "no output"}`));
        return;
      }
      resolve(fail(`command failed: ${command.join(" ")}`, lastLines || `exit code ${code ?? "unknown"}`));
    });
  });
};
