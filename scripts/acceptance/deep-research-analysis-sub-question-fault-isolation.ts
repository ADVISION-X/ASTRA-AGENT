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
      directAnswer: "Proceed with a review-minded conclusion because one analysis is missing but another completed.",
      finalVerdict: "conditional",
      confidence: "medium",
      rankedConclusions: [{
        rank: 1,
        conclusion: "At least one independent analysis completed successfully.",
        whyItMatters: "The final adjudicator still has lawful material to work with.",
        strength: "moderate",
        appliesTo: ["default_1_n_1 flow"],
        doesNotApplyTo: ["all-sub-questions-failed runs"],
        reverseCondition: "If no analysis completes, the job must stay in review_required.",
      }],
      strongConclusions: ["The job continues after one local analysis failure."],
      conditionalConclusions: ["The final answer must surface the missing analysis gap."],
      weakOrRejectedClaims: ["A single malformed analysis should kill the whole job."],
      decisiveReasons: ["A later sub-question still produced a valid structured analysis."],
      evidenceGaps: ["Missing structured independent analysis record for the failed sub-question."],
      reverseConditions: ["If later sub-questions also fail, the final adjudication should no longer proceed."],
      applicability: ["job-flow fault isolation"],
      nonApplicability: ["zero-analysis runs"],
      followUpSignals: ["Track missingAnalysisSubQuestionIds in the final package."],
      multiStageValueAdded: ["The job preserved one usable analysis instead of collapsing at the first parser error."],
      limitations: ["The fixture only proves one failed and one successful analysis."],
    }),
    JSON.stringify({
      deckTitle: "Fault Isolation Decision Deck",
      deckSubtitle: "One failed analysis did not kill the run",
      audience: "internal",
      sourceDecisionPackageId: "fault-isolation-package",
      sourceFinalReportId: "fault-isolation-report",
      verdictPreservationCheck: {
        directAnswerPreserved: true,
        finalVerdictPreserved: true,
        confidencePreserved: true,
        rankedConclusionsPreserved: true,
        reverseConditionsPreserved: true,
        evidenceGapsPreserved: true,
        limitationsPreserved: true,
        noNewFactsAdded: true,
      },
      slides: [
        {
          slideNumber: 1,
          slideType: "cover",
          title: "Fault Isolation",
          headline: "The run continues after one malformed analysis response.",
          bullets: ["One analysis failed locally.", "A later analysis still persisted."],
          visualSuggestion: "Cover banner.",
          speakerNotes: "State the continuity proof.",
          evidenceRefs: ["failed interaction"],
          mustNotDrop: ["local analysis failure"],
        },
        {
          slideNumber: 2,
          slideType: "decision",
          title: "Decision",
          headline: "Proceed with a review-minded conclusion because one analysis is missing but another completed.",
          bullets: ["Keep the missing-analysis gap explicit.", "Do not pretend the run was perfect."],
          visualSuggestion: "Decision card.",
          speakerNotes: "Preserve the conditional verdict.",
          evidenceRefs: ["persisted answer row"],
          mustNotDrop: ["conditional verdict"],
        },
        {
          slideNumber: 3,
          slideType: "ranking",
          title: "Ranked Conclusions",
          headline: "At least one independent analysis completed successfully.",
          bullets: ["The final adjudicator still had lawful material to work with."],
          visualSuggestion: "Ranked list.",
          speakerNotes: "Explain why completion remained lawful.",
          evidenceRefs: ["persisted answer row"],
          mustNotDrop: ["ranked conclusions"],
        },
        {
          slideNumber: 4,
          slideType: "logic_map",
          title: "Why The Run Survived",
          headline: "Later valid analysis preserved the job-flow chain.",
          bullets: ["The second analysis still executes.", "The runtime continues after the first malformed response."],
          visualSuggestion: "Simple logic path.",
          speakerNotes: "Tie parser isolation to job continuity.",
          evidenceRefs: ["runtime stage logs"],
          mustNotDrop: ["continued execution"],
        },
        {
          slideNumber: 5,
          slideType: "risk",
          title: "Risks And Reverse Conditions",
          headline: "If later sub-questions also fail, final adjudication should no longer proceed.",
          bullets: ["A full provider outage would still stop all questions."],
          visualSuggestion: "Risk strip.",
          speakerNotes: "Make the reverse condition explicit.",
          evidenceRefs: ["runtime stage logs"],
          mustNotDrop: ["reverse conditions"],
        },
        {
          slideNumber: 6,
          slideType: "limitation",
          title: "Evidence Gaps And Limitations",
          headline: "The failed sub-question remains an explicit gap.",
          bullets: ["Missing structured independent analysis record for the failed sub-question.", "The fixture only proves one failed and one successful analysis."],
          visualSuggestion: "Gap list.",
          speakerNotes: "Do not hide the missing analysis gap.",
          evidenceRefs: ["failed interaction"],
          mustNotDrop: ["evidence gaps", "limitations"],
        },
        {
          slideNumber: 7,
          slideType: "signal",
          title: "Follow-Up Signals",
          headline: "Track missingAnalysisSubQuestionIds in the final package.",
          bullets: ["Monitor whether later sub-questions still persist after one parse failure."],
          visualSuggestion: "Signal tracker.",
          speakerNotes: "Turn the continuity proof into an observable runtime signal.",
          evidenceRefs: ["runtime stage logs"],
          mustNotDrop: ["follow-up signals"],
        },
        {
          slideNumber: 8,
          slideType: "reference",
          title: "References",
          headline: "All slides trace back to persisted runtime evidence.",
          bullets: ["failed interaction", "runtime stage logs", "persisted answer row"],
          visualSuggestion: "Reference appendix.",
          speakerNotes: "Close with the persisted evidence trail.",
          evidenceRefs: ["failed interaction", "runtime stage logs", "persisted answer row"],
          mustNotDrop: ["references"],
        },
      ],
      deckWarnings: [],
      contentPreservationSummary: {
        usedRankedConclusionCount: 1,
        usedReverseConditionCount: 1,
        usedEvidenceGapCount: 1,
        usedReferenceCount: 3,
        omittedItems: [],
      },
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
    report.evidenceGaps.some((gap) => gap.includes("Missing structured independent analysis record")),
    `Final report must surface the missing sub-question gap, received ${JSON.stringify(report.evidenceGaps)}.`,
  );

  const store = createDeepResearchRecordStore(dataDir);
  try {
    const interactions = store.listInteractions(result.jobId);
    const failedAnalysisInteraction = interactions.find((interaction) =>
      interaction.phase === "analysis" && interaction.parseStatus !== "parsed");
    assert(Boolean(failedAnalysisInteraction), "Fault isolation fixture must persist a failed analysis interaction.");

    const answers = store.listAnswers({ jobId: result.jobId, answerKind: "analysis" });
    assert(
      answers.length === 1,
      `Fault isolation fixture should persist only the single complete analysis answer, received ${answers.length}.`,
    );
  } finally {
    store.close();
  }
};