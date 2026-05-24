import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
} from "../../src/capabilities/ai-input-gateway/index.js";
import type {
  AiProviderAdapter,
  AiProviderRawResponse,
} from "../../src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { runDeepResearchAnalysis } from "../../src/plugins/deep-research-analysis/acceptance-surface.js";

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

class MalformedAnalysisFixtureAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  private cursor = 0;

  private readonly responses = [
    JSON.stringify({
      mainQuestion: "Can Deep Research preserve raw AI output before business parsing?",
      questionType: "business",
      decompositionStrategy: "Use one bounded question to test the raw-capture boundary.",
      missingInfo: [],
      subQuestions: [
        {
          id: "Q1",
          title: "Raw capture boundary",
          questionText: "Does capture succeed when the provider returns malformed JSON for one independent analysis?",
          whyItMatters: "This proves transport and business parsing stay separated under the default 1+N+1 flow.",
          decisionWeight: "high",
          analysisFocus: "Check whether raw output is captured before the parser rejects malformed JSON.",
          requiredEvidence: ["runtime logs", "persisted interaction"],
          scope: "Deep Research capture and parse stages.",
          expectedAnswerShape: "raw-capture-boundary-proof",
          priority: "high",
          omissionRisk: "Without this, malformed provider output can be mistaken for a transport failure."
        }
      ],
      exhaustivenessCheck: {
        keyDimensionsCovered: ["capture boundary"],
        knownBlindSpots: [],
        whyNoMoreQuestionsAreNeeded: "One question is enough to prove the capture-parse boundary."
      },
      qualitySelfCheck: {
        isNeutral: true,
        hasNoDuplicateQuestions: true,
        hasNoPureFalsificationQuestions: true,
        isReadyForIndependentAnalysis: true,
        isReadyForFinalAdjudication: true
      }
    }),
    '{"subQuestionId":"Q1","answer":"The provider replied with useful text but malformed JSON."',
  ] as const;

  async feed(input: AiFeedInput): Promise<AiProviderRawResponse> {
    const rawText = this.responses[this.cursor];
    if (!rawText) {
      throw new Error(`No malformed fixture response available for prompt ${input.promptPackageId} at cursor ${this.cursor}.`);
    }
    this.cursor += 1;
    return {
      rawText,
      modelName: "fixture-gemini-model",
      runtimeName: "deep-research-malformed-analysis-fixture-adapter",
      transport: "api",
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      estimatedInputTokens: 256,
      estimatedOutputTokens: 256,
      tokenEstimateUnavailableReason: null,
    };
  }
}

export const verifyMalformedProviderJsonFailsAtParseNotCapture = async (): Promise<void> => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-raw-only-"));
  const runtimeLogBundlePath = path.join(dataDir, "runtime-logs", "deep-research-raw-only.jsonl");
  const runtimeLogger = createRuntimeLogger({
    terminalEnabled: false,
    fileSink: {
      bundlePath: runtimeLogBundlePath,
      redact: false,
    },
  });
  const aiInputGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: {
      "gemini-api": new MalformedAnalysisFixtureAdapter(),
    },
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Can raw capture be separated from independent analysis parsing?",
      analysisGoal: "Verify malformed provider JSON reaches the Deep Research parser under the default 1+N+1 flow.",
      language: "en",
      maxSubQuestions: 2,
      outputFormat: "markdown",
    },
    {
      aiInputGateway,
      runtimeLogger,
      dataDir,
      providerKind: "gemini-api",
      modelName: "fixture-gemini-model",
      timeoutMs: 5_000,
    },
  );

  assert(result.status === "review_required", "Malformed analysis JSON without any completed analysis record should end in review_required.");
  assert(result.phase === "FINAL_PACKAGE_BUILD", `Malformed analysis JSON should block at FINAL_PACKAGE_BUILD after ANALYSIS_PARSE fails, received ${result.phase}.`);
  assert(
    (result.reviewReason ?? "").includes("missing persisted independent analysis records"),
    `Expected missing independent analysis review reason, received ${result.reviewReason}.`,
  );

  const lines = readFileSync(runtimeLogBundlePath, "utf8").trim().split("\n").filter(Boolean);
  const events = lines.map((line) => JSON.parse(line) as {
    eventType: string;
    refs?: { domRef?: string };
    payload?: { stageName?: string };
  });
  const captureCompleted = events.some((event) =>
    event.eventType === "RUNTIME_STAGE_COMPLETED"
    && event.payload?.stageName === "ANALYSIS_CAPTURE"
    && typeof event.refs?.domRef === "string"
    && event.refs.domRef.length > 0,
  );
  const parseFailed = events.some((event) =>
    event.eventType === "RUNTIME_STAGE_FAILED"
    && event.payload?.stageName === "ANALYSIS_PARSE",
  );
  assert(captureCompleted, "Raw provider output must complete ANALYSIS_CAPTURE before parser failure.");
  assert(parseFailed, "Malformed provider JSON must be rejected by ANALYSIS_PARSE.");
};