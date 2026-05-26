import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import type {
  AiProviderAdapter,
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../../src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  createDeepResearchRecordStore,
  runDeepResearchAnalysis,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";

const decompositionResponse = JSON.stringify({
  mainQuestion: "Should the company enter a new logistics software market?",
  questionType: "business",
  decompositionStrategy: "Split market demand from execution readiness.",
  missingInfo: [],
  subQuestions: [
    {
      id: "Q1",
      title: "Demand support",
      questionText: "Is there durable demand?",
      whyItMatters: "Entry should stop without real demand.",
      decisionWeight: "decisive",
      scope: "Demand over the next 24 months.",
      omissionRisk: "Without this, the job cannot justify an answer.",
      promptBundle: {
        promptBundleId: "Q1-demand-prompt-bundle",
        promptRole: "sub_question_analysis",
        taskInstruction: "Analyze demand durability.",
        questionSpecificFocus: ["demand"],
        mustUseInputs: ["user question", "subQuestion"],
        mustNotDo: ["Do not decide the overall recommendation."],
        evidenceOrReasoningNeeds: ["market demand evidence"],
        outputGuidance: {
          preferredFormat: "structured_text",
          requiredContent: ["demand answerText"],
          supplementalContent: [],
          forbiddenContent: ["workflow commands"],
        },
        safetyBoundary: ["No action instructions."],
        languageInstruction: "Respond in English.",
      },
    },
    {
      id: "Q2",
      title: "Execution readiness",
      questionText: "Can execution succeed?",
      whyItMatters: "Entry should stop if execution is impossible.",
      decisionWeight: "high",
      scope: "Execution during the first 12 months.",
      omissionRisk: "Without this, the job cannot judge operating feasibility.",
      promptBundle: {
        promptBundleId: "Q2-execution-prompt-bundle",
        promptRole: "sub_question_analysis",
        taskInstruction: "Analyze execution readiness.",
        questionSpecificFocus: ["execution"],
        mustUseInputs: ["user question", "subQuestion"],
        mustNotDo: ["Do not decide the overall recommendation."],
        evidenceOrReasoningNeeds: ["execution constraints"],
        outputGuidance: {
          preferredFormat: "structured_text",
          requiredContent: ["execution answerText"],
          supplementalContent: [],
          forbiddenContent: ["workflow commands"],
        },
        safetyBoundary: ["No action instructions."],
        languageInstruction: "Respond in English.",
      },
    },
  ],
  finalAdjudicationPromptBundle: {
    promptBundleId: "final-adjudication-prompt-bundle",
    promptRole: "final_adjudication",
    taskInstruction: "Build the final adjudication from the full case file.",
    questionSpecificFocus: ["final answer"],
    mustUseInputs: ["fullCaseFile"],
    mustNotDo: ["Do not ignore missing evidence."],
    evidenceOrReasoningNeeds: ["all sub-question answers"],
    outputGuidance: {
      preferredFormat: "structured_text",
      requiredContent: ["recommendation"],
      supplementalContent: [],
      forbiddenContent: ["workflow commands"],
    },
    safetyBoundary: ["No action instructions."],
    languageInstruction: "Respond in English.",
  },
  htmlReportPromptBundle: {
    promptBundleId: "html-report-prompt-bundle",
    promptRole: "html_report_publisher",
    taskInstruction: "Publish a self-contained HTML report.",
    questionSpecificFocus: ["HTML delivery"],
    mustUseInputs: ["rawFinalAnswerText"],
    mustNotDo: ["Do not change the answer meaning."],
    evidenceOrReasoningNeeds: ["final adjudication"],
    outputGuidance: {
      preferredFormat: "html_document",
      requiredContent: ["full HTML report"],
      supplementalContent: [],
      forbiddenContent: ["scripts"],
    },
    safetyBoundary: ["Self-contained safe HTML only."],
    languageInstruction: "Respond in English.",
  },
  planIntegrityCheck: {
    everySubQuestionHasPromptBundle: true,
    promptBundlesAreQuestionSpecific: true,
    noGenericUniversalPromptBundle: true,
    finalPromptBundleIsQuestionSpecific: true,
    htmlPromptBundleIsQuestionSpecific: true,
    runtimeWillOnlyAddShellConstraints: true,
  },
});

class FailingAnalysisAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  public callCount = 0;

  async feed(_input: AiFeedInput, _context: AiProviderAdapterContext): Promise<AiProviderRawResponse> {
    this.callCount += 1;
    if (this.callCount === 1) {
      return {
        rawText: decompositionResponse,
        modelName: "fixture-model",
        runtimeName: "acceptance-fixture",
        transport: "api",
        webChatUrl: null,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
      };
    }
    if (this.callCount === 2) {
      return {
        rawText: "",
        modelName: "fixture-model",
        runtimeName: "acceptance-fixture",
        transport: "api",
        webChatUrl: null,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
      };
    }
    return {
      rawText: "SHOULD_NOT_BE_CALLED",
      modelName: "fixture-model",
      runtimeName: "acceptance-fixture",
      transport: "api",
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
    };
  }
}

async function main(): Promise<void> {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-stop-on-failure-"));
  const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });
  const adapter = new FailingAnalysisAdapter();
  const aiInputGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: {
      "gemini-api": adapter,
    },
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Should the company enter a new logistics software market?",
      analysisGoal: "Stop immediately when a sub-question has no raw answer.",
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

  assert.equal(adapter.callCount, 2, "Deep Research must stop before the second sub-question or any later stage after an empty analysis answer.");
  assert.equal(result.status, "failed", "Empty analysis answer must terminate the job as failed.");
  assert.equal(result.jobStatus, "failed", "Persisted job status must be failed after an empty analysis answer.");
  assert.equal(result.phase, "ANALYSIS_PARSE", "Failure must stop at the analysis parse stage.");
  assert.equal(result.finalAdjudication, null, "No final adjudication may exist after analysis failure.");
  const store = createDeepResearchRecordStore(dataDir);
  try {
    assert.equal(store.listAnswers({ jobId: result.jobId }).length, 0, "No analysis answers may be persisted after an empty analysis response.");
    assert.equal(store.listExports(result.jobId).length, 0, "No export artifacts may be written after an analysis-stage failure.");
    assert.equal(store.getLatestFinalAdjudication(result.jobId), null, "Final adjudication records must not exist after an analysis-stage failure.");
  } finally {
    store.close();
  }

  process.stdout.write("[ACCEPTANCE][deep-research-subquestion-failure-stop] PASS\n");
}

await main();