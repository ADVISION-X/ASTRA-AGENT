import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
} from "../../src/capabilities/ai-input-gateway/index.js";
import type {
  AiProviderAdapter,
  AiProviderAdapterContext,
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
      questionType: "business",
      decompositionStrategy: "Use two independent questions so one analysis can fail while the next still completes.",
      missingInfo: [],
      subQuestions: [
        {
          id: "Q1",
          title: "Broken analysis",
          questionText: "What happens when one independent analysis response breaks the contract?",
          whyItMatters: "This proves one local analysis failure does not terminate the entire job.",
          decisionWeight: "high",
          analysisFocus: "Observe how the runtime records and carries one malformed analysis response.",
          requiredEvidence: ["failed interaction", "runtime stage logs"],
          scope: "Parser fault isolation.",
          expectedAnswerShape: "fault-isolation-summary",
          priority: "high",
          omissionRisk: "Without this, the runtime can silently regress to first-failure-wins behavior."
        },
        {
          id: "Q2",
          title: "Healthy analysis",
          questionText: "Can a later independent analysis still persist a structured answer after one earlier failure?",
          whyItMatters: "The final adjudicator needs proof that later sub-questions still run.",
          decisionWeight: "high",
          analysisFocus: "Persist one valid analysis record after the first sub-question fails.",
          requiredEvidence: ["persisted analysis answer", "final adjudication result"],
          scope: "Later sub-question continuity.",
          expectedAnswerShape: "continued-execution-summary",
          priority: "high",
          omissionRisk: "Without this, the job may still look healthy while actually skipping later analysis work."
        }
      ],
      exhaustivenessCheck: {
        keyDimensionsCovered: ["local failure handling", "continued execution"],
        knownBlindSpots: [],
        whyNoMoreQuestionsAreNeeded: "Two sub-questions are sufficient to prove local analysis fault isolation."
      },
      qualitySelfCheck: {
        isNeutral: true,
        hasNoDuplicateQuestions: true,
        hasNoPureFalsificationQuestions: true,
        isReadyForIndependentAnalysis: true,
        isReadyForFinalAdjudication: true
      }
    }),
    '{"subQuestionId":"Q1","answer":"This malformed response should stay local"',
    JSON.stringify({
      subQuestionId: "Q2",
      answer: "A later sub-question still persists a valid independent analysis.",
      coreFinding: "One failed analysis does not stop later sub-questions from running.",
      keyClaims: ["The second analysis still executes."],
      supportingReasons: ["The runtime continues after the first malformed response."],
      counterConditions: ["A full provider outage would still stop all questions."],
      failureCases: ["If every analysis response is malformed, final package review is still required."],
      evidenceMentions: ["analysis interaction", "persisted answer row"],
      evidenceQuality: "moderate",
      assumptions: ["The later prompt still receives a provider response."],
      uncertainties: ["This fixture only proves one failed and one successful sub-question."],
      impactOnFinalAdjudication: "Proceed, but surface the missing analysis gap explicitly.",
      confidence: "medium",
      limitations: ["This uses deterministic fixture output rather than a live provider."],
    }),
    JSON.stringify({
      directAnswer: "Proceed with a review-minded conclusion because one analysis used narrative fallback while another remained fully structured.",
      finalVerdict: "conditional",
      confidence: "medium",
      rankedConclusions: [{
        rank: 1,
        conclusion: "Both independent analyses completed, but one relied on parsed_text_fallback.",
        whyItMatters: "The final adjudicator still has lawful material while keeping formatting drift visible.",
        strength: "moderate",
        appliesTo: ["default_1_n_1_1 flow"],
        doesNotApplyTo: ["all-sub-questions-failed runs"],
        reverseCondition: "If no analysis completes, the job must stay in review_required.",
      }],
      strongConclusions: ["The job continues after one local narrative fallback analysis."],
      conditionalConclusions: ["The final answer must surface which sub-question used parsed_text_fallback."],
      weakOrRejectedClaims: ["A single malformed analysis should kill the whole job."],
      decisiveReasons: ["A later sub-question still produced a valid structured analysis."],
      evidenceGaps: ["One independent analysis relied on parsed_text_fallback instead of structured JSON."],
      reverseConditions: ["If later sub-questions also fail, the final adjudication should no longer proceed."],
      applicability: ["job-flow fault isolation"],
      nonApplicability: ["zero-analysis runs"],
      followUpSignals: ["Track parsed_text_fallback sub-question ids in the final package."],
      multiStageValueAdded: ["The job preserved two usable analyses instead of collapsing at the first parser error."],
      limitations: ["The fixture proves one parsed_text_fallback analysis and one fully structured analysis."],
    }),
  ] as const;

  async feed(input: AiFeedInput, context: AiProviderAdapterContext): Promise<AiProviderRawResponse> {
    let rawText = this.responses[this.cursor];
    if (!rawText && input.promptPackageId.includes("business-html-report")) {
      const artifactDir = path.join(context.dataDir, "acceptance-html-artifacts");
      mkdirSync(artifactDir, { recursive: true });
      const sourceHtmlPath = path.join(artifactDir, "fault-isolation.html");
      writeFileSync(sourceHtmlPath, [
        "<!DOCTYPE html>",
        "<html>",
        "<head><meta charset=\"utf-8\"><title>Business Report</title><style>body{font-family:sans-serif;}</style></head>",
        "<body><main><h1>Fault Isolation</h1><p>The job completed with one parsed_text_fallback analysis and one structured analysis.</p></main></body>",
        "</html>",
      ].join(""), "utf8");
      rawText = `HTML_ARTIFACT_PATH=${sourceHtmlPath}`;
    }
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
      analysisGoal: "Verify sub-question fault isolation and explicit missing-analysis evidence gaps.",
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
    report.evidenceGaps.some((gap) => gap.includes("parsed_text_fallback")),
    `Final report must surface the missing sub-question gap, received ${JSON.stringify(report.evidenceGaps)}.`,
  );

  const store = createDeepResearchRecordStore(dataDir);
  try {
    const interactions = store.listInteractions(result.jobId);
    const fallbackAnalysisInteraction = interactions.find((interaction) =>
      interaction.phase === "analysis" && interaction.parseStatus === "parsed_text_fallback");
    assert(Boolean(fallbackAnalysisInteraction), "Fault isolation fixture must persist one parsed_text_fallback analysis interaction.");

    const answers = store.listAnswers({ jobId: result.jobId, answerKind: "analysis" });
    assert(
      answers.length === 2,
      `Fault isolation fixture should persist both analysis answers once narrative fallback is enabled, received ${answers.length}.`,
    );
  } finally {
    store.close();
  }
};
