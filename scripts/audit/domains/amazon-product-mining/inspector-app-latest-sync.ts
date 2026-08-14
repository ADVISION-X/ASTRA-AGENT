import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const HOME_CLIENT_PATH = "src/app/workbench-home-client.ts";
const REVIEW_CLIENT_PATH = "src/app/workbench-home-amazon-product-mining-review-client.ts";

const getEmbeddedClientScriptText = (clientFile: SourceFile, variableName: string): string => {
  const initializer = clientFile.getVariableDeclaration(variableName)?.getInitializer();
  if (!initializer) return "";
  const noSubstitutionTemplate = initializer.asKind(SyntaxKind.NoSubstitutionTemplateLiteral);
  if (noSubstitutionTemplate) return noSubstitutionTemplate.getLiteralText();
  const templateExpression = initializer.asKind(SyntaxKind.TemplateExpression);
  if (!templateExpression) return "";
  return [
    templateExpression.getHead().getLiteralText(),
    ...templateExpression.getTemplateSpans().map((span) => span.getLiteral().getLiteralText()),
  ].join("\n");
};

const getArrowFunctionDeclaration = (sourceFile: SourceFile, name: string) =>
  sourceFile.getVariableDeclaration(name)?.getInitializerIfKind(SyntaxKind.ArrowFunction);

const arrowFunctionCalls = (sourceFile: SourceFile, functionName: string, calledName: string): boolean =>
  getArrowFunctionDeclaration(sourceFile, functionName)
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => astExpressionPath(callExpression.getExpression()) === calledName) ?? false;

const objectLiteralHasProperty = (sourceFile: SourceFile, variableName: string, propertyName: string): boolean => {
  const objectLiteral = sourceFile.getVariableDeclaration(variableName)?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  return objectLiteral?.getProperties().some((property) => {
    if (!Node.isPropertyAssignment(property)) return false;
    const nameNode = property.getNameNode();
    return Node.isIdentifier(nameNode) && astIdentifierName(nameNode) === propertyName;
  }) ?? false;
};

const hasLatestTabRefreshHandler = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "addEventListener") return false;
    const [eventName, handler] = callExpression.getArguments();
    if (!Node.isStringLiteral(eventName) || eventName.getLiteralValue() !== "click") return false;
    if (!Node.isArrowFunction(handler)) return false;
    const hasLatestGuard = handler.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binaryExpression) => {
      const left = binaryExpression.getLeft();
      const right = binaryExpression.getRight();
      return astExpressionPath(left) === "tab.dataset.amazonProductMiningPage"
        && Node.isStringLiteral(right)
        && right.getLiteralValue() === "latest";
    });
    const refreshesLatest = handler.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((nestedCall) => astExpressionPath(nestedCall.getExpression()) === "refreshAmazonProductMiningLatest");
    return hasLatestGuard && refreshesLatest;
  });

const controlsLatestSummaryEmptyState = (sourceFile: SourceFile): boolean =>
  Boolean(getArrowFunctionDeclaration(sourceFile, "setAmazonProductMiningLatestSummaryState"))
    && arrowFunctionCalls(sourceFile, "renderAmazonProductMiningSummary", "setAmazonProductMiningLatestSummaryState");

export const inspectWorkbenchHomeClientLatestSync = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const clientFile = context.project.getSourceFile(resolveFromRepo(HOME_CLIENT_PATH));
  const reviewClientFile = context.project.getSourceFile(resolveFromRepo(REVIEW_CLIENT_PATH));
  if (!clientFile || !reviewClientFile) return;
  inspectedFiles.add(getRepoSourcePath(clientFile));
  inspectedFiles.add(getRepoSourcePath(reviewClientFile));
  const inlineClient = context.project.createSourceFile(
    "__amazon_product_mining_workbench_home_client_inline.ts",
    getEmbeddedClientScriptText(clientFile, "WORKBENCH_HOME_CLIENT"),
    { overwrite: true },
  );
  const inlineReviewClient = context.project.createSourceFile(
    "__amazon_product_mining_review_client_inline.ts",
    getEmbeddedClientScriptText(reviewClientFile, "AMAZON_PRODUCT_MINING_REVIEW_CLIENT"),
    { overwrite: true },
  );
  const hasPollingContract =
    objectLiteralHasProperty(inlineClient, "state", "amazonProductMiningPoll")
    && Boolean(getArrowFunctionDeclaration(inlineClient, "startAmazonProductMiningPolling"))
    && Boolean(getArrowFunctionDeclaration(inlineClient, "stopAmazonProductMiningPolling"))
    && Boolean(getArrowFunctionDeclaration(inlineClient, "pollAmazonProductMiningTask"))
    && arrowFunctionCalls(inlineClient, "startAmazonProductMining", "startAmazonProductMiningPolling")
    && arrowFunctionCalls(inlineClient, "refreshAmazonProductMiningLatest", "startAmazonProductMiningPolling")
    && arrowFunctionCalls(inlineClient, "pollAmazonProductMiningTask", "stopAmazonProductMiningPolling");
  if (!hasPollingContract) {
    findings.push(createFinding({
      checkId: "amazon-mining/workbench-home-client-ast-polling-contract",
      lawId,
      filePath: HOME_CLIENT_PATH,
      message: "workbench-home-client.ts must AST-define Amazon Product Mining polling, latest refresh polling, and terminal stop behavior.",
    }));
  }
  if (!hasLatestTabRefreshHandler(inlineClient)) {
    findings.push(createFinding({
      checkId: "amazon-mining/workbench-home-client-ast-latest-tab-refresh",
      lawId,
      filePath: HOME_CLIENT_PATH,
      message: "Latest Task tab must AST-call refreshAmazonProductMiningLatest instead of only toggling the local surface.",
    }));
  }
  if (!controlsLatestSummaryEmptyState(inlineReviewClient)) {
    findings.push(createFinding({
      checkId: "amazon-mining/workbench-latest-summary-empty-state-ast",
      lawId,
      filePath: REVIEW_CLIENT_PATH,
      message: "renderAmazonProductMiningSummary must AST-call setAmazonProductMiningLatestSummaryState so real tasks hide stale empty-state copy.",
    }));
  }
};
