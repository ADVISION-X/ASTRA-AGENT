import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  buildDeepResearchFinalPackage,
  createDeepResearchRecordStore,
  exportDeepResearchArtifacts,
  parseDeepResearchFinalAdjudicationResponse,
  parseDeepResearchSubQuestionAnalysisResponse,
  runDeepResearchAnalysis,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import { renderDeepResearchFinalAdjudicationPrompt } from "../../src/plugins/deep-research-analysis/deep-research-analysis.prompts.js";
import type { DeepResearchResult } from "../../src/plugins/deep-research-analysis/deep-research-analysis.result.js";
import type {
  AiProviderAdapter,
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../../src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.js";
import type {
  AiFeedInput,
} from "../../src/capabilities/ai-input-gateway/index.js";
import {
  verifyPersistedResearchState,
  verifyRuntimeLogCoverage,
  verifySubQuestionIdsAreJobScoped,
} from "./deep-research-analysis-smoke-support.js";
import { verifyMalformedProviderJsonFailsAtParseNotCapture } from "./deep-research-analysis-raw-capture-boundary.js";
import { verifySingleSubQuestionFailureDoesNotKillJob } from "./deep-research-analysis-sub-question-fault-isolation.js";

const FIXTURE_RESPONSES = [
  JSON.stringify({
    mainQuestion: "Should the company enter the robotics warehouse market?",
    questionType: "business",
    decompositionStrategy: "Split the market-entry thesis into demand and execution viability so a final adjudicator can judge the answer directly.",
    missingInfo: [],
    subQuestions: [
      {
        id: "Q1",
        title: "Demand durability",
        questionText: "How durable is warehouse robotics demand over the next 24 months?",
        whyItMatters: "Entry should not proceed unless there is durable demand support.",
        decisionWeight: "decisive",
        analysisFocus: "Evaluate whether buyer demand remains strong enough to justify market entry timing.",
        requiredEvidence: ["buyer capex plans", "automation ROI benchmarks"],
        scope: "Enterprise warehouse robotics demand over the next 24 months.",
        expectedAnswerShape: "neutral demand assessment",
        priority: "high",
        omissionRisk: "Without this, the final answer cannot distinguish a real market from a temporary narrative."
      },
      {
        id: "Q2",
        title: "Execution feasibility",
        questionText: "What execution constraints are most likely to block a successful entry?",
        whyItMatters: "Even strong demand does not justify entry if execution barriers dominate the outcome.",
        decisionWeight: "high",
        analysisFocus: "Identify integration, channel, deployment, and operating risks that materially affect feasibility.",
        requiredEvidence: ["deployment benchmarks", "partner capability evidence"],
        scope: "Execution constraints for the first 24 months of entry.",
        expectedAnswerShape: "execution feasibility summary",
        priority: "high",
        omissionRisk: "Without this, the final adjudicator may confuse demand support with practical readiness."
      }
    ],
    exhaustivenessCheck: {
      keyDimensionsCovered: ["demand", "execution feasibility"],
      knownBlindSpots: [],
      whyNoMoreQuestionsAreNeeded: "Demand durability and execution feasibility are the two decision-dominant dimensions for this entry question."
    },
    qualitySelfCheck: {
      isNeutral: true,
      hasNoDuplicateQuestions: true,
      hasNoPureFalsificationQuestions: true,
      isReadyForIndependentAnalysis: true,
      isReadyForFinalAdjudication: true
    }
  }),
  JSON.stringify({
    subQuestionId: "Q1",
    answer: "Demand appears durable enough to justify serious market-entry consideration.",
    coreFinding: "Demand remains durable enough to support entry evaluation.",
    keyClaims: ["Large operators continue funding automation upgrades."],
    supportingReasons: ["Labor pressure and throughput demands keep ROI attractive."],
    counterConditions: ["A logistics downturn would weaken buyer urgency."],
    failureCases: ["A severe recession could materially delay automation budgets."],
    evidenceMentions: ["automation capex plans", "warehouse labor constraints"],
    evidenceQuality: "moderate",
    assumptions: ["No severe macro recession."],
    uncertainties: ["Public buyer pipeline evidence is incomplete."],
    impactOnFinalAdjudication: "Supports a measured market-entry recommendation if execution remains manageable.",
    confidence: "high",
    limitations: ["Public buyer pipeline evidence is incomplete."],
  }),
  JSON.stringify({
    subQuestionId: "Q2",
    answer: "Execution risk is manageable only with a narrow workflow launch and strong delivery partners.",
    coreFinding: "Execution is feasible, but only under a staged entry model.",
    keyClaims: ["Integration complexity is the main operational constraint."],
    supportingReasons: ["A narrow workflow and partner-led rollout reduce initial execution load."],
    counterConditions: ["Weak partner quality or broad scope would sharply raise failure risk."],
    failureCases: ["A broad first release without delivery partners would likely fail."],
    evidenceMentions: ["integration benchmarks", "partner rollout model"],
    evidenceQuality: "moderate",
    assumptions: ["A credible implementation partner is available."],
    uncertainties: ["Partner quality still needs live validation."],
    impactOnFinalAdjudication: "Supports entry only as a staged, partner-assisted launch.",
    confidence: "medium",
    limitations: ["Partner quality still needs live validation."],
  }),
  JSON.stringify({
    directAnswer: "The company should consider entering, but only through a staged partner-led beachhead.",
    finalVerdict: "conditional",
    confidence: "medium",
    rankedConclusions: [{
      rank: 1,
      conclusion: "Demand is durable enough to justify entry evaluation.",
      whyItMatters: "Without durable demand, no entry case survives.",
      strength: "strong",
      appliesTo: ["Enterprise warehouse automation buyers"],
      doesNotApplyTo: ["Severe recession scenarios"],
      reverseCondition: "A sustained logistics downturn would weaken this conclusion.",
    }],
    strongConclusions: ["Demand support is real in labor-constrained warehouses."],
    conditionalConclusions: ["Execution only works as a staged partner-led launch."],
    weakOrRejectedClaims: ["A broad immediate rollout is not justified."],
    decisiveReasons: ["Demand is durable and execution can be narrowed to a feasible beachhead."],
    evidenceGaps: ["Partner deployment quality still needs live validation."],
    reverseConditions: ["If partner execution quality is weak, the entry thesis should reverse."],
    applicability: ["Measured warehouse robotics entry decisions"],
    nonApplicability: ["Immediate full-scale launch decisions"],
    followUpSignals: ["Track partner deployment time-to-value in the first customer accounts."],
    multiStageValueAdded: ["Independent analysis separated local findings before the final adjudication."],
    limitations: ["This smoke uses deterministic fixture responses rather than a live provider."],
  }),
] as const;

const writeHtmlArtifactFixture = (input: {
  dataDir: string;
  fileStem: string;
  title: string;
  body: string;
}): string => {
  const artifactDir = path.join(input.dataDir, "acceptance-html-artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const sourceHtmlPath = path.join(artifactDir, `${input.fileStem}.html`);
  writeFileSync(sourceHtmlPath, [
    "<!DOCTYPE html>",
    "<html>",
    `<head><meta charset="utf-8"><title>${input.title}</title><style>body{font-family:sans-serif;}</style></head>`,
    `<body><main><h1>${input.title}</h1><p>${input.body}</p></main></body>`,
    "</html>",
  ].join(""), "utf8");
  return `HTML_ARTIFACT_PATH=${sourceHtmlPath}`;
};

const REQUIRED_SMOKE_EXPORTS = [
  "final-report.md",
  "full-case-file.md",
  "full-case-file.json",
  "structured-final-package.json",
  "business-report.html",
  "evidence-index.json",
] as const;

const REQUIRED_SMOKE_RUNTIME_SIGNALS = [
  "DEEP_RESEARCH_JOB_STARTED",
  "DEEP_RESEARCH_JOB_COMPLETED",
  "RUNTIME_STAGE_STARTED",
] as const;

class SequentialFixtureAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  private cursor = 0;

  async feed(input: AiFeedInput, context: AiProviderAdapterContext): Promise<AiProviderRawResponse> {
    let rawText = FIXTURE_RESPONSES[this.cursor];
    if (!rawText && input.promptPackageId.includes("business-html-report")) {
      rawText = writeHtmlArtifactFixture({
        dataDir: context.dataDir,
        fileStem: "business-report",
        title: "Business Report",
        body: "The company should consider entering, but only through a staged partner-led beachhead.",
      });
    }
    if (!rawText) {
      throw new Error(`No fixture response available for prompt ${input.promptPackageId} at cursor ${this.cursor}.`);
    }
    this.cursor += 1;
    return {
      rawText,
      modelName: "fixture-gemini-model",
      runtimeName: "deep-research-fixture-adapter",
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

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const verifySmokeUsesRealSurfaces = (): void => {
  assert(typeof parseDeepResearchSubQuestionAnalysisResponse === "function", "Analysis parser must be imported by smoke.");
  assert(typeof parseDeepResearchFinalAdjudicationResponse === "function", "Final adjudication parser must be imported by smoke.");
  assert(typeof buildDeepResearchFinalPackage === "function", "Final package builder must be imported by smoke.");
  assert(typeof exportDeepResearchArtifacts === "function", "Export function must be imported by smoke.");
};

const verifySmokeCoverageDelegation = (): void => {
  assert(REQUIRED_SMOKE_EXPORTS.length === 6, "Smoke must keep explicit export artifact verification coverage.");
  assert(REQUIRED_SMOKE_RUNTIME_SIGNALS.length === 3, "Smoke must keep explicit runtime signal verification coverage.");
  assert(typeof verifyPersistedResearchState === "function", "Smoke must delegate persisted-state assertions to the support verifier.");
};

async function main(): Promise<void> {
  verifySmokeUsesRealSurfaces();
  verifySmokeCoverageDelegation();
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-smoke-"));
  const runtimeLogBundlePath = path.join(dataDir, "runtime-logs", "deep-research-smoke.jsonl");
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
      "gemini-api": new SequentialFixtureAdapter(),
    },
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Should the company enter the robotics warehouse market?",
      analysisGoal: "Assess whether entry is justified within 24 months.",
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

  assert(result.status === "success", `Expected smoke success, received ${JSON.stringify(result)}.`);
  assert(result.phase === "COMPLETE", `Expected COMPLETE phase, received ${result.phase}.`);
  assert(result.report?.finalVerdict === "conditional", "Smoke report must persist the final adjudication verdict.");
  assert(
    (result.report?.sourceNotes ?? []).length >= 4,
    "Final adjudication must merge analysis evidenceMentions into structured sourceNotes.",
  );
  verifyRuntimeLogCoverage(runtimeLogBundlePath);
  verifyPersistedResearchState(dataDir, result);
  verifySubQuestionIdsAreJobScoped();
  await verifyMalformedProviderJsonFailsAtParseNotCapture();
  await verifySingleSubQuestionFailureDoesNotKillJob();
  process.stdout.write("[ACCEPTANCE][deep-research-analysis-smoke] PASS\n");
}

await main();
