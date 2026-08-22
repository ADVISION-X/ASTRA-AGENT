import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const governedFiles = [
  "src/plugins/amazon-invoice-upload/index.ts",
  "src/plugins/amazon-invoice-upload/mission.schema.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.types.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.types.ts",
  "src/plugins/amazon-invoice-upload/terminal-invoice-owner.ts",
  "src/mediator/amazon-invoice-upload-route.ts",
  "src/lib/local-runtime/workbench-amazon-invoice-handle.ts",
] as const;

type Finding = ReturnType<typeof createFinding>;

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const importedNames = (source: SourceFile, moduleSpecifier: string): Set<string> =>
  new Set(source.getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier)
    .flatMap((declaration) => declaration.getNamedImports().map((item) => item.getName())));

const exportedNamesFrom = (source: SourceFile, moduleSpecifier: string): Set<string> =>
  new Set(source.getExportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier)
    .flatMap((declaration) => declaration.getNamedExports().map((item) => item.getName())));

const callNames = (source: SourceFile, declarationName: string): string[] => {
  const initializer = source.getVariableDeclaration(declarationName)?.getInitializer();
  if (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer)) return [];
  return initializer.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression)) return String(expression.compilerNode.escapedText);
    return Node.isPropertyAccessExpression(expression) ? expression.getName() : "";
  });
};

const functionNames = (source: SourceFile): Set<string> => new Set([
  ...source.getFunctions().map((declaration) => declaration.getName()).filter((name): name is string => Boolean(name)),
  ...source.getVariableDeclarations().filter((declaration) => Node.isArrowFunction(declaration.getInitializer()))
    .map((declaration) => declaration.getName()),
]);

const addFinding = (findings: Finding[], lawId: string, filePath: string, message: string): void => {
  findings.push(createFinding({
    checkId: "amazon-invoice-upload/terminal-authority",
    lawId,
    clauseId: "apex-amazon-invoice-upload-001-v2-terminal-authority",
    filePath,
    message,
  }));
};

const inspectTerminalOwner = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const ownerPath = "src/plugins/amazon-invoice-upload/terminal-invoice-owner.ts";
  const owner = sourceFile(context, ownerPath);
  if (!owner) return;
  const requiredExports = [
    "startAmazonInvoiceUploadTask",
    "startAmazonTaxInvoiceDownloadTask",
    "getAmazonInvoiceUploadTaskStatus",
    "getAmazonTaxInvoiceDownloadArtifact",
  ];
  const declarations = functionNames(owner);
  for (const name of requiredExports) {
    if (!declarations.has(name)) addFinding(findings, lawId, ownerPath, `${name} must remain in the sole terminal invoice owner.`);
  }
  for (const declaration of owner.getImportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (moduleSpecifier.includes("lib/browser") || moduleSpecifier.includes("capabilities/dom-automation")) {
      addFinding(findings, lawId, ownerPath, "The terminal invoice owner must not reintroduce a BrowserController or DOM compatibility path.");
    }
  }
};

const inspectEntrypoints = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const indexPath = "src/plugins/amazon-invoice-upload/index.ts";
  const index = sourceFile(context, indexPath);
  if (index && !exportedNamesFrom(index, "./terminal-invoice-owner.js").has("startAmazonInvoiceUploadTask")) {
    addFinding(findings, lawId, indexPath, "The public plugin facade must expose only the terminal invoice owner entry.");
  }
  const routePath = "src/mediator/amazon-invoice-upload-route.ts";
  const route = sourceFile(context, routePath);
  if (route && (!importedNames(route, "../plugins/amazon-invoice-upload/index.js").has("startAmazonInvoiceUploadTask")
    || !callNames(route, "runAmazonInvoiceUploadTaskRoute").includes("startAmazonInvoiceUploadTask"))) {
    addFinding(findings, lawId, routePath, "The unique mediator route must validate input and forward to the terminal owner facade.");
  }
};

const inspectDomainEvaluation = (context: InspectorContext): Readonly<{
  findings: Finding[];
  evidenceRefs: readonly string[];
}> => {
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-AMAZON-INVOICE-UPLOAD-001-V2");
  const findings: Finding[] = [];
  for (const filePath of governedFiles) {
    if (!sourceFile(context, filePath)) addFinding(findings, lawId, filePath, `${filePath} must remain in the terminal invoice chain.`);
  }
  inspectTerminalOwner(context, findings, lawId);
  inspectEntrypoints(context, findings, lawId);
  return { findings, evidenceRefs: [context.planEntry.ownerInspectorPath, ...governedFiles] };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("amazon-invoice-upload requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = inspectDomainEvaluation(context);
    return { findings: evaluation.findings, evidenceRefs: evaluation.evidenceRefs };
  });
  return context.checks.output();
};
