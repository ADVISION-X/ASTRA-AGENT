import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const webChatProviderHandoffFiles = [
  "src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts",
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

const countPropertyAccessCalls = (sourceFile: SourceFile, propertyName: string): number =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === propertyName;
    })
    .length;

const hasLiteralText = (sourceFile: SourceFile, expected: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === expected)
  || sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    .some((literal) => literal.getLiteralText().includes(expected))
  || sourceFile.getDescendantsOfKind(SyntaxKind.TemplateExpression)
    .some((literal) => [
      literal.getHead().getLiteralText(),
      ...literal.getTemplateSpans().map((span) => span.getLiteral().getLiteralText()),
    ].some((text) => text.includes(expected)));

const hasNumericToken = (sourceFile: SourceFile, expected: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral)
    .some((literal) => literal.getText() === expected);

const hasVariableOrFunction = (sourceFile: SourceFile | undefined, symbolName: string): boolean =>
  Boolean(sourceFile?.getVariableDeclaration(symbolName) || sourceFile?.getFunction(symbolName));

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

type WebChatHandoffFiles = {
  aiFeedInputPackageFile: SourceFile | undefined;
  openFile: SourceFile | undefined;
  sharedFile: SourceFile | undefined;
  supportFile: SourceFile | undefined;
  submitFile: SourceFile | undefined;
  pageActionsFile: SourceFile | undefined;
  composerScriptsFile: SourceFile | undefined;
};

const loadWebChatHandoffFiles = (context: InspectorContext): WebChatHandoffFiles => ({
  aiFeedInputPackageFile: getSourceFile(context, "src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts"),
  openFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-open.ts"),
  sharedFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts"),
  supportFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts"),
  submitFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts"),
  pageActionsFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts"),
  composerScriptsFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts"),
});

const trackWebChatHandoffFiles = (
  inspectedFiles: Set<string>,
  files: WebChatHandoffFiles,
): void => {
  Object.values(files).forEach((sourceFile) => track(inspectedFiles, sourceFile));
  webChatProviderHandoffFiles.forEach((repoPath) => inspectedFiles.add(repoPath));
};

const inspectProviderPageAssertion = (input: {
  files: WebChatHandoffFiles;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if (!input.files.supportFile?.getFunction("assertActiveProviderPage") && !input.files.supportFile?.getVariableDeclaration("assertActiveProviderPage")) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-provider-page-assertion",
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts",
      message: "Web chat provider transport must export assertActiveProviderPage so prompt send/capture cannot run against the APP tab.",
    }));
  }

  if (!input.files.sharedFile) return;
  const sharedImports = getImportedSymbolNames(input.files.sharedFile, "./web-chat-shared-support.js");
  if (!sharedImports.has("assertActiveProviderPage") || countIdentifierCalls(input.files.sharedFile, "assertActiveProviderPage") < 3) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-provider-page-assertion-use",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.files.sharedFile),
      message: "Web chat transport must assert the provider tab before upload, submit, and response capture.",
    }));
  }

  if (!functionHasEarlyResponseNullReturn(input.files.sharedFile, "restoreAfterWebChatFeed")) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-no-pre-response-restore",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.files.sharedFile),
      message: "Web chat transport must not restore the source APP tab before a provider response exists.",
    }));
  }

  if (
    countPropertyAccessCalls(input.files.sharedFile, "closeActiveTab") < 1
    || !hasLiteralText(input.files.sharedFile, "provider tab close")
    || !hasLiteralText(input.files.sharedFile, "provider tab close failed after web chat feed")
  ) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-close-answer-tab",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.files.sharedFile),
      message: "Deep Research GPT web-chat feeds must close the provider answer tab after raw output proof and surface review_required when that close fails.",
      evidence: JSON.stringify({
        closeActiveTabCalls: countPropertyAccessCalls(input.files.sharedFile, "closeActiveTab"),
        hasClosePhase: hasLiteralText(input.files.sharedFile, "provider tab close"),
        hasCloseFailureText: hasLiteralText(input.files.sharedFile, "provider tab close failed after web chat feed"),
      }),
    }));
  }
};

const inspectPromptTextGovernance = (input: {
  aiFeedInputPackageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const sourceFile = input.aiFeedInputPackageFile;
  if (!sourceFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/ai-feed-input-governance-file",
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts",
      message: "Deep Research handoff audit must inspect AI feed input governance at the owner file.",
    }));
    return;
  }

  const forbiddenPatternDeclaration = sourceFile.getVariableDeclaration("SENSITIVE_INPUT_PATTERNS");
  const assertPromptSafe = sourceFile.getVariableDeclaration("assertPromptSafe")?.getInitializer();
  const forbiddenPromptUsages = Node.isArrowFunction(assertPromptSafe) && Node.isBlock(assertPromptSafe.getBody())
    ? assertPromptSafe.getBody()
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .filter((access) => access.getText() === "input.textPrompt")
      .filter((access) => {
        const parent = access.getParent();
        return !(Node.isPropertyAccessExpression(parent) && parent.getExpression() === access && parent.getName() === "length");
      })
      .map((access) => access.getParent()?.getText() ?? access.getText())
    : [];

  if (!forbiddenPatternDeclaration && forbiddenPromptUsages.length === 0) {
    return;
  }

  input.findings.push(createFinding({
    checkId: "deep-research/ai-feed-no-lexical-prompt-filter",
    lawId: input.lawId,
    filePath: getRepoSourcePath(sourceFile),
    message: "AI feed prompt governance must not reject lawful Deep Research prompt text through lexical token/cookie/secret pattern filters; only explicit size and approved input refs may gate textPrompt.",
    evidence: JSON.stringify({
      hasSensitivePatternDeclaration: Boolean(forbiddenPatternDeclaration),
      forbiddenPromptUsages,
    }),
  }));
};

const inspectNewChatIsolation = (input: {
  openFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const openFile = input.openFile;
  if (openFile?.getVariableDeclaration("startFreshChatGptConversation")
    && countIdentifierCalls(openFile, "startFreshChatGptConversation") === 1
    && openFile.getVariableDeclaration("isDeepResearchGptRequest")
    && hasLiteralText(openFile, "新聊天")
    && hasLiteralText(openFile, "open-new-tab")
    && hasLiteralText(openFile, "deep-research.")) return;
  input.findings.push(createFinding({
    checkId: "deep-research/web-chat-new-chat-isolation",
    lawId: input.lawId,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
    message: "Deep Research GPT web-chat feeds must open a fresh provider tab and click ChatGPT new chat before each prompt so provider context is isolated.",
  }));
};

const inspectSubmitDiscipline = (input: {
  submitFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if (!input.submitFile) return;
  const submitImports = getImportedSymbolNames(input.submitFile, "./web-chat-page-actions.js");
  if (!submitImports.has("waitForComposerFocused") || countIdentifierCalls(input.submitFile, "waitForComposerFocused") < 1) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-composer-focus-gate",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.submitFile),
      message: "Web chat prompt submission must verify composer focus before prompt paste.",
    }));
  }

  if (submitImports.has("verifyComposerText") || countIdentifierCalls(input.submitFile, "verifyComposerText") > 0) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-no-exact-composer-text-gate",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.submitFile),
      message: "Web chat prompt submission must not block keyboard submit on exact composer text verification; submit/assistant response proof owns verification.",
    }));
  }

  if (countIdentifierCalls(input.submitFile, "pressReturnInChrome") !== 1 || !hasNumericToken(input.submitFile, "2_000")) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-keyboard-return-submit",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.submitFile),
      message: "Web chat prompt submission must wait 2 seconds after paste and submit with one keyboard Return action.",
    }));
  }

};

const inspectPastedTextCardSubmitPath = (input: {
  submitFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if (!input.submitFile) return;
  const submitImports = getImportedSymbolNames(input.submitFile, "./web-chat-page-actions.js");
  const hasSubmitPath = submitImports.has("waitForChatGptPastedTextCardReady")
    && submitImports.has("clickChatGptSendButton")
    && countIdentifierCalls(input.submitFile, "waitForChatGptPastedTextCardReady") > 0
    && countIdentifierCalls(input.submitFile, "clickChatGptSendButton") > 0;
  if (!hasSubmitPath) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-pasted-text-card-submit-path",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.submitFile),
      message: "GPT Web Chat submission must detect ChatGPT pasted-text composer cards and submit the existing composer payload instead of waiting until response capture times out.",
    }));
  }
};

const inspectPastedTextCardPageActions = (input: {
  pageActionsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const pageActionImports = input.pageActionsFile
    ? getImportedSymbolNames(input.pageActionsFile, "./web-chat-composer-scripts.js")
    : new Set<string>();
  const exposesPageActions = Boolean(input.pageActionsFile)
    && pageActionImports.has("CHATGPT_PASTED_TEXT_CARD_READY_SCRIPT")
    && pageActionImports.has("CLICK_CHATGPT_SEND_BUTTON_SCRIPT")
    && hasVariableOrFunction(input.pageActionsFile, "waitForChatGptPastedTextCardReady")
    && hasVariableOrFunction(input.pageActionsFile, "clickChatGptSendButton");
  if (!exposesPageActions) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-pasted-text-card-page-actions",
      lawId: input.lawId,
      filePath: input.pageActionsFile ? getRepoSourcePath(input.pageActionsFile) : "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
      message: "Provider page actions must expose AST-visible pasted-text-card readiness and send-button actions for GPT Web Chat.",
    }));
  }
};

const inspectPastedTextCardScriptProof = (input: {
  composerScriptsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if (
    !input.composerScriptsFile
    || !input.composerScriptsFile.getVariableDeclaration("CHATGPT_PASTED_TEXT_CARD_READY_SCRIPT")
    || !input.composerScriptsFile.getVariableDeclaration("CLICK_CHATGPT_SEND_BUTTON_SCRIPT")
    || !hasLiteralText(input.composerScriptsFile, "已粘贴的文本")
    || !hasLiteralText(input.composerScriptsFile, "pasted text")
    || !hasLiteralText(input.composerScriptsFile, "chatgpt pasted text card ready for submit")
  ) {
    input.findings.push(createFinding({
      checkId: "deep-research/web-chat-pasted-text-card-script-proof",
      lawId: input.lawId,
      filePath: input.composerScriptsFile ? getRepoSourcePath(input.composerScriptsFile) : "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts",
      message: "Composer scripts must contain the production-proven ChatGPT pasted-text card detector and send button action.",
    }));
  }
};

export const inspectWebChatProviderHandoff = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const files = loadWebChatHandoffFiles(input.context);
  trackWebChatHandoffFiles(input.inspectedFiles, files);
  inspectPromptTextGovernance({
    aiFeedInputPackageFile: files.aiFeedInputPackageFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectProviderPageAssertion({ files, findings: input.findings, lawId: input.lawId });
  inspectNewChatIsolation({ openFile: files.openFile, findings: input.findings, lawId: input.lawId });
  inspectSubmitDiscipline({
    submitFile: files.submitFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectPastedTextCardSubmitPath({ submitFile: files.submitFile, findings: input.findings, lawId: input.lawId });
  inspectPastedTextCardPageActions({ pageActionsFile: files.pageActionsFile, findings: input.findings, lawId: input.lawId });
  inspectPastedTextCardScriptProof({ composerScriptsFile: files.composerScriptsFile, findings: input.findings, lawId: input.lawId });
};
