import { mkdtempSync } from "node:fs";
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
import {
  createDeepResearchRecordStore,
  runDeepResearchAnalysis,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

class FaultIsolationFixtureAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  private cursor = 0;

  private readonly responses = [
    JSON.stringify({
      mainQuestion: "Can Deep Research continue after one sub-question parse failure?",
      subQuestions: [
        {
          id: "Q1",
          title: "Demand",
          questionText: "What supports the demand case?",
          purpose: "Capture supportive demand evidence.",
          scope: "Demand-side thesis.",
          expectedAnswerShape: "demand-summary",
        },
        {
          id: "Q2",
          title: "Broken response",
          questionText: "What happens when one positive response breaks the contract?",
          purpose: "Prove one sub-question failure stays local.",
          scope: "Parser fault isolation.",
          expectedAnswerShape: "fault-isolation-summary",
        },
        {
          id: "Q3",
          title: "Execution",
          questionText: "What keeps the execution case alive?",
          purpose: "Prove later sub-questions still run.",
          scope: "Execution-side thesis.",
          expectedAnswerShape: "execution-summary",
        },
      ],
    }),
    JSON.stringify({
      subQuestionId: "Q1",
      answer: "Demand support remains visible in enterprise automation budgets.",
      confidence: 0.91,
    }),
    JSON.stringify({
      subQuestionId: "Q1",
      answer: "Demand can still weaken if pilots underperform.",
      confidence: "medium-high",
    }),
    "This sub-question still has analytical value, but the response is not valid JSON.",
    JSON.stringify({
      subQuestionId: "Q3",
      answer: "Execution remains viable when rollout scope stays narrow.",
      confidence: "75%",
    }),
    JSON.stringify({
      subQuestionId: "Q3",
      answer: "Execution can still fail if partners miss deployment targets.",
      confidence: "medium",
    }),
    JSON.stringify({
      executiveConclusion: "Proceed, but treat missing structured evidence as an explicit gap.",
      confidence: "0.78",
    }),
  ] as const;

  async feed(input: AiFeedInput): Promise<AiProviderRawResponse> {
    const rawText = this.responses[this.cursor];
    if (!rawText) {
      throw new Error(`No fault-isolation fixture response available for prompt ${input.promptPackageId} at cursor ${this.cursor}.`);
    }
    this.cursor += 1;
    return {
      rawText,
      modelName: "fixture-gemini-model",
      runtimeName: "deep-research-fault-isolation-fixture-adapter",
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

export const verifySingleSubQuestionFailureDoesNotKillJob = async (): Promise<void> => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-fault-isolation-"));
  const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });
  const aiInputGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: {
      "gemini-api": new FaultIsolationFixtureAdapter(),
    },
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Can the research pipeline continue when one sub-question breaks formatting?",
      analysisGoal: "Verify sub-question fault isolation and final evidence gaps.",
      language: "en",
      maxSubQuestions: 4,
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

  assert(result.status === "success", `Fault isolation fixture should still complete, received ${JSON.stringify(result)}.`);
  const report = result.report;
  if (!report) {
    throw new Error("Fault isolation fixture must still produce a final report.");
  }
  assert(
    report.evidenceGaps.some((gap) => gap.includes("Missing structured positive or falsification record")),
    `Final report must surface the missing sub-question gap, received ${JSON.stringify(report.evidenceGaps)}.`,
  );

  const store = createDeepResearchRecordStore(dataDir);
  try {
    const interactions = store.listInteractions(result.jobId);
    const failedPositiveInteraction = interactions.find((interaction) =>
      interaction.phase === "positive" && interaction.parseStatus !== "parsed");
    assert(Boolean(failedPositiveInteraction), "Fault isolation fixture must persist a failed positive interaction.");

    const answers = store.listAnswers({ jobId: result.jobId });
    assert(
      answers.length === 4,
      `Fault isolation fixture should persist only the two complete sub-question pairs, received ${answers.length}.`,
    );
  } finally {
    store.close();
  }
};