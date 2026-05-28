import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
  type AiProviderAdapter,
} from "../../src/capabilities/ai-input-gateway/index.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-web-chat-restore-"));

const createRequest = (promptContractId: string): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  promptPackageId: `${promptContractId}-package`,
  promptContractId,
  expectedOutputSchemaRef: null,
  textPrompt: `Acceptance prompt for ${promptContractId}`,
  inputRefs: [],
  modelName: null,
  timeoutMs: 180_000,
  maxInputChars: 30_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test",
  missionId: null,
  runId: null,
  roundId: `${promptContractId}-round`,
});

const restoreFailedAdapter: AiProviderAdapter = {
  providerKind: "gpt-web-chat",
  async feed(request) {
    return {
      rawText: request.promptContractId.startsWith("amazon-product-mining-")
        ? JSON.stringify({ keywords: [{ keyword: "door draft stopper", reason: "acceptance" }] })
        : "non amazon response",
      modelName: null,
      runtimeName: "acceptance-gpt-web-chat",
      transport: "web-chat",
      webChatUrl: "https://chatgpt.com/c/acceptance",
      sourcePageUrlBeforeFeed: "http://127.0.0.1:4173/",
      restoredSourcePage: false,
      outputRefs: [],
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "acceptance",
    };
  },
};

try {
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
  assert.ok((amazonResult.normalizedText ?? "").includes("door draft stopper"));

  await new Promise((resolve) => setTimeout(resolve, 2_050));

  const nonAmazonResult = await abilityGroup.execute(createRequest("deep-research.final-adjudication-v1"));

  assert.equal(
    nonAmazonResult.status,
    "review_required",
    "Non-Amazon web chat feeds must still fail closed when source tab restoration fails.",
  );
  assert.equal(
    nonAmazonResult.reviewRequiredReason,
    "review_required: source page restoration failed after web chat feed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-web-chat-restore\n");
