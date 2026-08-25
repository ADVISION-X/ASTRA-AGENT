import { Node, SyntaxKind, type CallExpression, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { finalizeStaticInspection, staticLawCoverage } from "../../shared/static-inspector-result.js";

const LAW_ID = "LAW-SYSTEM-SECURITY-001-V1";
const CLAUSE_ID = `${LAW_ID.toLowerCase()}-requirement`;
const sensitiveTerms = Object.freeze(["authorization", "cookie", "credential", "password", "secret", "token", "userinput", "attachmentcontent", "browseridentity"]);
const forbiddenCloudControlFields = new Set(["browserCommand", "coordinate", "documentId", "nextAction", "selector", "targetId"]);

const normalizePath = (value: string): string => value.split("\\").join("/");
const sourcePath = (source: SourceFile): string => {
  const normalized = normalizePath(source.getFilePath());
  for (const root of ["src/", "scripts/"]) {
    const marker = `/${root}`;
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) return normalized.slice(index + 1);
    if (normalized.startsWith(root)) return normalized;
  }
  return normalized.replace(/^\//u, "");
};
const finding = (checkId: string, path: string, message: string, line?: number): InspectorFinding => createFinding({
  checkId,
  lawId: LAW_ID,
  clauseId: CLAUSE_ID,
  filePath: path,
  message,
  ...(line ? { line } : {}),
});
const propertyCallName = (call: CallExpression): string | null => {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression) ? expression.getName() : null;
};
const identifierName = (node: Node): string | null => {
  if (!Node.isIdentifier(node)) return null;
  return node.getSymbol()?.getName() ?? null;
};
const sensitiveIdentifier = (node: Node): string | null => [
  ...(Node.isIdentifier(node) ? [node] : []),
  ...node.getDescendantsOfKind(SyntaxKind.Identifier),
]
  .map(identifierName)
  .filter((name): name is string => name !== null)
  .find((name) => sensitiveTerms.some((term) => name.toLowerCase().includes(term))) ?? null;

const inspectSensitiveSinks = (source: SourceFile, path: string, findings: InspectorFinding[]): void => {
  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) continue;
    const receiver = expression.getExpression();
    if (identifierName(receiver) !== "console") continue;
    const leaked = call.getArguments().map(sensitiveIdentifier).find((name): name is string => Boolean(name));
    if (leaked) findings.push(finding("system-security/sensitive-console-flow", path, `sensitive identifier ${leaked} reaches console output.`, call.getStartLineNumber()));
  }
  for (const expression of source.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    if (identifierName(expression.getExpression()) !== "Error") continue;
    const leaked = expression.getArguments().map(sensitiveIdentifier).find((name): name is string => Boolean(name));
    if (leaked) findings.push(finding("system-security/sensitive-error-flow", path, `sensitive identifier ${leaked} reaches an error string.`, expression.getStartLineNumber()));
  }
};

const inspectExternalResponseCasts = (source: SourceFile, path: string, findings: InspectorFinding[]): void => {
  if (!path.startsWith("src/")) return;
  for (const cast of source.getDescendantsOfKind(SyntaxKind.AsExpression)) {
    const jsonCalls = [cast.getExpression(), ...cast.getExpression().getDescendants()]
      .filter((node): node is CallExpression => Node.isCallExpression(node) && propertyCallName(node) === "json");
    if (jsonCalls.length === 0) continue;
    if (cast.getTypeNodeOrThrow().getKind() === SyntaxKind.UnknownKeyword) continue;
    findings.push(finding(
      "system-security/external-response-type-forgery",
      path,
      "response.json() must remain unknown until an explicit schema or structural validator proves its internal identity.",
      cast.getStartLineNumber(),
    ));
  }
};

const propertyName = (node: Node): string | null => {
  if (Node.isPropertySignature(node) || Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) return node.getName();
  return null;
};
const inspectCloudControlContract = (source: SourceFile, path: string, findings: InspectorFinding[]): void => {
  if (!path.startsWith("src/plugins/xuanxue-ai-production/") || !path.includes("cloud")) return;
  for (const node of source.getDescendants()) {
    const name = propertyName(node);
    if (name && forbiddenCloudControlFields.has(name)) {
      findings.push(finding("system-security/cloud-browser-control-field", path, `Cloud contract exposes forbidden Browser control field ${name}.`, node.getStartLineNumber()));
    }
  }
};

const inspectExtensionDependencies = (source: SourceFile, path: string, findings: InspectorFinding[]): void => {
  if (!path.startsWith("src/lib/browser/chrome-extension/")) return;
  for (const declaration of source.getImportDeclarations()) {
    const target = declaration.getModuleSpecifierValue();
    if (target.includes("plugins/xuanxue-ai-production") || target.includes("online-ai") || target.includes("cloud-credential")) {
      findings.push(finding("system-security/extension-owner-bypass", path, `Extension imports forbidden Cloud or Provider authority ${target}.`, declaration.getStartLineNumber()));
    }
  }
};

const inspectUnsafeFallbacks = (source: SourceFile, path: string, findings: InspectorFinding[]): void => {
  const securityBoundary = path.startsWith("src/plugins/xuanxue-ai-production/")
    || path.startsWith("src/lib/browser/chrome-extension/")
    || path.startsWith("src/capabilities/ai-input-gateway/");
  if (!securityBoundary) return;
  for (const clause of source.getDescendantsOfKind(SyntaxKind.CatchClause)) {
    for (const statement of clause.getBlock().getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
      const value = statement.getExpression();
      const unsafe = Boolean(value && Node.isTrueLiteral(value))
        || (value && Node.isStringLiteral(value) && ["allowed", "eligible", "ready", "success"].includes(value.getLiteralValue()));
      if (unsafe) findings.push(finding("system-security/unsafe-catch-fallback", path, "security boundary catch branch fails open.", statement.getStartLineNumber()));
    }
  }
};

export const inspectSystemSecurityProject = (project: Project): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  for (const source of project.getSourceFiles().filter((file) => !file.isDeclarationFile())) {
    const path = sourcePath(source);
    if (!path.startsWith("src/") && !path.startsWith("scripts/")) continue;
    inspectSensitiveSinks(source, path, findings);
    inspectExternalResponseCasts(source, path, findings);
    inspectCloudControlContract(source, path, findings);
    inspectExtensionDependencies(source, path, findings);
    inspectUnsafeFallbacks(source, path, findings);
  }
  return findings.sort((left, right) => (left.filePath ?? "").localeCompare(right.filePath ?? "") || (left.line ?? 0) - (right.line ?? 0) || left.checkId.localeCompare(right.checkId));
};

const evaluate = (context: InspectorContext): InspectorEvaluation => {
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    coverage: [staticLawCoverage(LAW_ID, 6, [
      "static.ast", "static.types", "static.contract", "static.dependency", "static.config",
    ], [])],
    reportedLawIds: context.planEntry.lawIds,
    findings: inspectSystemSecurityProject(context.project),
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, evaluate);
};
