import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  buildDeepResearchFinalPackage,
  createDeepResearchRecordStore,
  exportDeepResearchArtifacts,
  parseDeepResearchFalsificationResponse,
  parseDeepResearchFinalReportResponse,
  parseDeepResearchPositiveResponse,
  runDeepResearchAnalysis,
} from "../../src/plugins/deep-research-analysis/acceptance-surface.js";
import type {
  AiProviderAdapter,
  AiProviderRawResponse,
} from "../../src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.js";
import type {
  AiFeedInput,
} from "../../src/capabilities/ai-input-gateway/index.js";

const REQUIRED_STAGE_NAMES = [
  "DECOMPOSE_SEND",
  "DECOMPOSE_CAPTURE",
  "DECOMPOSE_PARSE",
  "DECOMPOSE_PERSIST",
  "POSITIVE_SEND",
  "POSITIVE_CAPTURE",
  "POSITIVE_PARSE",
  "POSITIVE_PERSIST",
  "FALSIFY_SEND",
  "FALSIFY_CAPTURE",
  "FALSIFY_PARSE",
  "FALSIFY_PERSIST",
  "FINAL_PACKAGE_BUILD",
  "FINAL_SEND",
  "FINAL_CAPTURE",
  "FINAL_PARSE",
  "FINAL_PERSIST",
  "EXPORT_REPORT",
] as const;

const FIXTURE_RESPONSES = [
  JSON.stringify({
    mainQuestion: "Should the company enter the robotics warehouse market?",
    subQuestions: [
      {
        id: "Q1",
        title: "Demand outlook",
        questionText: "What is the near-term demand outlook for robotics warehouses?",
        dimension: "market demand",
        purpose: "Measure top-line market pull.",
        requiredEvidence: ["budget data", "labor market data"],
        positiveAnalysisFocus: "Demand growth and ROI support.",
        falsificationFocus: "Demand softness and failed pilot risk.",
        scope: "2026-2028 global enterprise warehouse robotics.",
        expectedAnswerShape: "market-demand-summary",
        priority: "high",
      },
      {
        id: "Q2",
        title: "Execution risk",
        questionText: "What execution risks would likely block entry success?",
        dimension: "execution risk",
        purpose: "Measure downside and feasibility.",
        requiredEvidence: ["deployment benchmarks", "partner capability"],
        positiveAnalysisFocus: "Execution path and mitigations.",
        falsificationFocus: "Integration and sales-cycle blockers.",
        scope: "Product, go-to-market, and integration risks.",
        expectedAnswerShape: "risk-summary",
        priority: "high",
      },
    ],
    questionType: "business",
    decompositionStrategy: "Split the market-entry thesis into demand and execution-risk dimensions.",
    missingInfo: [],
    qualitySelfCheck: {
      coversFacts: true,
      coversCausality: true,
      coversImpact: true,
      coversEvidence: true,
      coversFalsification: true,
      coversRisks: true,
      hasNoDuplicateQuestions: true,
      isReadyForPositiveAndFalsification: true,
    },
  }),
  JSON.stringify({
    subQuestionId: "Q1",
    answer: "Demand appears strong in large fulfillment networks with labor shortages and uptime pressure.",
    keyClaims: [
      "Large warehouse operators are budgeting for automation upgrades.",
      "Labor scarcity supports robotics ROI.",
    ],
    supportingReasons: [
      "Operators need higher throughput with fewer workers.",
      "Capital budgets favor measurable cost savings.",
    ],
    assumptions: ["Capital markets remain open for automation spending."],
    evidenceMentions: ["automation capex programs", "fulfillment labor shortages"],
    confidence: "high",
    limitations: ["Assumes stable macro demand across major logistics markets."],
  }),
  JSON.stringify({
    subQuestionId: "Q1",
    answer: "Demand could stall if deployments underperform or macro demand weakens.",
    strongestOpposingArguments: [
      "Warehouse buyers may delay adoption after failed pilots.",
      "Integration timelines can erode short-term ROI confidence.",
    ],
    contradictionPoints: [
      "Pilot fatigue can reduce urgency.",
      "Budget scrutiny can pause multi-site rollouts.",
    ],
    evidenceMentions: ["slow pilot conversion", "integration overruns"],
    confidence: "medium",
    limitations: ["Negative case depends on pilot data not yet fully public."],
  }),
  JSON.stringify({
    subQuestionId: "Q2",
    answer: "Execution risk is concentrated in integration complexity and long enterprise sales cycles.",
    keyClaims: [
      "ERP and WMS integration can delay value realization.",
      "Enterprise procurement cycles slow expansion.",
    ],
    supportingReasons: [
      "Warehouse software stacks are heterogeneous.",
      "Safety and uptime requirements increase certification load.",
    ],
    assumptions: ["The entrant lacks a mature partner channel at launch."],
    evidenceMentions: ["multi-system integration", "enterprise approval bottlenecks"],
    confidence: "high",
    limitations: ["Risk profile improves if the entrant acquires an integration partner."],
  }),
  JSON.stringify({
    subQuestionId: "Q2",
    answer: "Execution risk may be lower if the market entrant starts with one narrow workflow and channel partners.",
    strongestOpposingArguments: [
      "Partner-led rollout can shrink implementation burden.",
      "A single-workflow entry strategy reduces technical scope.",
    ],
    contradictionPoints: [
      "Risk can be staged rather than absorbed upfront.",
      "Channel leverage can offset enterprise sales friction.",
    ],
    evidenceMentions: ["narrow workflow launch", "partner implementation model"],
    confidence: "medium",
    limitations: ["This mitigation depends on finding credible channel partners early."],
  }),
  JSON.stringify({
    executiveConclusion: "The company should explore entry, but only through a narrow workflow beachhead with explicit integration partners and a staged rollout.",
    confidence: "medium",
    positiveReasons: [
      "Demand signals are real in labor-constrained warehouses.",
      "Buyers have incentive to fund automation when ROI is clear.",
    ],
    strongestOpposingArguments: [
      "Integration failure can destroy ROI credibility.",
      "Budget scrutiny can delay adoption despite interest.",
    ],
    conflictMatrix: [
      {
        subQuestionId: "Q1",
        positiveClaimSummary: "Large operators continue budgeting for automation.",
        falsificationSummary: "Demand can pause after weak pilots or macro softness.",
        conflictLevel: "medium",
        evidenceGap: "Need stronger public pilot conversion data.",
        needsHumanReview: true,
      },
      {
        subQuestionId: "Q2",
        positiveClaimSummary: "Execution risk is manageable with staged scope.",
        falsificationSummary: "Integration complexity remains the main blocker.",
        conflictLevel: "high",
        evidenceGap: "Need partner capability and rollout evidence.",
        needsHumanReview: true,
      },
    ],
    evidenceGaps: [
      "Public pilot conversion data is limited.",
      "Need validated partner execution benchmarks.",
    ],
    reverseConditions: [
      "If pilot conversion data weakens materially, entry thesis should reverse.",
      "If channel partners cannot shorten deployment time, execution thesis weakens.",
    ],
    followUpSignals: [
      "Pilot-to-rollout conversion rates.",
      "Deployment time-to-value in first three customer accounts.",
    ],
    limitations: [
      "This report relies on simulated fixture responses rather than live provider data.",
    ],
  }),
] as const;

class SequentialFixtureAdapter implements AiProviderAdapter {
  readonly providerKind = "gemini-api" as const;

  private cursor = 0;

  async feed(input: AiFeedInput): Promise<AiProviderRawResponse> {
    const rawText = FIXTURE_RESPONSES[this.cursor];
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

const parseJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const verifySmokeUsesRealSurfaces = (): void => {
  assert(typeof parseDeepResearchPositiveResponse === "function", "Positive parser must be imported by smoke.");
  assert(typeof parseDeepResearchFalsificationResponse === "function", "Falsification parser must be imported by smoke.");
  assert(typeof parseDeepResearchFinalReportResponse === "function", "Final parser must be imported by smoke.");
  assert(typeof buildDeepResearchFinalPackage === "function", "Final package builder must be imported by smoke.");
  assert(typeof exportDeepResearchArtifacts === "function", "Export function must be imported by smoke.");
};

const verifyRuntimeLogCoverage = (bundlePath: string): void => {
  assert(existsSync(bundlePath), `Runtime log bundle not found: ${bundlePath}`);
  const lines = readFileSync(bundlePath, "utf8").trim().split("\n").filter(Boolean);
  const events = lines.map((line) => JSON.parse(line) as {
    eventType: string;
    status?: string;
    payload?: { stageName?: string };
  });
  assert(events.some((event) => event.eventType === "DEEP_RESEARCH_JOB_STARTED"), "Missing DEEP_RESEARCH_JOB_STARTED event.");
  assert(events.some((event) => event.eventType === "DEEP_RESEARCH_EXPORT_COMPLETED"), "Missing DEEP_RESEARCH_EXPORT_COMPLETED event.");
  assert(events.some((event) => event.eventType === "DEEP_RESEARCH_JOB_COMPLETED"), "Missing DEEP_RESEARCH_JOB_COMPLETED event.");
  for (const stageName of REQUIRED_STAGE_NAMES) {
    const started = events.some((event) => event.eventType === "RUNTIME_STAGE_STARTED" && event.payload?.stageName === stageName);
    const terminal = events.some((event) =>
      (event.eventType === "RUNTIME_STAGE_COMPLETED"
        || event.eventType === "RUNTIME_STAGE_FAILED"
        || event.eventType === "RUNTIME_STAGE_REVIEW_REQUIRED")
      && event.payload?.stageName === stageName,
    );
    assert(started, `Missing stage start log for ${stageName}.`);
    assert(terminal, `Missing terminal stage log for ${stageName}.`);
  }
};

async function main(): Promise<void> {
  verifySmokeUsesRealSurfaces();
  const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-"));
  const runtimeLogBundlePath = path.join(dataDir, "runtime-logs", "deep-research-smoke.jsonl");
  const runtimeLogger = createRuntimeLogger({
    terminalEnabled: false,
    fileSink: {
      bundlePath: runtimeLogBundlePath,
      redact: false,
    },
  });
  const adapter = new SequentialFixtureAdapter();
  const aiInputGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: {
      "gemini-api": adapter,
    },
  });

  const result = await runDeepResearchAnalysis(
    {
      userQuestion: "Should the company enter the robotics warehouse market?",
      analysisGoal: "Assess whether entry is justified and under what conditions.",
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

  assert(result.status === "success", `Deep Research smoke expected success but received ${JSON.stringify(result)}.`);
  assert(result.report !== null, "Deep Research smoke expected a final report.");
  assert(Object.keys(result.recordHashes).length > 0, "Deep Research smoke expected non-empty record hashes.");

  const store = createDeepResearchRecordStore(dataDir);
  try {
    const job = store.getJob(result.jobId);
    assert(job?.status === "completed", "Persisted research job should be completed.");

    const subQuestions = store.listSubQuestions(result.jobId);
    assert(subQuestions.length >= 2, `Expected at least 2 sub-questions, received ${subQuestions.length}.`);

    const interactions = store.listInteractions(result.jobId);
    assert(interactions.length === 6, `Expected 6 persisted interactions, received ${interactions.length}.`);
    interactions.forEach((interaction) => {
      assert(Boolean(interaction.promptHash), `Interaction ${interaction.id} is missing promptHash.`);
      assert(Boolean(interaction.rawResponseHash), `Interaction ${interaction.id} is missing rawResponseHash.`);
      assert(Boolean(interaction.parseStatus), `Interaction ${interaction.id} is missing parseStatus.`);
    });

    const positiveAnswers = store.listAnswers({ jobId: result.jobId, answerKind: "positive" });
    const falsificationAnswers = store.listAnswers({ jobId: result.jobId, answerKind: "falsification" });
    assert(positiveAnswers.length === 2, `Expected 2 positive answers, received ${positiveAnswers.length}.`);
    assert(falsificationAnswers.length === 2, `Expected 2 falsification answers, received ${falsificationAnswers.length}.`);

    const conflictMatrix = store.listConflictMatrix(result.jobId);
    assert(conflictMatrix.length === 2, `Expected 2 conflict matrix rows, received ${conflictMatrix.length}.`);

    const finalReport = store.getLatestFinalReport(result.jobId);
    assert(finalReport !== null, "Expected a persisted final report record.");
    const finalPackage = buildDeepResearchFinalPackage({ store, jobId: result.jobId });
    assert(finalPackage.positiveAnswerRecords.length === 2, "Final package must read persisted positive records.");
    assert(finalPackage.falsificationAnswerRecords.length === 2, "Final package must read persisted falsification records.");

    const exports = store.listExports(result.jobId);
    assert(exports.length === 3, `Expected 3 export records, received ${exports.length}.`);

    const finalReportExport = exports.find((record) => record.exportKind === "final-report.md");
    const bundleExport = exports.find((record) => record.exportKind === "research-bundle.json");
    const evidenceExport = exports.find((record) => record.exportKind === "evidence-index.json");
    if (!finalReportExport) throw new Error("Missing final-report.md export record.");
    if (!bundleExport) throw new Error("Missing research-bundle.json export record.");
    if (!evidenceExport) throw new Error("Missing evidence-index.json export record.");

    assert(existsSync(finalReportExport.filePath), "final-report.md file was not written.");
    assert(existsSync(bundleExport.filePath), "research-bundle.json file was not written.");
    assert(existsSync(evidenceExport.filePath), "evidence-index.json file was not written.");

    const evidenceIndex = parseJsonFile<Array<{ interactionId: string; parsedRecordId: string }>>(evidenceExport.filePath);
    assert(evidenceIndex.length >= 7, `Expected at least 7 evidence index rows, received ${evidenceIndex.length}.`);
  } finally {
    store.close();
  }

  verifyRuntimeLogCoverage(runtimeLogBundlePath);
  process.stdout.write("[DEEP-RESEARCH-ANALYSIS-SMOKE][PASS] full fixed research pipeline completed with persisted records, exports, and runtime logs.\n");
}

await main();
