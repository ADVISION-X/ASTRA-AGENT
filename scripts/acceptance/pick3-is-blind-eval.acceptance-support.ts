import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";

import type { AiFeedInput, AiFeedResult } from "../../src/capabilities/ai-input-gateway/index.js";
import {
  PICK3_LOTTERY_TYPE,
  PICK3_OFFICIAL_SOURCE,
  type Pick3Draw,
} from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.js";

const hashText = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const buildDraw = (index: number): Pick3Draw => {
  const hundreds = index % 10;
  const tens = (index * 3) % 10;
  const ones = (index * 7) % 10;
  const phase = String(260000 + index);
  const rawJson = JSON.stringify({ phase, result: [{ key: "pick3", data: [String(hundreds), String(tens), String(ones)] }] });
  return {
    source: PICK3_OFFICIAL_SOURCE,
    lotteryType: PICK3_LOTTERY_TYPE,
    phase,
    expectedPrizeTime: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T21:30:00+04:00`,
    expectedPrizeTimestamp: String(1_800_000_000_000 + index),
    resultText: `${hundreds} ${tens} ${ones}`,
    hundreds,
    tens,
    ones,
    totalWinningBetCount: null,
    resultDetailJson: "[]",
    rawJson,
    rawHash: `hash-${phase}`,
  };
};

export const buildDatedDraw = (date: string, index: number): Pick3Draw => ({
  ...buildDraw(index),
  phase: date.replaceAll("-", "").slice(2),
  expectedPrizeTime: `${date} 21:30:00`,
  expectedPrizeTimestamp: String(Date.parse(`${date}T17:30:00.000Z`)),
});

export function buildFixtureAiResult(input: {
  gatewayInput: AiFeedInput;
  rawText: string;
}): AiFeedResult {
  const now = new Date().toISOString();
  const inputHash = hashText(JSON.stringify(input.gatewayInput));
  const outputHash = hashText(input.rawText);
  return {
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gpt-web-chat-once",
    providerKind: "gpt-web-chat",
    status: "success",
    normalizedText: input.rawText,
    rawOutputRef: `artifact://pick3-fixture/${outputHash}`,
    rawOutputHash: outputHash,
    parseStatus: "json_valid",
    parsedJson: JSON.parse(input.rawText),
    schemaValidationStatus: "valid",
    providerProof: {
      providerKind: "gpt-web-chat",
      modelName: "fixture-gpt-chat",
      inputHash,
      outputHash,
      inputRefs: input.gatewayInput.inputRefs.map((ref) => ref.id),
      outputRefs: [`artifact://pick3-fixture/${outputHash}`],
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      transport: "web-chat",
      webChatUrl: "https://chatgpt.com/",
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      retryCount: 0,
      cooldownMs: 0,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "fixture",
    },
    failureReason: null,
    reviewRequiredReason: null,
  };
}

export function buildRawTextFixtureAiResult(input: {
  gatewayInput: AiFeedInput;
  rawText: string;
}): AiFeedResult {
  const now = new Date().toISOString();
  const inputHash = hashText(JSON.stringify(input.gatewayInput));
  const outputHash = hashText(input.rawText);
  return {
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gpt-web-chat-once",
    providerKind: "gpt-web-chat",
    status: "success",
    normalizedText: input.rawText,
    rawOutputRef: `artifact://pick3-fixture/${outputHash}`,
    rawOutputHash: outputHash,
    parseStatus: "json_invalid",
    parsedJson: null,
    schemaValidationStatus: "invalid",
    providerProof: {
      providerKind: "gpt-web-chat",
      modelName: "fixture-gpt-chat",
      inputHash,
      outputHash,
      inputRefs: input.gatewayInput.inputRefs.map((ref) => ref.id),
      outputRefs: [`artifact://pick3-fixture/${outputHash}`],
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      transport: "web-chat",
      webChatUrl: "https://chatgpt.com/",
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      retryCount: 0,
      cooldownMs: 0,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "fixture",
    },
    failureReason: null,
    reviewRequiredReason: null,
  };
}

export function buildEmptyFixtureAiResult(input: {
  gatewayInput: AiFeedInput;
}): AiFeedResult {
  const now = new Date().toISOString();
  const inputHash = hashText(JSON.stringify(input.gatewayInput));
  return {
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gpt-web-chat-once",
    providerKind: "gpt-web-chat",
    status: "review_required",
    normalizedText: "",
    rawOutputRef: null,
    rawOutputHash: null,
    parseStatus: "json_invalid",
    parsedJson: null,
    schemaValidationStatus: "invalid",
    providerProof: {
      providerKind: "gpt-web-chat",
      modelName: "fixture-gpt-chat",
      inputHash,
      outputHash: null,
      inputRefs: input.gatewayInput.inputRefs.map((ref) => ref.id),
      outputRefs: [],
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      transport: "web-chat",
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      retryCount: 0,
      cooldownMs: 0,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "fixture",
    },
    failureReason: "empty fixture",
    reviewRequiredReason: "empty fixture",
  };
}

export const visiblePromptPackageId = (input: AiFeedInput): string => {
  const match = input.textPrompt.match(/"promptPackageId": "([^"]+)"/);
  assert.ok(match?.[1], "text prompt must expose neutral promptPackageId");
  return match[1];
};

export function oppositeLabel(label: "front" | "back"): "front" | "back" {
  return label === "front" ? "back" : "front";
}

export function toVisibleLabel(label: "front" | "back"): "lower" | "upper" {
  return label === "front" ? "lower" : "upper";
}
