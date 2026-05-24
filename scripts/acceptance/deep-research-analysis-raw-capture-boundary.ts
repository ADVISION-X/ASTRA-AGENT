import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
  if (!condition) throw new Error(message);
};

class MalformedAnalysisFixtureAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  private cursor = 0;

  constructor(private readonly pptxFixturePath: string) {}

  private readonly responses = () => [
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
          whyItMatters: "This proves transport and business parsing stay separated under the default 1+N+1+1 flow.",
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
    "Raw capture remained separate from business parsing. The malformed independent analysis reply was preserved as raw output, normalized as a narrative fallback answer, and it still supports the final adjudication.",
    JSON.stringify({
      pptxArtifactPath: this.pptxFixturePath,
    }),
  ] as const;

  async feed(input: AiFeedInput): Promise<AiProviderRawResponse> {
    const rawText = this.responses()[this.cursor];
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

const createMalformedAnalysisFixtureRuntime = (input: {
  dataDir: string;
  pptxFixturePath: string;
  runtimeLogBundlePath: string;
}) => {
  const runtimeLogger = createRuntimeLogger({
    terminalEnabled: false,
    fileSink: {
      bundlePath: input.runtimeLogBundlePath,
      redact: false,
    },
  });
  const aiInputGateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: {
      "gemini-api": new MalformedAnalysisFixtureAdapter(input.pptxFixturePath),
    },
  });
  return { runtimeLogger, aiInputGateway };
};

const assertPersistedNarrativeFallbackState = (input: {
  store: ReturnType<typeof createDeepResearchRecordStore>;
  jobId: string;
}): void => {
  const interactions = input.store.listInteractions(input.jobId);
  const analysisInteraction = interactions.find((interaction) => interaction.phase === "analysis");
  const finalInteraction = interactions.find((interaction) => interaction.phase === "final_adjudication");
  const analysisAnswers = input.store.listAnswers({
    jobId: input.jobId,
    answerKind: "analysis",
  });
  assert(analysisInteraction?.parseStatus === "parsed_text_fallback", `Malformed independent analysis should persist parseStatus=parsed_text_fallback, received ${analysisInteraction?.parseStatus}.`);
  assert(finalInteraction?.parseStatus === "parsed_text_fallback", `Narrative final adjudication should persist parseStatus=parsed_text_fallback, received ${finalInteraction?.parseStatus}.`);
  assert(analysisAnswers.length === 1, `Malformed independent analysis should still persist one completed analysis answer, received ${analysisAnswers.length}.`);
};

const readRuntimeEvents = (runtimeLogBundlePath: string) =>
  readFileSync(runtimeLogBundlePath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as {
    eventType: string;
    refs?: { domRef?: string };
    payload?: { stageName?: string };
  });

const assertRuntimeCaptureBoundary = (runtimeLogBundlePath: string): void => {
  const events = readRuntimeEvents(runtimeLogBundlePath);
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
  const parseCompleted = events.some((event) =>
    event.eventType === "RUNTIME_STAGE_COMPLETED"
    && event.payload?.stageName === "ANALYSIS_PARSE",
  );
  assert(captureCompleted, "Raw provider output must complete ANALYSIS_CAPTURE before parser failure.");
  assert(parseCompleted, "Malformed provider JSON with useful content must complete ANALYSIS_PARSE through text fallback normalization.");
  assert(!parseFailed, "Malformed provider JSON with useful content must not hard-fail at ANALYSIS_PARSE once text fallback is active.");
};

export const verifyMalformedProviderJsonFailsAtParseNotCapture = async (): Promise<void> => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-raw-only-"));
  const runtimeLogBundlePath = path.join(dataDir, "runtime-logs", "deep-research-raw-only.jsonl");
  const pptxFixturePath = path.join(dataDir, "fixture-business-deck.pptx");
  writeFileSync(pptxFixturePath, "fixture-pptx", "utf8");
  const { runtimeLogger, aiInputGateway } = createMalformedAnalysisFixtureRuntime({
    dataDir,
    pptxFixturePath,
    runtimeLogBundlePath,
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Can raw capture be separated from independent analysis parsing?",
      analysisGoal: "Verify malformed provider JSON reaches the Deep Research parser under the default 1+N+1+1 flow.",
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

  assert(result.status === "success", `Malformed narrative analysis should normalize through text fallback and keep the Deep Research flow successful, received ${JSON.stringify(result)}.`);
  assert(result.phase === "COMPLETE", `Malformed narrative analysis should still allow the job to complete, received ${result.phase}.`);

  const store = createDeepResearchRecordStore(dataDir);
  try {
    assertPersistedNarrativeFallbackState({
      store,
      jobId: result.jobId,
    });
  } finally {
    store.close();
  }
  assertRuntimeCaptureBoundary(runtimeLogBundlePath);
};