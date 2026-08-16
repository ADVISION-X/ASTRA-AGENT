import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
  type AiProviderAdapter,
} from "../../src/capabilities/ai-input-gateway/index.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-web-chat-restore-"));

const createRequest = (promptContractId: string): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  taskIdentity: {
    labelKey: "amazon_product_mining",
    sourceProject: "amazon-product-mining",
    taskKind: "restore-acceptance",
    sourceTaskId: `${promptContractId}-task`,
  },
  promptPackageId: `${promptContractId}-package`,
  promptContractId,
  expectedOutputSchemaRef: null,
  expectedOutputKind: "text",
  textPrompt: `Acceptance prompt for ${promptContractId}`,
  inputRefs: [],
  modelName: null,
  timeoutMs: 180_000,
  maxInputChars: 30_000,
  maxFileCount: 0,
  requestedBy: "acceptance-test",
  missionId: null,
  runId: null,
  roundId: `${promptContractId}-round`,
});

const restoreFailedAdapter: AiProviderAdapter = {
  providerKind: "gpt-web-chat",
  async feed(request) {
    const conversationUrl =
      `https://chatgpt.com/c/acceptance-${request.promptContractId}`;
    return {
      rawText: request.promptContractId.startsWith("amazon-product-mining-")
        ? JSON.stringify({ keywords: [{ keyword: "door draft stopper", reason: "acceptance" }] })
        : "non amazon response",
      modelName: null,
      runtimeName: "acceptance-gpt-web-chat",
      transport: "web-chat",
      webChatUrl: conversationUrl,
      submissionProof: {
        executionId: `acceptance:${request.promptContractId}`,
        turnMarker: `GRASSEYE_TURN_${request.promptContractId}`,
        transientConversationUrl: conversationUrl,
        canonicalConversationUrl: conversationUrl,
        systemChatTitle: null,
        observedAutoChatTitle: null,
        chatTitleVerifiedAt: null,
        userTurnId: "conversation-turn-1",
        previousAssistantCount: 0,
        previousUserMessageCount: 0,
        submittedAt: new Date().toISOString(),
      },
      sourcePageUrlBeforeFeed: "http://127.0.0.1:4173/",
      restoredSourcePage: false,
      outputRefs: [],
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "acceptance",
    };
  },
};

const sourceHasCallExpression = (sourceFile: SourceFile, identifier: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => {
      const expression = callExpression.getExpression();
      return (Node.isIdentifier(expression)
        && expression.getSymbol()?.getEscapedName().toString() === identifier)
        || (Node.isPropertyAccessExpression(expression) && expression.getName() === identifier);
    });

const sourceHasStartsWithPrefixPolicy = (sourceFile: SourceFile): boolean => {
  const requestPolicy = sourceFile.getVariableDeclaration("isAmazonProductMiningGptRequest")
    ?.getInitializer();
  const prefix = sourceFile.getVariableDeclaration("AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX");
  if (!Node.isFunctionLikeDeclaration(requestPolicy) || !prefix) return false;
  const input = requestPolicy.getParameters()[0];
  if (!input) return false;
  const resolvesTo = (node: import("ts-morph").Node | undefined, declaration: import("ts-morph").Node): boolean => {
    const symbol = node?.getSymbol();
    const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
    return target?.getDeclarations().includes(declaration) ?? false;
  };
  return requestPolicy.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "startsWith") return false;
    const promptContract = expression.getExpression();
    const request = Node.isPropertyAccessExpression(promptContract) ? promptContract.getExpression() : undefined;
    const firstArgument = callExpression.getArguments()[0];
    return Node.isPropertyAccessExpression(promptContract)
      && promptContract.getName() === "promptContractId"
      && Node.isPropertyAccessExpression(request)
      && request.getName() === "request"
      && resolvesTo(request.getExpression(), input)
      && resolvesTo(firstArgument, prefix);
  });
};

try {
  const project = new Project({ tsConfigFilePath: path.resolve("tsconfig.json") });
  const sharedSource = project.getSourceFileOrThrow("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts");
  const recoverySource = project.getSourceFileOrThrow("src/capabilities/ai-input-gateway/providers/web-chat-recovery.ts");
  const openSource = project.getSourceFileOrThrow("src/capabilities/ai-input-gateway/providers/web-chat-open.ts");
  assert.equal(
    sourceHasCallExpression(recoverySource, "isAmazonProductMiningGptRequest"),
    false,
    "Amazon mining must not fork the provider target lifecycle from the single exact provider target.",
  );
  assert.equal(
    sourceHasCallExpression(recoverySource, "closeTarget"),
    false,
    "Web chat restore stage must retain the one exact provider target after response capture.",
  );
  assert.equal(
    sourceHasCallExpression(sharedSource, "restoreAfterWebChatFeed"),
    true,
    "The main web-chat flow must invoke the governed recovery and restoration owner.",
  );
  assert.equal(
    sourceHasStartsWithPrefixPolicy(openSource),
    true,
    "All amazon-product-mining prompt contracts must use the Amazon GPT Web Chat lifecycle policy.",
  );

  const abilityGroup = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: {
      "gpt-web-chat": restoreFailedAdapter,
    },
  });
  const amazonResult = await abilityGroup.execute(createRequest("amazon-product-mining-keyword-generation-v1"));

  assert.equal(
    amazonResult.status,
    "success",
    "Amazon mining must preserve captured GPT Web Chat output even when source tab restoration fails.",
  );
  assert.equal(amazonResult.providerProof.restoredSourcePage, false);
  assert.ok((amazonResult.rawResponseText ?? "").includes("door draft stopper"));

  await new Promise((resolve) => setTimeout(resolve, 2_050));

  const baziResult = await abilityGroup.execute(createRequest("bazi-complete-input-direct-analysis-v1"));

  assert.equal(
    baziResult.status,
    "success",
    "Bazi professional report must preserve captured GPT Web Chat output even when source tab restoration fails.",
  );
  assert.equal(baziResult.providerProof.restoredSourcePage, false);

  await new Promise((resolve) => setTimeout(resolve, 2_050));

  const nonAmazonResult = await abilityGroup.execute(createRequest("deep-research.final-adjudication-v1"));

  assert.equal(
    nonAmazonResult.status,
    "success",
    "Every captured web-chat response must survive source tab restoration failure without a prompt-contract whitelist.",
  );
  assert.equal(nonAmazonResult.providerProof.restoredSourcePage, false);
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-web-chat-restore\n");
