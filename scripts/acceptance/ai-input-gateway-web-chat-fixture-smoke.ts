import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createAiInputGatewayAbilityGroup,
  type AiProviderAdapter,
} from "../../src/capabilities/ai-input-gateway/index.js";

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-ai-input-gateway-web-"));

const createFakeWebAdapter = (providerKind: "gemini-web-chat" | "gpt-web-chat"): AiProviderAdapter => ({
  providerKind,
  async feed(input) {
    return {
      rawText: JSON.stringify({ ok: true, providerKind, promptPackageId: input.promptPackageId }),
      modelName: input.modelName,
      runtimeName: providerKind,
      transport: "web-chat",
      webChatUrl: providerKind === "gemini-web-chat" ? "https://gemini.google.com/app" : "https://chatgpt.com/",
      sourcePageUrlBeforeFeed: "https://www.facebook.com/reel/example",
      restoredSourcePage: true,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "fixture web chat does not estimate tokens.",
    };
  },
});

const gateway = createAiInputGatewayAbilityGroup({
  dataDir,
  adapters: {
    "gemini-web-chat": createFakeWebAdapter("gemini-web-chat"),
    "gpt-web-chat": createFakeWebAdapter("gpt-web-chat"),
  },
});

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

for (const providerKind of ["gemini-web-chat", "gpt-web-chat"] as const) {
  const result = await gateway.execute({
    providerKind,
    promptPackageId: `acceptance-${providerKind}`,
    promptContractId: "acceptance-web-json-v1",
    expectedOutputSchemaRef: "acceptance.json",
    textPrompt: "Return strict JSON.",
    requestedBy: "acceptance-test",
    missionId: "acceptance-mission",
    runId: "acceptance-run",
    roundId: `acceptance-round-${providerKind}`,
  });
  if (result.status !== "success") {
    throw new Error(`expected ${providerKind} success, got ${result.status}.`);
  }
  if (result.providerProof.transport !== "web-chat" || result.providerProof.restoredSourcePage !== true) {
    throw new Error(`expected ${providerKind} web-chat proof with restored source page.`);
  }
  if (!result.rawOutputRef || !result.rawOutputHash || result.parseStatus !== "json_valid") {
    throw new Error(`expected ${providerKind} raw output proof and json_valid parse.`);
  }
  await wait(2_100);
}

process.stdout.write("[AI-INPUT-GATEWAY-WEB-CHAT-FIXTURE][PASS]\n");
