import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const governedFiles = [
  "src/plugins/amazon-product-mining/index.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
  "src/plugins/amazon-product-mining/terminal-product-mining-owner.ts",
  "src/mediator/amazon-product-mining-route.ts",
  "src/lib/local-runtime/workbench-marketplace-handles.ts",
] as const;

type Finding = ReturnType<typeof createFinding>;
const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const importedNames = (source: SourceFile, moduleSpecifier: string): Set<string> =>
  new Set(source.getImportDeclarations().filter((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier)
    .flatMap((declaration) => declaration.getNamedImports().map((item) => item.getName())));

const callNames = (source: SourceFile, declarationName: string): string[] => {
  const initializer = source.getVariableDeclaration(declarationName)?.getInitializer();
  if (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer)) return [];
  return initializer.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression)) return String(expression.compilerNode.escapedText);
    return Node.isPropertyAccessExpression(expression) ? expression.getName() : "";
  });
};

const addFinding = (findings: Finding[], lawId: string, filePath: string, message: string): void => {
  findings.push(createFinding({
    checkId: "amazon-product-mining/terminal-authority",
    lawId,
    clauseId: "apex-amazon-product-mining-001-v3-terminal-authority",
    filePath,
    message,
  }));
};

const inspectDomainEvaluation = (context: InspectorContext): Readonly<{
  findings: Finding[];
  evidenceRefs: readonly string[];
}> => {
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-AMAZON-PRODUCT-MINING-001-V3");
  const findings: Finding[] = [];
  for (const filePath of governedFiles) {
    if (!sourceFile(context, filePath)) addFinding(findings, lawId, filePath, `${filePath} must remain in the terminal mining chain.`);
  }
  const ownerPath = "src/plugins/amazon-product-mining/terminal-product-mining-owner.ts";
  const owner = sourceFile(context, ownerPath);
  if (owner) {
    for (const declaration of owner.getImportDeclarations()) {
      const moduleSpecifier = declaration.getModuleSpecifierValue();
      if (moduleSpecifier.includes("lib/browser") || moduleSpecifier.includes("capabilities/dom-automation") || moduleSpecifier.includes("ai-input-gateway")) {
        addFinding(findings, lawId, ownerPath, "The terminal mining owner must not retain a browser, DOM or AI compatibility path.");
      }
    }
  }
  const routePath = "src/mediator/amazon-product-mining-route.ts";
  const route = sourceFile(context, routePath);
  if (route && (!importedNames(route, "../plugins/amazon-product-mining/index.js").has("startAmazonProductMiningMission")
    || !callNames(route, "runAmazonProductMiningRoute").includes("startAmazonProductMiningMission"))) {
    addFinding(findings, lawId, routePath, "The unique mediator must validate and forward to the terminal mining owner facade.");
  }
  return { findings, evidenceRefs: [context.planEntry.ownerInspectorPath, ...governedFiles] };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("amazon-product-mining requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = inspectDomainEvaluation(context);
    return { findings: evaluation.findings, evidenceRefs: evaluation.evidenceRefs };
  });
  return context.checks.output();
};
