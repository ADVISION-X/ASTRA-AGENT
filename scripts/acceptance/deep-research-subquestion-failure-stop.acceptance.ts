import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
    AiProviderAdapter,
    AiProviderAdapterContext,
    AiProviderRawResponse,
} from "../../src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import { createAiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { runDeepResearchAnalysis } from "../../src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.js";
import { createDeepResearchRecordStore } from "../../src/plugins/deep-research-analysis/deep-research-analysis.records.js";

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

class EmptyAnalysisAdapter implements AiProviderAdapter {
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

class RawParseFailureAnalysisAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  public callCount = 0;

  async feed(_input: AiFeedInput, _context: AiProviderAdapterContext): Promise<AiProviderRawResponse> {
    this.callCount += 1;
    const responses = [
      decompositionResponse,
      JSON.stringify({
        answerText: "Q1 raw content is usable even though the parser rejects the envelope.",
        indexNotes: ["raw Q1 demand note"],
      }),
      [
        "ANSWER_TEXT_BEGIN",
        "Q2 structured answer completed after Q1 produced raw-only content.",
        "ANSWER_TEXT_END",
        "INDEX_JSON_BEGIN",
        JSON.stringify({ indexNotes: ["structured Q2 execution note"] }),
        "INDEX_JSON_END",
      ].join("\n"),
      "Final adjudication considered Q1 raw-only analysis and Q2 structured analysis.",
      [
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Report</title></head><body><main><h1>Report</h1>",
        "<section id=\"summary-answer\"><h2>Summary Answer</h2><p>Raw-available analysis reached final delivery.</p></section>",
        "<section id=\"forensics-process\"><h2>Forensics Process</h2><p>Q1 raw response was preserved after parser rejection and Q2 parsed successfully.</p></section>",
        "<section id=\"business-conclusion\"><h2>Final Conclusion</h2><p>Continue with raw-preserved evidence visible.</p></section>",
        "<section id=\"n-stage-questions-and-answers\"><h2>N-stage Questions and Answers</h2><p>Q1 raw-only and Q2 structured materials are available.</p></section>",
        "</main></body></html>",
      ].join(""),
    ];
    const rawText = responses[this.callCount - 1];
    if (rawText === undefined) {
      throw new Error(`Unexpected prompt call ${this.callCount}.`);
    }
    return {
      rawText,
      modelName: "fixture-model",
      runtimeName: "acceptance-fixture",
      transport: "api",
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
    };
  }
}

async function verifyEmptyAnalysisStillStops(): Promise<void> {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-stop-on-failure-"));
  const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });
  const adapter = new EmptyAnalysisAdapter();
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
}

async function verifyRawParseFailureContinues(): Promise<void> {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-raw-parse-continue-"));
  const runtimeLogger = createRuntimeLogger({ terminalEnabled: false });
  const adapter = new RawParseFailureAnalysisAdapter();
  const aiInputGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: {
      "gemini-api": adapter,
    },
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Should the company enter a new logistics software market?",
      analysisGoal: "Continue to final adjudication when raw analysis exists but structured parsing fails.",
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

  assert.equal(adapter.callCount, 5, "Raw analysis parse failure must continue through Q2, final adjudication, and HTML report.");
  assert.equal(result.status, "success", "Non-empty raw analysis parse failure must not terminate the job.");
  assert.equal(result.jobStatus, "completed", "Persisted job status must complete when raw parse failure reaches final delivery.");
  assert.equal(result.phase, "COMPLETE", "Raw parse failure continuation must finish the primary chain.");
  assert(result.finalAdjudication, "Final adjudication must exist after raw parse failure continuation.");

  const store = createDeepResearchRecordStore(dataDir);
  try {
    const interactions = store.listInteractions(result.jobId);
    const rawFailedInteraction = interactions.find((interaction) =>
      interaction.phase === "analysis"
      && interaction.parseStatus === "parse_failed_raw_available"
    );
    assert(rawFailedInteraction, "The raw parse failure interaction must be persisted.");
    assert.match(rawFailedInteraction.rawResponseText, /Q1 raw content is usable/u);
    assert.equal(store.listAnswers({ jobId: result.jobId, answerKind: "analysis" }).length, 1, "Only the parsed Q2 answer should become a structured answer.");
    assert.equal(store.listExports(result.jobId).length, 6, "Completed raw-available run must write every export artifact.");
    assert(store.getLatestFinalAdjudication(result.jobId), "Final adjudication record must be persisted after raw-available continuation.");
  } finally {
    store.close();
  }
}

async function main(): Promise<void> {
  await verifyEmptyAnalysisStillStops();
  await verifyRawParseFailureContinues();

  process.stdout.write("[ACCEPTANCE][deep-research-subquestion-failure-stop] PASS\n");
}

await main();
