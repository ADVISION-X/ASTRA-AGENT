import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { findNamedImport, resolveModuleTargetPath } from "./components/dom-automation-module-resolution.js";
import { collectStringLiteralNodes, resolveStaticString } from "./components/dom-automation-static-strings.js";
import type { DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import { DOM_BUSINESS_VOCAB, LOG_FIELD_FORBIDDEN, SENSITIVE_PROPERTY_NAMES } from "./dom-automation-binary-constants.js";
import { BROWSER_CONTROLLER_PATH, CURRENT_CHROME_PATH, DOM_FACADE_PATH, PLUGIN_ROUTE_PATH } from "./dom-automation-path-constants.js";
import { repoPathOf, sourceFilesWithin } from "./dom-automation-source-helpers.js";
import { hasIdentifierCall, sourceFile } from "./dom-automation-shape-helpers.js";

const PLUGIN_ROOTS = [
  "src/plugins/amazon-invoice-upload",
  "src/plugins/product-video-dom-runtime",
] as const;

export const usesForbiddenPluginPrimitives = (context: DomAutomationBinaryCheckContext): string[] => {
  const violations: string[] = [];
  for (const file of PLUGIN_ROOTS.flatMap((root) => sourceFilesWithin(context, root))) {
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
    ...sourceFilesWithin(context, "src/plugins/product-video-dom-runtime"),
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
  symbols.filter((symbolName) => !PLUGIN_ROOTS.flatMap((root) => sourceFilesWithin(context, root)).some((file) => {
    const importDeclaration = findNamedImport(file, symbolName);
    if (!importDeclaration) {
      return false;
    }
    return resolveModuleTargetPath(importDeclaration) === DOM_FACADE_PATH && hasIdentifierCall(file, symbolName);
  }));

export const routeUsesWorkbenchFacade = (context: DomAutomationBinaryCheckContext): string[] => {
  const files = [
    sourceFile(context, PLUGIN_ROUTE_PATH),
    sourceFile(context, "src/app/product-video-plugin-api-handlers.ts"),
  ].filter((file): file is SourceFile => Boolean(file));
  if (files.length < 2) return ["plugin route files are missing"];
  const issues: string[] = [];
  const routeText = files.map((file) => file.getFullText()).join("\n");
  const requiredCalls = [
    "activeWorkbench.startAmazonInvoiceUploadTask",
    "activeWorkbench.openAdminInvoicePage",
    "activeWorkbench.resumeAmazonInvoiceUploadTask",
    "activeWorkbench.getAmazonInvoiceUploadTaskStatus",
    "activeWorkbench.startProductVideoDomMiningTask",
    "activeWorkbench.getProductVideoDomTaskStatus",
  ] as const;
  for (const callName of requiredCalls) {
    if (!routeText.includes(callName)) {
      issues.push(`missing route workbench call: ${callName}`);
    }
  }
  if (files.some((file) => file.getImportDeclarations().some((importDeclaration) => {
    const target = resolveModuleTargetPath(importDeclaration);
    return target === BROWSER_CONTROLLER_PATH || target === CURRENT_CHROME_PATH;
  }))) {
    issues.push("plugin route imports browser owner internals instead of the workbench facade");
  }
  return issues;
};
