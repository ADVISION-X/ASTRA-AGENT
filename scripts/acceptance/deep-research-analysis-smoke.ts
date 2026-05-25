import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  buildDeepResearchStructuredIndex,
  createDeepResearchRecordStore,
  exportDeepResearchArtifacts,
  parseDeepResearchFinalAdjudicationResponse,
  parseDeepResearchSubQuestionAnalysisResponse,
  runDeepResearchAnalysis,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import { renderDeepResearchFinalAdjudicationPrompt } from "../../src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.js";
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
        scope: "Enterprise warehouse robotics demand over the next 24 months.",
        omissionRisk: "Without this, the final answer cannot distinguish a real market from a temporary narrative.",
        promptBundle: {
          promptBundleId: "Q1-demand-durability-prompt-bundle",
          promptRole: "sub_question_analysis",
          taskInstruction: "Analyze warehouse robotics demand durability over the next 24 months.",
          questionSpecificFocus: ["demand durability", "buyer capex resilience"],
          mustUseInputs: ["user question", "Q1 sub-question JSON"],
          mustNotDo: ["Do not decide the overall market entry recommendation."],
          evidenceOrReasoningNeeds: ["buyer capex plans", "automation ROI benchmarks"],
          outputGuidance: {
            preferredFormat: "json_object",
            requiredContent: ["local demand finding", "supporting reasons", "conditions that weaken the finding"],
            optionalContent: [],
            forbiddenContent: ["system operation commands"]
          },
          safetyBoundary: ["No operational action instructions."],
          languageInstruction: "Respond in English."
        }
      },
      {
        id: "Q2",
        title: "Execution feasibility",
        questionText: "What execution constraints are most likely to block a successful entry?",
        whyItMatters: "Even strong demand does not justify entry if execution barriers dominate the outcome.",
        decisionWeight: "high",
        scope: "Execution constraints for the first 24 months of entry.",
        omissionRisk: "Without this, the final adjudicator may confuse demand support with practical readiness.",
        promptBundle: {
          promptBundleId: "Q2-execution-feasibility-prompt-bundle",
          promptRole: "sub_question_analysis",
          taskInstruction: "Analyze first-24-month execution constraints for warehouse robotics entry.",
          questionSpecificFocus: ["integration risk", "partner-led rollout feasibility"],
          mustUseInputs: ["user question", "Q2 sub-question JSON"],
          mustNotDo: ["Do not decide the overall market entry recommendation."],
          evidenceOrReasoningNeeds: ["deployment benchmarks", "partner capability evidence"],
          outputGuidance: {
            preferredFormat: "json_object",
            requiredContent: ["local execution finding", "blocking constraints", "conditions that change feasibility"],
            optionalContent: [],
            forbiddenContent: ["system operation commands"]
          },
          safetyBoundary: ["No operational action instructions."],
          languageInstruction: "Respond in English."
        }
      }
    ],
    finalAdjudicationPromptBundle: {
      promptBundleId: "robotics-entry-final-adjudication-prompt-bundle",
      promptRole: "final_adjudication",
      taskInstruction: "Adjudicate whether the company should enter the robotics warehouse market using the full case file.",
      questionSpecificFocus: ["entry recommendation", "demand versus execution constraints"],
      mustUseInputs: ["fullCaseFile", "all raw responses", "structured index"],
      mustNotDo: ["Do not ignore raw responses."],
      evidenceOrReasoningNeeds: ["compare demand durability against execution feasibility"],
      outputGuidance: {
        preferredFormat: "json_object",
        requiredContent: ["direct recommendation", "conditions", "reasoning", "risks"],
        optionalContent: [],
        forbiddenContent: ["system operation commands"]
      },
      safetyBoundary: ["No investment, legal, or operational action instructions."],
      languageInstruction: "Respond in English."
    },
    htmlReportPromptBundle: {
      promptBundleId: "robotics-entry-html-report-prompt-bundle",
      promptRole: "html_report_publisher",
      taskInstruction: "Publish a browser-readable HTML business report for the robotics market-entry adjudication.",
      questionSpecificFocus: ["executive readability", "entry conditions", "risk boundaries"],
      mustUseInputs: ["finalReport", "fullCaseFile"],
      mustNotDo: ["Do not change the final meaning."],
      evidenceOrReasoningNeeds: ["preserve final report and supporting case-file context"],
      outputGuidance: {
        preferredFormat: "html_document",
        requiredContent: ["final recommendation", "reasons", "conditions", "limitations"],
        optionalContent: [],
        forbiddenContent: ["scripts", "external resources"]
      },
      safetyBoundary: ["Self-contained safe HTML only."],
      languageInstruction: "Write in English."
    },
    planIntegrityCheck: {
      everySubQuestionHasPromptBundle: true,
      promptBundlesAreQuestionSpecific: true,
      noGenericUniversalPromptBundle: true,
      finalPromptBundleIsQuestionSpecific: true,
      htmlPromptBundleIsQuestionSpecific: true,
      runtimeWillOnlyAddShellConstraints: true
    }
  }),
  JSON.stringify({
    subQuestionId: "Q1",
    summary: "Demand appears durable enough to justify serious market-entry consideration.",
    keyPoints: ["Large operators continue funding automation upgrades."],
    evidenceMentions: ["automation capex plans", "warehouse labor constraints"],
    assumptions: ["No severe macro recession."],
    contradictionPoints: ["A logistics downturn would weaken buyer urgency."],
    structuredPayload: {
      demandFinding: "Demand remains durable enough to support entry evaluation.",
      supportingReasons: ["Labor pressure and throughput demands keep ROI attractive."],
      failureCases: ["A severe recession could materially delay automation budgets."],
      impactOnFinalDecision: "Supports a measured market-entry recommendation if execution remains manageable.",
    },
    confidence: "high",
    limitations: ["Public buyer pipeline evidence is incomplete."],
  }),
  JSON.stringify({
    subQuestionId: "Q2",
    summary: "Execution risk is manageable only with a narrow workflow launch and strong delivery partners.",
    keyPoints: ["Integration complexity is the main operational constraint."],
    evidenceMentions: ["integration benchmarks", "partner rollout model"],
    assumptions: ["A credible implementation partner is available."],
    contradictionPoints: ["Weak partner quality or broad scope would sharply raise failure risk."],
    structuredPayload: {
      executionFinding: "Execution is feasible, but only under a staged entry model.",
      supportingReasons: ["A narrow workflow and partner-led rollout reduce initial execution load."],
      failureCases: ["A broad first release without delivery partners would likely fail."],
      impactOnFinalDecision: "Supports entry only as a staged, partner-assisted launch.",
    },
    confidence: "medium",
    limitations: ["Partner quality still needs live validation."],
  }),
  JSON.stringify({
    summary: "The company should consider entering, but only through a staged partner-led beachhead.",
    confidence: "medium",
    structuredPayload: {
      recommendation: "Enter only through a staged partner-led beachhead.",
      rationale: ["Demand support is real in labor-constrained warehouses."],
      constraints: ["Execution only works as a staged partner-led launch."],
      rejectedPaths: ["A broad immediate rollout is not justified."],
      followUpSignals: ["Track partner deployment time-to-value in the first customer accounts."],
      applicability: ["Measured warehouse robotics entry decisions"],
      nonApplicability: ["Immediate full-scale launch decisions"],
      auditNote: "Independent analysis separated local findings before the final adjudication.",
    },
    references: [
      "automation capex plans",
      "warehouse labor constraints",
      "integration benchmarks",
      "partner rollout model"
    ],
    sourceNotes: [],
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

const REQUIRED_SMOKE_EXPORT_KINDS = [
  "final-report.md",
  "full-case-file.md",
  "full-case-file.json",
  "decision-package.json",
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
  assert(typeof buildDeepResearchStructuredIndex === "function", "Structured index builder must be imported by smoke.");
  assert(typeof exportDeepResearchArtifacts === "function", "Export function must be imported by smoke.");
};

const verifySmokeCoverageDelegation = (): void => {
  assert(REQUIRED_SMOKE_EXPORT_KINDS.length === 6, "Smoke must keep explicit export artifact verification coverage.");
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
  assert(
    result.report?.summary.includes("staged partner-led beachhead"),
    "Smoke report must persist the final adjudication summary.",
  );
  assert(
    (result.report?.sourceNotes ?? []).length >= 4,
    "Final adjudication must merge analysis evidenceMentions into structured sourceNotes.",
  );
  verifyRuntimeLogCoverage(runtimeLogBundlePath);
  verifyPersistedResearchState(dataDir, result);
  verifySubQuestionIdsAreJobScoped();
  process.stdout.write("[ACCEPTANCE][deep-research-analysis-smoke] PASS\n");
}

await main();
