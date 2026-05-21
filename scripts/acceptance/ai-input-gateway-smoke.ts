import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createAiInputGatewayAbilityGroup,
  type AiProviderAdapter,
} from "../../src/capabilities/ai-input-gateway/index.js";

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-ai-input-gateway-"));

const fakeGeminiApiAdapter: AiProviderAdapter = {
  providerKind: "gemini-api",
  async feed() {
    return {
      rawText: JSON.stringify({ ok: true, source: "fake-gemini-api" }),
      modelName: "fake-gemini",
      runtimeName: "fake-gemini-api",
      transport: "api",
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      estimatedInputTokens: 8,
      estimatedOutputTokens: 12,
      tokenEstimateUnavailableReason: null,
    };
  },
};

const gateway = createAiInputGatewayAbilityGroup({
  dataDir,
  adapters: { "gemini-api": fakeGeminiApiAdapter },
});

const result = await gateway.execute({
  providerKind: "gemini-api",
  promptPackageId: "acceptance-gemini-api",
  promptContractId: "acceptance-json-v1",
  expectedOutputSchemaRef: "acceptance.json",
  textPrompt: "Return strict JSON.",
  requestedBy: "acceptance-test",
  missionId: "acceptance-mission",
  runId: "acceptance-run",
  roundId: "acceptance-round-api",
});

if (result.status !== "success") {
  throw new Error(`expected success, got ${result.status}: ${result.failureReason ?? result.reviewRequiredReason}`);
}
if (!result.rawOutputRef || !result.rawOutputHash) {
  throw new Error("expected rawOutputRef and rawOutputHash.");
}
if (result.parseStatus !== "json_valid") {
  throw new Error(`expected json_valid, got ${result.parseStatus}.`);
}

process.stdout.write("[AI-INPUT-GATEWAY-SMOKE][PASS]\n");
