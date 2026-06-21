import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectPick3HumanReviewHistory } from "./inspector-human-review-history.js";
import { inspectPick3PlaybookLessonStore } from "./inspector-playbook-lessons.js";
import { inspectPick3TrendDisplay } from "./inspector-trend-display.js";
import { blueprintTokenChecks } from "./inspector-token-contracts.js";

const domain = "pick3-is-blind-eval";
const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const misplacedLawPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 法案.md";
const manifestPath = "scripts/audit/domains/pick3-is-blind-eval/manifest.json";
const selfPath = "scripts/audit/domains/pick3-is-blind-eval/inspector.ts";
const lessonInspectorPath = "scripts/audit/domains/pick3-is-blind-eval/inspector-playbook-lessons.ts";
const trendInspectorPath = "scripts/audit/domains/pick3-is-blind-eval/inspector-trend-display.ts";
const acceptancePath = "scripts/acceptance/pick3-is-blind-eval.acceptance.ts";
const fullHistoryAcceptancePath = "scripts/acceptance/pick3-is-blind-eval-full-history.acceptance.ts";
const packagePath = "package.json";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const workbenchApiBoundaryPath = "src/app/workbench-api-boundary.ts";
const workbenchPick3RoutesPath = "src/app/workbench-pick3-routes.ts";
const pick3HistoryClientPath = "src/app/workbench-home-pick3-history-client.ts";
const pick3TrendClientPath = "src/app/workbench-home-pick3-trend-client.ts";
const workbenchPick3SupportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const playbookLoaderPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts";
const aiExchangePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts";
const aiContractPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-contract.ts";
const aiParsePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-parse.ts";
const flowPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts";
const historyPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.history.ts";
const playbookLessonsPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook-lessons.ts";
const trendPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.trend.ts";
const stabilityPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.stability.ts";
const flowTypesPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow-types.ts";
const aiGatewaySchemaPath = "src/capabilities/ai-input-gateway/schema.ts";
const webChatOpenPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
const webChatSharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const webChatSubmitPath = "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts"; const webChatEvaluationPath = "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts";
const webChatUploadPath = "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts";
const webChatClipboardPath = "src/capabilities/ai-input-gateway/providers/web-chat-clipboard.ts";
const webChatSelectorPreludePath = "src/capabilities/ai-input-gateway/providers/web-chat-selector-prelude.ts";
const webChatSharedSupportPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts"; const webChatWorkspacePath = "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts";
const webChatPick3HistoryCleanupPath = "src/capabilities/ai-input-gateway/providers/web-chat-pick3-history-cleanup.ts";
const scoringPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts";
const failureReviewPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.ts";
const promptVersioningPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.ts";
const storageSchemaPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts";
const playbookSystemPath = "src/plugins/pick3-is-blind-eval/playbooks/system.md";
const playbookGrammarPath = "src/plugins/pick3-is-blind-eval/playbooks/visual-grammar.md";
const playbookFreeAnalysisPath = "src/plugins/pick3-is-blind-eval/playbooks/free-analysis-strict-reasoning.md";
const removedPositionPlaybookPaths = ["src/plugins/pick3-is-blind-eval/playbooks/is_hundreds_l80_v1.md", "src/plugins/pick3-is-blind-eval/playbooks/is_tens_l80_v1.md", "src/plugins/pick3-is-blind-eval/playbooks/is_ones_l80_v1.md"];

const inspectedFiles = [
  lawPath,
  blueprintPath,
  manifestPath,
  selfPath,
  lessonInspectorPath,
  trendInspectorPath,
  acceptancePath,
  fullHistoryAcceptancePath,
  packagePath,
  appShellLayoutPath,
  workbenchApiBoundaryPath,
  workbenchPick3RoutesPath,
  pick3HistoryClientPath,
  pick3TrendClientPath,
  workbenchPick3SupportPath,
  playbookLoaderPath,
  aiExchangePath, aiContractPath, aiParsePath, flowPath, historyPath, playbookLessonsPath, trendPath, flowTypesPath, stabilityPath,
  aiGatewaySchemaPath,
  webChatOpenPath, webChatSharedPath, webChatSubmitPath, webChatEvaluationPath,
  webChatUploadPath,
  webChatClipboardPath,
  webChatSelectorPreludePath,
  webChatSharedSupportPath,
  webChatWorkspacePath,
  webChatPick3HistoryCleanupPath,
  scoringPath,
  failureReviewPath,
  promptVersioningPath,
  storageSchemaPath, playbookSystemPath, playbookGrammarPath, playbookFreeAnalysisPath,
] as const;

const pluginRuntimePaths = ["src/plugins/pick3-is-blind-eval/index.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.history.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.trend.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.official-api.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-contract.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts"] as const;

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");
const existsRepoPath = (repoPath: string): boolean => existsSync(resolveFromRepo(repoPath));
const readRepoTextIfExists = (repoPath: string): string => existsRepoPath(repoPath) ? readRepoText(repoPath) : "";

const addFinding = (findings: InspectorFinding[], lawId: string, filePath: string, checkId: string, message: string): void => {
  findings.push(createFinding({ checkId, filePath, lawId, message }));
};

const requireTokens = (findings: InspectorFinding[], lawId: string, filePath: string, text: string, checkId: string, tokens: readonly string[]): void => {
  for (const token of tokens) {
    if (!text.includes(token)) {
      addFinding(findings, lawId, filePath, checkId, `${filePath} must contain ${token}.`);
    }
  }
};

type LawRefs = { agentBrainLaw: string; blindBoundaryLaw: string; humanReviewHistoryLaw: string; lessonStoreLaw: string; officialSourceLaw: string; primaryLaw: string; promptRepairLaw: string; promptExchangeLaw: string; statisticalHonestyLaw: string; trendDisplayLaw: string };

const buildLawRefs = (lawIds: readonly string[]): LawRefs => {
  const primaryLaw = lawIds[0] ?? "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1";
  return { primaryLaw, officialSourceLaw: lawIds.find((lawId) => lawId.endsWith("002-V1")) ?? primaryLaw, blindBoundaryLaw: lawIds.find((lawId) => lawId.endsWith("003-V1")) ?? primaryLaw, promptRepairLaw: lawIds.find((lawId) => lawId.endsWith("004-V1")) ?? primaryLaw, statisticalHonestyLaw: lawIds.find((lawId) => lawId.endsWith("005-V1")) ?? primaryLaw, agentBrainLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-IS-BRAIN-006-V1") ?? primaryLaw, promptExchangeLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1") ?? primaryLaw, humanReviewHistoryLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-HUMAN-REVIEW-HISTORY-009-V1") ?? primaryLaw, lessonStoreLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-PLAYBOOK-LESSON-STORE-011-V1") ?? primaryLaw, trendDisplayLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-TREND-DISPLAY-010-V1") ?? primaryLaw };
};

const inspectFilesExist = (findings: InspectorFinding[], primaryLaw: string): void => {
  for (const repoPath of inspectedFiles) {
    if (!existsRepoPath(repoPath)) {
      addFinding(findings, primaryLaw, repoPath, "pick3-is-blind-eval/file-present", `${repoPath} must exist.`);
    }
  }
  if (existsRepoPath(misplacedLawPath)) {
    addFinding(findings, primaryLaw, misplacedLawPath, "pick3-is-blind-eval/misplaced-law-absent", "Pick3 active law must live under .github/instructions/agent-rules/modules, not docs/法案辅助文件.");
  }
};

const inspectLawContract = (findings: InspectorFinding[], lawRefs: LawRefs, lawText: string): void => {
  requireTokens(findings, lawRefs.primaryLaw, lawPath, lawText, "pick3-is-blind-eval/law-contract", [
    "```apex-law",
    "\"capabilityDomain\": \"pick3-is-blind-eval\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1\"",
    "\"GRASSEYE-PICK3-IS-BRAIN-006-V1\"",
    "\"GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1\"",
    "\"GRASSEYE-PICK3-NEXT-PREDICTION-STABILITY-008-V1\"",
    "\"GRASSEYE-PICK3-HUMAN-REVIEW-HISTORY-009-V1\"",
    "\"GRASSEYE-PICK3-TREND-DISPLAY-010-V1\"",
    "\"GRASSEYE-PICK3-PLAYBOOK-LESSON-STORE-011-V1\"",
    "full official coverage",
    "Success status with missing earliest history",
    "No betting",
    "No login",
    "No China lottery",
    "user-selected `promptMode`",
    "mode = full_pipeline",
    "next_prediction_stability",
    "batchSize is the repeat-send count",
    "must not produce a final selected label",
    "raw_response_text",
    "fixed 80-draw window",
    "three separated rows",
    "Mouse drag changes the historical start index",
    "lastTargetPhase",
    "walk backward by `batchSize`",
    "database-backed phase",
    "History rows show task id",
    "no direction rules",
    "chartReading",
  ]);
};

const inspectBlueprintContract = (findings: InspectorFinding[], lawRefs: LawRefs, blueprintText: string): void => {
  for (const check of blueprintTokenChecks) requireTokens(findings, lawRefs[check.lawRef], blueprintPath, blueprintText, check.checkId, check.tokens);
};

const inspectAgentBrainContract = (findings: InspectorFinding[], lawRefs: LawRefs, lawText: string, blueprintText: string): void => {
  requireTokens(findings, lawRefs.agentBrainLaw, lawPath, lawText, "pick3-is-blind-eval/agent-brain-law", [
    "The AGENT-owned Pick3 Playbook is the only IS brain source",
    "src/plugins/pick3-is-blind-eval/playbooks/",
    "No runtime dependency on `/Users/nexgen/Documents/trend-intuition-brain`",
    "No external Playbook fallback",
    "Playbook versions must be hash-addressed and persisted before prediction use",
    "anonymous time-series chart",
  ]);
  requireTokens(findings, lawRefs.agentBrainLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/agent-brain-blueprint", [
    "## AGENT-Owned IS Brain",
    "src/plugins/pick3-is-blind-eval/playbooks/",
    "No /Users/nexgen/Documents/trend-intuition-brain runtime read.",
    "pick3_playbooks",
    "Pick3PlaybookPromptPackage",
    "confidenceIsProbability: false",
    "de-lotteried anonymous time-series prompt",
  ]);
};

const inspectPlaybookFiles = (findings: InspectorFinding[], agentBrainLaw: string): void => {
  for (const playbookPath of [playbookSystemPath, playbookGrammarPath, playbookFreeAnalysisPath]) {
    const playbookText = existsRepoPath(playbookPath) ? readRepoText(playbookPath) : "";
    requireTokens(findings, agentBrainLaw, playbookPath, playbookText, "pick3-is-blind-eval/playbook-content", [
      "L80",
    ]);
    for (const forbidden of ["targetPhase", "answerDigit", "answerLabel", "expectedPrizeTime", "0-4", "5-9", "0-2", "7-9", "Pick3", "UAE", "lottery", "pick3-is-blind-eval"]) {
      if (playbookText.includes(forbidden)) {
        addFinding(findings, agentBrainLaw, playbookPath, "pick3-is-blind-eval/playbook-no-answer-leak", `${playbookPath} must not contain ${forbidden}.`);
      }
    }
  }
  for (const removedPath of removedPositionPlaybookPaths) {
    if (existsRepoPath(removedPath)) {
      addFinding(findings, agentBrainLaw, removedPath, "pick3-is-blind-eval/no-hand-authored-position-playbook", `${removedPath} must not exist; hand-authored position playbook content was deleted by design. Real position-specific signal must come only from the live-assembled pick3_playbook_lessons pool, not from a static hand-written file.`);
    }
  }
};

const inspectRuntimeExternalBrain = (findings: InspectorFinding[], agentBrainLaw: string): void => {
  for (const runtimePath of pluginRuntimePaths) {
    const runtimeText = existsRepoPath(runtimePath) ? readRepoText(runtimePath) : "";
    if (runtimeText.includes("trend-intuition-brain")) {
      addFinding(
        findings,
        agentBrainLaw,
        runtimePath,
        "pick3-is-blind-eval/no-external-brain-runtime",
        "Pick3 runtime files must not depend on trend-intuition-brain.",
      );
    }
  }
};

type PromptExchangeTexts = {
  aiText: string; aiContractText: string; aiParseText: string;
  flowText: string; stabilityText: string;
  aiGatewaySchemaText: string;
  appShellLayoutText: string;
  webChatOpenText: string;
  webChatSharedText: string;
  webChatPick3HistoryCleanupText: string;
  webChatSharedSupportText: string; webChatWorkspaceText: string;
  workbenchPick3SupportText: string; playbookLoaderText: string;
  storageSchemaText: string; storageText: string;
};

const readPromptExchangeTexts = (): PromptExchangeTexts => ({
  aiText: readRepoTextIfExists(aiExchangePath),
  aiContractText: readRepoTextIfExists(aiContractPath),
  aiParseText: readRepoTextIfExists(aiParsePath),
  flowText: readRepoTextIfExists(flowPath),
  stabilityText: readRepoTextIfExists(stabilityPath),
  aiGatewaySchemaText: readRepoTextIfExists(aiGatewaySchemaPath),
  appShellLayoutText: readRepoTextIfExists(appShellLayoutPath),
  webChatOpenText: readRepoTextIfExists(webChatOpenPath),
  webChatSharedText: readRepoTextIfExists(webChatSharedPath),
  webChatPick3HistoryCleanupText: readRepoTextIfExists(webChatPick3HistoryCleanupPath),
  webChatSharedSupportText: readRepoTextIfExists(webChatSharedSupportPath),
  webChatWorkspaceText: readRepoTextIfExists(webChatWorkspacePath),
  workbenchPick3SupportText: readRepoTextIfExists(workbenchPick3SupportPath),
  playbookLoaderText: readRepoTextIfExists(playbookLoaderPath),
  storageSchemaText: readRepoTextIfExists(storageSchemaPath),
  storageText: readRepoTextIfExists("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts"),
});

const inspectPick3PromptExchangeCore = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  const promptExchangeRuntimeText = [texts.aiText, texts.aiParseText, texts.aiContractText].join("\n");
  requireTokens(findings, promptExchangeLaw, aiExchangePath, promptExchangeRuntimeText, "pick3-is-blind-eval/prompt-exchange-runtime", ["Pick3GatewaySender", "buildPick3AiGatewayInput", "runPick3PromptExchange", "parse_failed_raw_available", "providerProofJson", "imageId", "promptPackageId", "RECOVERABLE_PARSE_FAILURE_REASONS", "pick3_prediction_label_invalid", "DIRECTIONAL_PREDICTION_LABEL_ALIASES", "normalizedDirectionalLabel", "NON_DIRECTIONAL_PREDICTION_LABELS", "non_directional_prediction_label_", "buildNonDirectionalLabelAbstainPrediction", "recoverableRetryReason", "sendWithRecoverableOutputRetry", "PICK3_PROVIDER_REPORTED_MISSING_IMAGE_RETRY_COUNT = 3", "maxAttemptsForRetryReason", "skipped_provider_reported_image_missing", "pick3_provider_reported_image_missing_retry_exhausted", "skippedCount", "PICK3_PROMPT_EXCHANGE_COMPLETION_ROUNDS", "deferred_retry_scheduled", "completionRound", "maxCompletionRounds", "unresolvedCount", "deferredRetryCount", "retry-", "pick3_prediction_image_id_mismatch", "pick3_prediction_prompt_package_id_mismatch", "parseFreeAnalysisEvidence", "pick3_free_analysis_chart_reading_missing", "repeatCount", "repeatIndex"]);
  requireTokens(findings, promptExchangeLaw, aiContractPath, texts.aiContractText, "pick3-is-blind-eval/prompt-contract-runtime", ["Final output contract", "Do not return only `lower`, `upper`, or `abstain`", "lower | upper | abstain", "Never put a tail shape word", "blind_series_package_", "freeAnalysisPromptContractId"]);
  requireTokens(findings, promptExchangeLaw, playbookLoaderPath, texts.playbookLoaderText, "pick3-is-blind-eval/ai-visible-label-contract", ["allowedLabels: [\"lower\", \"upper\", \"abstain\"]"]);
  requireTokens(findings, promptExchangeLaw, flowPath, texts.flowText, "pick3-is-blind-eval/parse-failure-stop", ["pick3_prompt_exchange_parse_failed", "ai_prompt_exchange_failed", "writePromptExchangeFailureArtifacts", "exchange.completion.unresolvedCount > 0", "unresolvedFailures"]);
  if (texts.flowText.includes("exchange.predictions.length !== input.batch.images.length")) {
    addFinding(findings, promptExchangeLaw, flowPath, "pick3-is-blind-eval/missing-image-skip-does-not-stop-batch", "full_pipeline must not stop solely because skipped provider-reported-missing-image interactions reduce prediction count.");
  }
  requireTokens(findings, promptExchangeLaw, flowPath, texts.flowText, "pick3-is-blind-eval/runtime-log-stages", ["runtimeLogger?: RuntimeLogger", "PICK3_OFFICIAL_SYNC", "PICK3_BUILD_BLIND_BATCH", "PICK3_PROMPT_EXCHANGE", "PICK3_REVEAL_AND_SCORING", "PICK3_TASK"]);
  requireTokens(findings, promptExchangeLaw, flowPath, texts.flowText, "pick3-is-blind-eval/next-stability-single-chain", ["next_prediction_stability", "createPick3NextPredictionImages", "runPick3NextPredictionStability", "scoring: null"]);
  requireTokens(findings, promptExchangeLaw, stabilityPath, texts.stabilityText, "pick3-is-blind-eval/next-stability-results", ["stability_results.json", "repeatCount: input.batchInput.batchSize", "visiblePredictionLabel", "buildSelectedPromptPackages", "loadBuiltInPick3Playbooks(promptMode)", "input.batchInput.promptMode", "assertCompleteStabilityExchange", "pick3_next_stability_exchange_incomplete", "runPick3PromptExchange", "deferredRetryCount: exchange.completion.deferredRetryCount", "unresolvedCount: exchange.completion.unresolvedCount", "input.storage.insertAiInteractions", "input.storage.insertPredictions"]);
  if (texts.stabilityText.includes("stabilityPromptMode =")) addFinding(findings, promptExchangeLaw, stabilityPath, "pick3-is-blind-eval/no-hardcoded-stability-prompt-mode", "next_prediction_stability must use input.batchInput.promptMode, not a hardcoded stabilityPromptMode.");
};

const inspectPick3WebChatWorkspace = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  requireTokens(findings, promptExchangeLaw, webChatWorkspacePath, texts.webChatWorkspaceText, "pick3-is-blind-eval/single-gpt-workspace", ["PICK3_WORKSPACE_ID", "pick3-is-blind-eval", "recordWorkspaceConversationUrl", "cleanupStaleWorkspaceConversationTabs"]);
  requireTokens(findings, promptExchangeLaw, webChatPick3HistoryCleanupPath, texts.webChatPick3HistoryCleanupText, "pick3-is-blind-eval/provider-history-delete-disabled", ["cleanupStaleWorkspaceConversationHistory", "provider_history_delete_temporarily_disabled"]);
  requireTokens(findings, promptExchangeLaw, webChatOpenPath, texts.webChatOpenText, "pick3-is-blind-eval/no-tab-per-image", ["isPick3GptRequest", "isPick3GeminiRequest", "isPick3WebChatRequest", "workspaceId", "requiresFreshChatGptConversation", "reuse-host-tab", "reuse-active-tab", "isPick3WorkspaceId(input.workspaceId)"]);
  requireTokens(findings, promptExchangeLaw, webChatOpenPath, texts.webChatOpenText, "pick3-is-blind-eval/gemini-composer-ready-probe-retry", ["provider_composer_ready", "provider_composer_ready_probe", "PROVIDER_COMPOSER_READY_TIMEOUT_MS = 60_000", "status: \"fallback\""]);
  requireTokens(findings, promptExchangeLaw, webChatOpenPath, texts.webChatOpenText, "pick3-is-blind-eval/provider-url-read-fallback", ["read active provider workspace URL", "getSessionState().currentUrl"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedSupportPath, texts.webChatSharedSupportText, "pick3-is-blind-eval/provider-proof-cleanup", ["cleanupProviderWorkspaceAfterResponse", "reuse-single-provider-workspace-tab", "providerRecoveryAttemptCount", "providerRecoveryStatus", "staleConversationCleanupStatus", "staleConversationHistoryCleanupStatus", "webChatWorkspaceId"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedSupportPath, texts.webChatSharedSupportText, "pick3-is-blind-eval/provider-error-page-upload-recovery", ["chrome-error://", "recover provider page before attachment upload", "phase === \"attachment upload\""]);
  requireTokens(findings, promptExchangeLaw, aiExchangePath, texts.aiText, "pick3-is-blind-eval/raw-preserving-cleanup-proof", ["pick3CleanupFailureStatus", "cleanupStatus=", "providerProofJson"]);
  requireTokens(findings, promptExchangeLaw, webChatWorkspacePath, texts.webChatWorkspaceText, "pick3-is-blind-eval/workspace-url-normalization", ["normalizeWorkspaceUrl", "isPick3WorkspaceId", "`${parsed.origin}/`"]);
  requireTokens(findings, promptExchangeLaw, aiGatewaySchemaPath, texts.aiGatewaySchemaText, "pick3-is-blind-eval/provider-proof-schema", ["webChatWorkspaceId", "providerTabPolicy", "providerRecoveryAttemptCount", "providerRecoveryStatus", "staleConversationCleanupStatus", "staleConversationHistoryCleanupStatus"]);
  requireTokens(findings, promptExchangeLaw, lawPath, readRepoTextIfExists(lawPath), "pick3-is-blind-eval/provider-history-delete-disabled-law", ["Pick3 provider sidebar history deletion is temporarily disabled", "provider_history_delete_temporarily_disabled", "current_history_delete_temporarily_disabled"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedSupportPath, texts.webChatSharedSupportText, "pick3-is-blind-eval/gemini-per-image-cleanup-deferred", ["providerKind === \"gemini-web-chat\"", "promptContractId.startsWith(\"pick3-is-blind-eval\")", "deferred_gemini_pick3_post_batch_cleanup_required"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedSupportPath, texts.webChatSharedSupportText, "pick3-is-blind-eval/gemini-pre-image-history-cleanup-helper", ["cleanupGeminiPick3HistoryBeforeNextImage", "isBlockingGeminiPick3PreImageHistoryCleanupStatus"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedPath, texts.webChatSharedText, "pick3-is-blind-eval/gemini-pre-image-history-cleanup-stage", ["pre_image_history_cleanup", "delete_previous_stale_history_before_next_image", "before attachment upload"]);
};

const inspectPick3WebChatRecovery = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  requireTokens(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts", texts.webChatSharedText, "pick3-is-blind-eval/no-result-recovery", ["PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000", "PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1", "reuse-active-tab", "isPick3NoResultTimeoutError", "recoverPick3NoResultConversation", "pick3_no_result_recovery_reopened_gemini_new_chat", "pick3_no_result_recovery_refreshed_without_history_delete_and_reopened_new_chat"]);
  for (const forbiddenRateLimitEscalation of ["provider_rate_limited_too_many_requests", "recoverAfterPick3RateLimit", "pick3_rate_limit_same_payload_resend_started"]) if (texts.webChatSharedText.includes(forbiddenRateLimitEscalation)) addFinding(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts", "pick3-is-blind-eval/rate-limit-click-only-no-resend", `${forbiddenRateLimitEscalation} must not appear in web-chat-shared.ts; the only action on a visible rate-limit dialog is click acknowledgement, never reopen/resend.`);
  if (texts.webChatSharedText.includes("deletePick3WorkspaceConversationHistoryUrl")) {
    addFinding(findings, promptExchangeLaw, webChatSharedPath, "pick3-is-blind-eval/no-runtime-provider-history-delete", "Pick3 web-chat runtime must not call provider history deletion while provider history deletion is temporarily disabled.");
  }
  requireTokens(findings, promptExchangeLaw, webChatSubmitPath, existsRepoPath(webChatSubmitPath) ? readRepoText(webChatSubmitPath) : "", "pick3-is-blind-eval/submitted-image-binding", ["verifyLastUserMessageAttachments", "verify_last_user_message_bound_attachments", "provider_missing_bound_image"]);
  requireTokens(findings, promptExchangeLaw, webChatSubmitPath, existsRepoPath(webChatSubmitPath) ? readRepoText(webChatSubmitPath) : "", "pick3-is-blind-eval/gemini-prompt-submit-fallback", ["GEMINI_PROMPT_PASTE_VERIFY_TIMEOUT_MS = 5_000", "GEMINI_PROMPT_PASTE_RETRY_LIMIT = 3", "pasteTextReplacingInChrome", "gemini_clipboard_prompt_paste", "verify_gemini_prompt_pasted_before_submit"]);
  requireTokens(findings, promptExchangeLaw, webChatSubmitPath, existsRepoPath(webChatSubmitPath) ? readRepoText(webChatSubmitPath) : "", "pick3-is-blind-eval/gemini-prompt-timing-logs", ["[GRASSEYE][AI-GATEWAY][WEB-CHAT]", "gemini_clipboard_prompt_paste", "prompt_prepare", "verify_attachments_before_submit", "prompt_submit", "elapsedMs"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedPath, texts.webChatSharedText, "pick3-is-blind-eval/gemini-pre-submit-idle-guard", ["shouldSkipPreSubmitConversationState", "pre_submit_snapshot", "fresh_gemini_pick3_conversation"]);
  requireTokens(findings, promptExchangeLaw, webChatEvaluationPath, existsRepoPath(webChatEvaluationPath) ? readRepoText(webChatEvaluationPath) : "", "pick3-is-blind-eval/submitted-image-binding-dom", ["buildVerifyLastUserMessageAttachmentsScript", "[data-message-author-role='user']", "user-query, user-query-content, .user-query-container", "countGeminiBoundAttachments", "countChatGptBoundAttachments", "messageNode.parentElement", "messageNode.previousElementSibling", "WEB_CHAT_ATTACHMENT_COUNT_SCRIPT", "button[aria-label*='在文本字段中显示']", "[class*='file-tile' i]", "composerRootText.includes(\"在文本字段中显示\")", "isChatGptPastedTextTile", "isRealSubmittedAttachment", "findAttachmentTileRoot(node) || node", "provider last submitted user message contains bound image attachment"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedPath, texts.webChatSharedText, "pick3-is-blind-eval/missing-bound-image-recovery", ["isPick3MissingBoundImageError", "recoverPick3MissingBoundImageConversation", "pick3_missing_bound_image_recovery_without_history_delete_and_reopened_new_chat"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedPath, texts.webChatSharedText, "pick3-is-blind-eval/rate-limit-click-only-lifecycle", ["startPick3RateLimitDialogWatcher", "rateLimitDialogWatcher?.stop"]);
  for (const forbiddenRateLimitResend of ["recoverAfterPick3RateLimit", "same_payload_resend_started", "pick3_rate_limit_new_chat_reopened_for_resend"]) if (texts.webChatSharedText.includes(forbiddenRateLimitResend)) addFinding(findings, promptExchangeLaw, webChatSharedPath, "pick3-is-blind-eval/rate-limit-click-only-no-resend", `Pick3 rate-limit dialog handling must not contain ${forbiddenRateLimitResend}; only acknowledgement clicks are allowed.`);
  const recoveryLogText = existsRepoPath("src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts") ? readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts") : ""; requireTokens(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts", recoveryLogText, "pick3-is-blind-eval/rate-limit-recovery-logging", ["PICK3_RATE_LIMIT_WATCH_INTERVAL_MS = 500", "reservePick3RateLimitAttempt", "no attempt cap", "No reopen, no resend, no restart", "missionKey", "imageId", "promptPackageId", "recoveryAction", "isChatGptRateLimitDialogVisible", "acknowledgePick3RateLimitDialogIfVisible", "acknowledgePick3RateLimitIfVisible", "startPick3RateLimitDialogWatcher", "pick3_rate_limit_dialog_watcher_started", "rate_limit_ack_clicked_and_dialog_closed", "rate_limit_dialog_still_visible_after_ack", "querySelectorAll('[role=\"dialog\"], [data-radix-portal]')", "node.innerText"]); for (const forbiddenBackoff of ["PICK3_RATE_LIMIT_MAX_ACK_ATTEMPTS", "acknowledgePick3RateLimitImmediately", "pick3_rate_limit_immediate_acknowledgement_retry_exhausted", "PICK3_RATE_LIMIT_BACKOFF_MS", "waitWithPick3RateLimitHeartbeat", "pick3_rate_limit_backoff_waiting", "remainingMs, refs: { recoveryAction: \"pick3_rate_limit_backoff_waiting\" }", "do NOT interrupt", "pick3_rate_limit_chatgpt_refresh_completed", "and_refreshed"]) if (recoveryLogText.includes(forbiddenBackoff)) addFinding(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts", "pick3-is-blind-eval/rate-limit-no-backoff-before-ack", `Pick3 rate-limit recovery must not contain old backoff/refresh token ${forbiddenBackoff}.`);
  const submitText = existsRepoPath(webChatSubmitPath) ? readRepoText(webChatSubmitPath) : ""; requireTokens(findings, promptExchangeLaw, webChatSubmitPath, submitText, "pick3-is-blind-eval/rate-limit-submit-guard", ["acknowledgePick3SubmitRateLimitIfVisible", "isChatGptRateLimitDialogVisible", "acknowledgePick3RateLimitDialogIfVisible"]);
  inspectPick3WebChatUpload(findings, promptExchangeLaw, texts);
};

const inspectPick3WebChatUpload = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  const uploadText = existsRepoPath(webChatUploadPath) ? readRepoText(webChatUploadPath) : "";
  const composerText = existsRepoPath(webChatSubmitPath.replace("web-chat-submit.ts", "web-chat-composer-scripts.ts")) ? readRepoText(webChatSubmitPath.replace("web-chat-submit.ts", "web-chat-composer-scripts.ts")) : "";
  const clipboardText = existsRepoPath(webChatClipboardPath) ? readRepoText(webChatClipboardPath) : "";
  const selectorPreludeText = existsRepoPath(webChatSelectorPreludePath) ? readRepoText(webChatSelectorPreludePath) : "";
  requireTokens(findings, promptExchangeLaw, webChatUploadPath, uploadText, "pick3-is-blind-eval/gemini-clipboard-file-upload", ["copyFileObjectToMacClipboard", "pasteMacClipboardIntoChrome", "uploadSingleFileByClipboardPaste"]);
  requireTokens(findings, promptExchangeLaw, webChatUploadPath, uploadText, "pick3-is-blind-eval/gemini-upload-timing-logs", ["[GRASSEYE][AI-GATEWAY][WEB-CHAT]", "upload_file_clipboard_paste", "inputRefId", "elapsedMs", "COMPOSER_FOCUS_RETRY_TIMEOUT_MS = 15_000"]);
  requireTokens(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts", composerText, "pick3-is-blind-eval/chatgpt-file-tile-attachment-count", ["WEB_CHAT_ATTACHMENT_COUNT_SCRIPT", "findAttachmentTileRoot", "file-tile", "在文本字段中显示", "移除文件", "seenTiles.add(findAttachmentTileRoot(node) || node)"]);
  for (const forbiddenNativeChooserToken of ["selectFilePathInNativeChooser", "Upload files"]) {
    if (uploadText.includes(forbiddenNativeChooserToken) || clipboardText.includes(forbiddenNativeChooserToken)) {
      addFinding(findings, promptExchangeLaw, webChatUploadPath, "pick3-is-blind-eval/no-gemini-native-chooser", `Gemini web-chat upload must not keep native chooser token ${forbiddenNativeChooserToken}.`);
    }
  }
  if (clipboardText.includes("keystroke \"g\" using {command down, shift down}")) {
    addFinding(findings, promptExchangeLaw, webChatClipboardPath, "pick3-is-blind-eval/no-gemini-native-chooser", "Gemini web-chat upload must not use the macOS native chooser Go to Folder path.");
  }
  requireTokens(findings, promptExchangeLaw, webChatSelectorPreludePath, selectorPreludeText, "pick3-is-blind-eval/gemini-composer-selector", ["aria-label='Enter a prompt for Gemini'", "button[aria-label='Upload and tools']"]);
  if (texts.webChatPick3HistoryCleanupText.includes("deletePick3WorkspaceConversationHistoryUrl")) {
    addFinding(findings, promptExchangeLaw, webChatPick3HistoryCleanupPath, "pick3-is-blind-eval/no-current-provider-history-delete-export", "Provider current-conversation history deletion export must not exist while provider history deletion is temporarily disabled.");
  }
  requireTokens(findings, promptExchangeLaw, webChatWorkspacePath, texts.webChatWorkspaceText, "pick3-is-blind-eval/gemini-conversation-ledger", ["recordWorkspaceConversationUrl", "providerKind === \"gemini-web-chat\"", "https://gemini.google.com/app/", "PICK3_CONVERSATION_LEDGER_MAX_ENTRIES = 100", "slice(-PICK3_CONVERSATION_LEDGER_MAX_ENTRIES)"]);
  if (texts.webChatWorkspaceText.includes("const keptLedger = ledger.slice(-input.keepRecentCount)")) {
    addFinding(
      findings,
      promptExchangeLaw,
      webChatWorkspacePath,
      "pick3-is-blind-eval/conversation-ledger-not-truncated-by-tab-cleanup",
      `${webChatWorkspacePath} must not truncate the history-deletion ledger during stale tab cleanup.`,
    );
  }
  requireTokens(findings, promptExchangeLaw, blueprintPath, readRepoTextIfExists(blueprintPath), "pick3-is-blind-eval/provider-history-delete-disabled-blueprint", [
    "Temporary provider-history deletion disable rule",
    "provider_history_delete_temporarily_disabled",
    "current_history_delete_temporarily_disabled",
    "do not click Delete",
    "do not confirm Delete chat?",
  ]);
};

const inspectPick3PromptExchangeStorage = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  requireTokens(findings, promptExchangeLaw, storageSchemaPath, texts.storageSchemaText, "pick3-is-blind-eval/interaction-storage-schema", [
    "CREATE TABLE IF NOT EXISTS pick3_ai_interactions",
  ]);
  requireTokens(findings, promptExchangeLaw, "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts", texts.storageText, "pick3-is-blind-eval/interaction-storage", [
    "insertAiInteractions",
    "listAiInteractions",
  ]);
  requireTokens(findings, promptExchangeLaw, storageSchemaPath, texts.storageSchemaText, "pick3-is-blind-eval/prediction-schema-migration", [
    "PRAGMA table_info(ai_predictions)",
    "ALTER TABLE ai_predictions ADD COLUMN",
    "tail_shapes TEXT",
    "zone_weight TEXT",
    "driving_evidence TEXT",
  ]);
};

const inspectPick3PromptExchangeWorkbench = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  requireTokens(findings, promptExchangeLaw, workbenchPick3SupportPath, texts.workbenchPick3SupportText, "pick3-is-blind-eval/workbench-gateway-sender", [
    "assembly.aiInputGateway.execute",
    "pick3GatewaySender",
    "assembly.browserController",
    "runtimeLogger: assembly.runtimeLogger",
  ]);
  requireTokens(findings, promptExchangeLaw, appShellLayoutPath, texts.appShellLayoutText, "pick3-is-blind-eval/full-pipeline-ui", ["full_pipeline", "Full pipeline via GPT web chat", "AI provider", "gemini-web-chat", "name=\"promptMode\"", "AI free analysis mode", "free_analysis_strict_reasoning", "next_prediction_stability", "batch size is repeat sends of the same one image"]);
  requireTokens(findings, promptExchangeLaw, "src/app/workbench-home-pick3-client.ts", readRepoTextIfExists("src/app/workbench-home-pick3-client.ts"), "pick3-is-blind-eval/prompt-mode-submit", ["promptMode: form.promptMode.value"]);
};

const inspectPromptExchangeRuntime = (findings: InspectorFinding[], promptExchangeLaw: string): void => {
  const texts = readPromptExchangeTexts();
  const failureReviewText = existsRepoPath(failureReviewPath) ? readRepoText(failureReviewPath) : "";
  inspectPick3PromptExchangeCore(findings, promptExchangeLaw, texts);
  requireTokens(findings, promptExchangeLaw, failureReviewPath, failureReviewText, "pick3-is-blind-eval/failure-review-grammar-coverage", ["sharp_bottom", "bare_low", "sharp_top", "high_to_shoulder_edge", "shoulder_hold", "inertia", "surge_up", "kill_down"]);
  inspectPick3WebChatWorkspace(findings, promptExchangeLaw, texts);
  inspectPick3WebChatRecovery(findings, promptExchangeLaw, texts);
  inspectPick3PromptExchangeStorage(findings, promptExchangeLaw, texts);
  inspectPick3PromptExchangeWorkbench(findings, promptExchangeLaw, texts);
  if (texts.aiText.includes("Pick3ManualAiResponse")) {
    addFinding(findings, promptExchangeLaw, aiExchangePath, "pick3-is-blind-eval/no-direct-manual-ingestion", "Pick3 AI exchange must not use direct manual response ingestion.");
  }
};

const inspectPackageScripts = (findings: InspectorFinding[], primaryLaw: string, packageText: string): void => {
  requireTokens(findings, primaryLaw, packagePath, packageText, "pick3-is-blind-eval/package-scripts", [
    "\"audit:pick3-is-blind-eval\"",
    "\"acceptance:pick3-is-blind-eval\"",
  ]);
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = context.planEntry.lawIds;
  const lawRefs = buildLawRefs(lawIds);
  const findings: InspectorFinding[] = [];
  if (!context.project.getSourceFile(selfPath)) {
    addFinding(findings, lawRefs.primaryLaw, selfPath, "pick3-is-blind-eval/inspector-project-loaded", `${selfPath} must be loaded in the audit ts-morph project.`);
  }
  const lawText = existsRepoPath(lawPath) ? readRepoText(lawPath) : "";
  const blueprintText = existsRepoPath(blueprintPath) ? readRepoText(blueprintPath) : "";
  const packageText = existsRepoPath(packagePath) ? readRepoText(packagePath) : "";

  inspectFilesExist(findings, lawRefs.primaryLaw);
  inspectLawContract(findings, lawRefs, lawText);
  inspectBlueprintContract(findings, lawRefs, blueprintText);
  inspectAgentBrainContract(findings, lawRefs, lawText, blueprintText);
  inspectPlaybookFiles(findings, lawRefs.agentBrainLaw);
  inspectRuntimeExternalBrain(findings, lawRefs.agentBrainLaw);
  inspectPromptExchangeRuntime(findings, lawRefs.promptExchangeLaw);
  inspectPick3HumanReviewHistory({ blueprintText, findings, humanReviewHistoryLaw: lawRefs.humanReviewHistoryLaw, lawText });
  inspectPick3PlaybookLessonStore({ blueprintText, findings, lawText, lessonStoreLaw: lawRefs.lessonStoreLaw });
  inspectPick3TrendDisplay(findings, lawRefs.trendDisplayLaw, lawText, blueprintText);
  inspectPackageScripts(findings, lawRefs.primaryLaw, packageText);

  return {
    capabilityDomain: domain,
    reportedLawIds: lawIds,
    findings,
    inspectedFiles: inspectedFiles.filter(existsRepoPath),
  };
};
