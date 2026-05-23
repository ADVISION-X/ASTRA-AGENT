import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const webChatProviderHandoffFiles = [
  "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
] as const;

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const track = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
};

const getImportedSymbolNames = (sourceFile: SourceFile, moduleSuffix: string): Set<string> => {
  const symbolNames = new Set<string>();
  sourceFile.getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue().endsWith(moduleSuffix))
    .forEach((declaration) => declaration.getNamedImports()
      .forEach((namedImport) => symbolNames.add(namedImport.getName())));
  return symbolNames;
};

const countIdentifierCalls = (sourceFile: SourceFile, symbolName: string): number =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => {
      const expression = call.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === symbolName;
    })
    .length;

const functionHasEarlyResponseNullReturn = (sourceFile: SourceFile, functionName: string): boolean => {
  const declaration = sourceFile.getVariableDeclaration(functionName);
  const initializer = declaration?.getInitializer();
  if (!initializer || !Node.isArrowFunction(initializer)) return false;
  const body = initializer.getBody();
  if (!Node.isBlock(body)) return false;
  return body.getStatements().some((statement) => {
    if (!Node.isIfStatement(statement)) return false;
    const expression = statement.getExpression();
    if (!Node.isPrefixUnaryExpression(expression) || expression.getOperatorToken() !== SyntaxKind.ExclamationToken) {
      return false;
    }
    const operand = expression.getOperand();
    return Node.isPropertyAccessExpression(operand)
      && operand.getText() === "input.response"
      && statement.getThenStatement().getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;
  });
};

export const inspectWebChatProviderHandoff = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const sharedFile = getSourceFile(input.context, "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts");
  const supportFile = getSourceFile(input.context, "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts");
  const submitFile = getSourceFile(input.context, "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts");
  const pageActionsFile = getSourceFile(input.context, "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts");

  [sharedFile, supportFile, submitFile, pageActionsFile].forEach((sourceFile) => track(input.inspectedFiles, sourceFile));
  webChatProviderHandoffFiles.forEach((repoPath) => input.inspectedFiles.add(repoPath));

  if (!supportFile?.getFunction("assertActiveProviderPage") && !supportFile?.getVariableDeclaration("assertActiveProviderPage")) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-provider-page-assertion",
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts",
      message: "Web chat provider transport must export assertActiveProviderPage so prompt send/capture cannot run against the APP tab.",
    }));
  }

  if (!sharedFile) return;
  const sharedImports = getImportedSymbolNames(sharedFile, "./web-chat-shared-support.js");
  if (!sharedImports.has("assertActiveProviderPage") || countIdentifierCalls(sharedFile, "assertActiveProviderPage") < 3) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-provider-page-assertion-use",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sharedFile),
      message: "Web chat transport must assert the provider tab before upload, submit, and response capture.",
    }));
  }

  if (!functionHasEarlyResponseNullReturn(sharedFile, "restoreAfterWebChatFeed")) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-no-pre-response-restore",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sharedFile),
      message: "Web chat transport must not restore the source APP tab before a provider response exists.",
    }));
  }

  if (!submitFile) return;
  const submitImports = getImportedSymbolNames(submitFile, "./web-chat-page-actions.js");
  if (!submitImports.has("waitForComposerFocused") || countIdentifierCalls(submitFile, "waitForComposerFocused") < 1) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-composer-focus-gate",
      lawId: input.lawId,
      filePath: getRepoSourcePath(submitFile),
      message: "Web chat prompt submission must verify composer focus before prompt paste.",
    }));
  }

  if (submitImports.has("verifyComposerText") || countIdentifierCalls(submitFile, "verifyComposerText") > 0) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-no-exact-composer-text-gate",
      lawId: input.lawId,
      filePath: getRepoSourcePath(submitFile),
      message: "Web chat prompt submission must not block keyboard submit on exact composer text verification; submit/assistant response proof owns verification.",
    }));
  }

  if (countIdentifierCalls(submitFile, "pressReturnInChrome") !== 1 || !submitFile.getText().includes("2_000")) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-keyboard-return-submit",
      lawId: input.lawId,
      filePath: getRepoSourcePath(submitFile),
      message: "Web chat prompt submission must wait 2 seconds after paste and submit with one keyboard Return action.",
    }));
  }
};
