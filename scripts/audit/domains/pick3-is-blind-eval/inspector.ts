import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const domain = "pick3-is-blind-eval";
const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const misplacedLawPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 法案.md";
const manifestPath = "scripts/audit/domains/pick3-is-blind-eval/manifest.json";
const selfPath = "scripts/audit/domains/pick3-is-blind-eval/inspector.ts";
const acceptancePath = "scripts/acceptance/pick3-is-blind-eval.acceptance.ts";
const packagePath = "package.json";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const workbenchPick3SupportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const playbookLoaderPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts";
const aiExchangePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts";
const flowPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts";
const aiGatewaySchemaPath = "src/capabilities/ai-input-gateway/schema.ts";
const webChatOpenPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
const webChatSharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const webChatSubmitPath = "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts"; const webChatEvaluationPath = "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts";
const webChatSharedSupportPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts"; const webChatWorkspacePath = "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts";
const webChatPick3HistoryCleanupPath = "src/capabilities/ai-input-gateway/providers/web-chat-pick3-history-cleanup.ts";
const scoringPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts";
const failureReviewPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.ts";
const promptVersioningPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.ts";
const storageSchemaPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts";
const playbookSystemPath = "src/plugins/pick3-is-blind-eval/playbooks/system.md";
const playbookGrammarPath = "src/plugins/pick3-is-blind-eval/playbooks/visual-grammar.md";
const playbookHundredsPath = "src/plugins/pick3-is-blind-eval/playbooks/is_hundreds_l80_v1.md";
const playbookTensPath = "src/plugins/pick3-is-blind-eval/playbooks/is_tens_l80_v1.md";
const playbookOnesPath = "src/plugins/pick3-is-blind-eval/playbooks/is_ones_l80_v1.md";

const inspectedFiles = [
  lawPath,
  blueprintPath,
  manifestPath,
  selfPath,
  acceptancePath,
  packagePath,
  appShellLayoutPath,
  workbenchPick3SupportPath,
  playbookLoaderPath,
  aiExchangePath,
  flowPath,
  aiGatewaySchemaPath,
  webChatOpenPath, webChatSharedPath, webChatSubmitPath, webChatEvaluationPath,
  webChatSharedSupportPath,
  webChatWorkspacePath,
  webChatPick3HistoryCleanupPath,
  scoringPath,
  failureReviewPath,
  promptVersioningPath,
  storageSchemaPath, playbookSystemPath, playbookGrammarPath, playbookHundredsPath, playbookTensPath, playbookOnesPath,
] as const;

const pluginRuntimePaths = [
  "src/plugins/pick3-is-blind-eval/index.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.official-api.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts",
] as const;

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");
const existsRepoPath = (repoPath: string): boolean => existsSync(resolveFromRepo(repoPath));

const addFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ checkId, filePath, lawId, message }));
};

const requireTokens = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  text: string,
  checkId: string,
  tokens: readonly string[],
): void => {
  for (const token of tokens) {
    if (!text.includes(token)) {
      addFinding(findings, lawId, filePath, checkId, `${filePath} must contain ${token}.`);
    }
  }
};

type LawRefs = {
  agentBrainLaw: string;
  blindBoundaryLaw: string;
  officialSourceLaw: string;
  primaryLaw: string;
  promptRepairLaw: string;
  promptExchangeLaw: string;
  statisticalHonestyLaw: string;
};

const buildLawRefs = (lawIds: readonly string[]): LawRefs => {
  const primaryLaw = lawIds[0] ?? "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1";
  return {
    primaryLaw,
    officialSourceLaw: lawIds.find((lawId) => lawId.endsWith("002-V1")) ?? primaryLaw,
    blindBoundaryLaw: lawIds.find((lawId) => lawId.endsWith("003-V1")) ?? primaryLaw,
    promptRepairLaw: lawIds.find((lawId) => lawId.endsWith("004-V1")) ?? primaryLaw,
    statisticalHonestyLaw: lawIds.find((lawId) => lawId.endsWith("005-V1")) ?? primaryLaw,
    agentBrainLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-IS-BRAIN-006-V1") ?? primaryLaw,
    promptExchangeLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1") ?? primaryLaw,
  };
};

const inspectFilesExist = (findings: InspectorFinding[], primaryLaw: string): void => {
  for (const repoPath of inspectedFiles) {
    if (!existsRepoPath(repoPath)) {
      addFinding(findings, primaryLaw, repoPath, "pick3-is-blind-eval/file-present", `${repoPath} must exist.`);
    }
  }
  if (existsRepoPath(misplacedLawPath)) {
    addFinding(
      findings,
      primaryLaw,
      misplacedLawPath,
      "pick3-is-blind-eval/misplaced-law-absent",
      "Pick3 active law must live under .github/instructions/agent-rules/modules, not docs/法案辅助文件.",
    );
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
    "full official coverage",
    "Success status with missing earliest history",
    "No betting",
    "No login",
    "No China lottery",
  ]);
};

const inspectBlueprintContract = (findings: InspectorFinding[], lawRefs: LawRefs, blueprintText: string): void => {
  requireTokens(findings, lawRefs.officialSourceLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/official-source", [
    "https://www.theuaelottery.ae/lottery/pick3",
    "https://www.theuaelottery.ae/lottery/pick3/results",
    "lotteryType=72",
    "command=660201",
    "command=660104",
    "command=660301",
    "260616",
    "4 2 7",
    "nums[0]",
    "officialStartTime",
    "officialEndTime",
    "verifyPick3FullHistoryCoverage",
    "pick3_full_history_missing_earliest",
    "pick3_full_history_missing_latest",
    "pick3_full_history_date_gap",
    "hundreds",
    "tens",
    "ones",
  ]);
  requireTokens(findings, lawRefs.blindBoundaryLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/blind-boundary", [
    "L=80",
    "one-image",
    "no text",
    "no Chart #",
    "no point-count text",
    "PredictionSeal",
    "prediction_hash",
    "Reveal And Scoring",
    "answer_digit",
  ]);
  requireTokens(findings, lawRefs.promptRepairLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/prompt-repair", [
    "Failure Review Flow",
    "Prompt Rewrite Flow",
    "Failure Replay Flow",
    "failure_replay",
    "not_valid_for_accuracy",
    "prompt_version",
  ]);
  requireTokens(findings, lawRefs.statisticalHonestyLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/statistical-honesty", [
    "model_id",
    "temperature",
    "image_detail",
    "system_prompt_version_id",
    "business_prompt_version_id",
    "confidence_is_probability",
    "subjective_model_strength_not_probability",
    "abstain",
    "coverageRate",
    "one-position baseline = 50%",
    "three-position combination baseline = 12.5%",
    "three-position hit rate > 25%",
    "approximate stable per-position hit rate > 63%",
    "confidence is not probability",
    "confidenceIsProbability: false",
  ]);
  requireTokens(findings, lawRefs.promptExchangeLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/prompt-exchange", [
    "Pick3 Prompt Exchange",
    "pick3_ai_interactions",
    "prompt_package_id",
    "prompt_contract_id",
    "raw_response_text",
    "raw_response_hash",
    "raw_output_ref",
    "provider_proof_json",
    "parse_status",
    "parse_failed_raw_available",
    "Pick3GatewaySender",
    "Manual GPT chat is allowed only as the capture surface",
    "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts",
    "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts",
  ]);
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
  for (const playbookPath of [playbookSystemPath, playbookGrammarPath, playbookHundredsPath, playbookTensPath, playbookOnesPath]) {
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
  aiText: string;
  flowText: string;
  aiGatewaySchemaText: string;
  appShellLayoutText: string;
  webChatOpenText: string;
  webChatSharedText: string;
  webChatPick3HistoryCleanupText: string;
  webChatSharedSupportText: string; webChatWorkspaceText: string;
  workbenchPick3SupportText: string; playbookLoaderText: string;
  storageSchemaText: string;
  storageText: string;
};

const readPromptExchangeTexts = (): PromptExchangeTexts => ({
  aiText: existsRepoPath(aiExchangePath) ? readRepoText(aiExchangePath) : "",
  flowText: existsRepoPath(flowPath) ? readRepoText(flowPath) : "",
  aiGatewaySchemaText: existsRepoPath(aiGatewaySchemaPath) ? readRepoText(aiGatewaySchemaPath) : "",
  appShellLayoutText: existsRepoPath(appShellLayoutPath) ? readRepoText(appShellLayoutPath) : "",
  webChatOpenText: existsRepoPath(webChatOpenPath) ? readRepoText(webChatOpenPath) : "",
  webChatSharedText: existsRepoPath(webChatSharedPath) ? readRepoText(webChatSharedPath) : "",
  webChatPick3HistoryCleanupText: existsRepoPath(webChatPick3HistoryCleanupPath) ? readRepoText(webChatPick3HistoryCleanupPath) : "",
  webChatSharedSupportText: existsRepoPath(webChatSharedSupportPath) ? readRepoText(webChatSharedSupportPath) : "",
  webChatWorkspaceText: existsRepoPath(webChatWorkspacePath) ? readRepoText(webChatWorkspacePath) : "",
  workbenchPick3SupportText: existsRepoPath(workbenchPick3SupportPath) ? readRepoText(workbenchPick3SupportPath) : "", playbookLoaderText: existsRepoPath(playbookLoaderPath) ? readRepoText(playbookLoaderPath) : "",
  storageSchemaText: existsRepoPath(storageSchemaPath) ? readRepoText(storageSchemaPath) : "",
  storageText: existsRepoPath("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts")
    ? readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts")
    : "",
});

const inspectPick3PromptExchangeCore = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  requireTokens(findings, promptExchangeLaw, aiExchangePath, texts.aiText, "pick3-is-blind-eval/prompt-exchange-runtime", [
    "Pick3GatewaySender",
    "buildPick3AiGatewayInput",
    "runPick3PromptExchange",
    "parse_failed_raw_available",
    "providerProofJson",
    "imageId",
    "promptPackageId",
    "Final output contract",
    "Do not return only `lower`, `upper`, or `abstain`",
    "lower | upper | abstain",
    "blind_series_package_",
    "sendWithEmptyOutputRetry",
    "attempt < 2",
    "empty-retry",
    "pick3_prediction_image_id_mismatch",
    "pick3_prediction_prompt_package_id_mismatch",
  ]);
  requireTokens(findings, promptExchangeLaw, playbookLoaderPath, texts.playbookLoaderText, "pick3-is-blind-eval/ai-visible-label-contract", ["allowedLabels: [\"lower\", \"upper\", \"abstain\"]"]);
  requireTokens(findings, promptExchangeLaw, flowPath, texts.flowText, "pick3-is-blind-eval/parse-failure-stop", [
    "pick3_prompt_exchange_parse_failed",
    "ai_prompt_exchange_failed",
    "writePromptExchangeFailureArtifacts",
    "exchange.predictions.length !== input.batch.images.length",
  ]);
};

const inspectPick3WebChatWorkspace = (
  findings: InspectorFinding[],
  promptExchangeLaw: string,
  texts: PromptExchangeTexts,
): void => {
  requireTokens(findings, promptExchangeLaw, webChatWorkspacePath, texts.webChatWorkspaceText, "pick3-is-blind-eval/single-gpt-workspace", [
    "PICK3_WORKSPACE_ID",
    "pick3-is-blind-eval",
    "recordWorkspaceConversationUrl",
    "cleanupStaleWorkspaceConversationTabs",
  ]);
  requireTokens(findings, promptExchangeLaw, webChatPick3HistoryCleanupPath, texts.webChatPick3HistoryCleanupText, "pick3-is-blind-eval/sidebar-history-cleanup", [
    "cleanupStaleWorkspaceConversationHistory",
    "PICK3_TRAINING_HISTORY_TITLE_MARKERS",
    "Blind Time-Series",
    "remainingLegacyUrls",
    "protectedPaths",
    "keepRecentCount",
  ]);
  requireTokens(findings, promptExchangeLaw, webChatOpenPath, texts.webChatOpenText, "pick3-is-blind-eval/no-tab-per-image", [
    "isPick3GptRequest",
    "workspaceId",
    "requiresFreshChatGptConversation",
    "reuse-host-tab",
    "isPick3WorkspaceId(input.workspaceId)",
  ]);
  requireTokens(findings, promptExchangeLaw, webChatSharedSupportPath, texts.webChatSharedSupportText, "pick3-is-blind-eval/provider-proof-cleanup", [
    "cleanupProviderWorkspaceAfterResponse",
    "reuse-single-provider-workspace-tab",
    "providerRecoveryAttemptCount",
    "providerRecoveryStatus",
    "staleConversationCleanupStatus",
    "staleConversationHistoryCleanupStatus",
    "Pick3 ChatGPT sidebar cleanup failed",
    "webChatWorkspaceId",
  ]);
  requireTokens(findings, promptExchangeLaw, webChatWorkspacePath, texts.webChatWorkspaceText, "pick3-is-blind-eval/workspace-url-normalization", [
    "normalizeWorkspaceUrl",
    "isPick3WorkspaceId",
    "`${parsed.origin}/`",
  ]);
  requireTokens(findings, promptExchangeLaw, aiGatewaySchemaPath, texts.aiGatewaySchemaText, "pick3-is-blind-eval/provider-proof-schema", [
    "webChatWorkspaceId",
    "providerTabPolicy",
    "providerRecoveryAttemptCount",
    "providerRecoveryStatus",
    "staleConversationCleanupStatus",
    "staleConversationHistoryCleanupStatus",
  ]);
  requireTokens(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts", texts.webChatSharedText, "pick3-is-blind-eval/no-result-recovery", [
    "PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000",
    "PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1",
    "provider_rate_limited_too_many_requests",
    "reuse-active-tab",
    "isPick3NoResultTimeoutError",
    "recoverPick3NoResultConversation",
    "deletePick3WorkspaceConversationHistoryUrl",
    "pick3_no_result_recovery_refreshed_deleted_current_conversation_and_reopened_new_chat",
  ]);
  requireTokens(findings, promptExchangeLaw, webChatSubmitPath, existsRepoPath(webChatSubmitPath) ? readRepoText(webChatSubmitPath) : "", "pick3-is-blind-eval/submitted-image-binding", ["verifyLastUserMessageAttachments", "verify_last_user_message_bound_attachments", "provider_missing_bound_image"]);
  requireTokens(findings, promptExchangeLaw, webChatEvaluationPath, existsRepoPath(webChatEvaluationPath) ? readRepoText(webChatEvaluationPath) : "", "pick3-is-blind-eval/submitted-image-binding-dom", ["buildVerifyLastUserMessageAttachmentsScript", "[data-message-author-role='user']", "provider last submitted user message contains bound image attachment"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedPath, texts.webChatSharedText, "pick3-is-blind-eval/missing-bound-image-recovery", ["isPick3MissingBoundImageError", "recoverPick3MissingBoundImageConversation", "pick3_missing_bound_image_recovery_deleted_current_conversation_and_reopened_new_chat"]);
  requireTokens(findings, promptExchangeLaw, webChatSharedPath, texts.webChatSharedText, "pick3-is-blind-eval/rate-limit-resume-visible", ["emitPick3RateLimitRecoveryStep", "same_payload_resend_started"]);
  const recoveryLogText = existsRepoPath("src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts") ? readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts") : ""; requireTokens(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts", recoveryLogText, "pick3-is-blind-eval/rate-limit-recovery-logging", ["RuntimeLogEventType.RECOVERY_PROGRESS", "HEARTBEAT_MS = 30_000", "PICK3_RATE_LIMIT_BACKOFF_MS = [600_000, 1_800_000, 3_600_000]", "reservePick3RateLimitAttempt", "missionKey", "imageId", "promptPackageId", "totalWaitSec", "elapsedSec", "remainingSec", "recoveryAction", "pick3_rate_limit_backoff_waiting", "pick3_rate_limit_acknowledgement_started", "pick3_rate_limit_chatgpt_refresh_completed", "and_refreshed", "querySelectorAll('[role=\"dialog\"], [data-radix-portal]')", "node.innerText"]); for (const forbiddenBackoff of ["180_000", "300_000"]) if (recoveryLogText.includes(forbiddenBackoff)) addFinding(findings, promptExchangeLaw, "src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts", "pick3-is-blind-eval/rate-limit-backoff-schedule", `Pick3 rate-limit schedule must not contain ${forbiddenBackoff}.`);
  requireTokens(findings, promptExchangeLaw, webChatPick3HistoryCleanupPath, texts.webChatPick3HistoryCleanupText, "pick3-is-blind-eval/current-history-delete", [
    "deletePick3WorkspaceConversationHistoryUrl",
    "current_history_deleted",
    "current_history_delete_verify_failed",
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
  ]);
  requireTokens(findings, promptExchangeLaw, appShellLayoutPath, texts.appShellLayoutText, "pick3-is-blind-eval/full-pipeline-ui", [
    "full_pipeline",
    "Full pipeline via GPT web chat",
  ]);
};

const inspectPromptExchangeRuntime = (findings: InspectorFinding[], promptExchangeLaw: string): void => {
  const texts = readPromptExchangeTexts();
  const failureReviewText = existsRepoPath(failureReviewPath) ? readRepoText(failureReviewPath) : "";
  inspectPick3PromptExchangeCore(findings, promptExchangeLaw, texts);
  requireTokens(findings, promptExchangeLaw, failureReviewPath, failureReviewText, "pick3-is-blind-eval/failure-review-grammar-coverage", ["sharp_bottom", "bare_low", "sharp_top", "high_to_shoulder_edge", "shoulder_hold", "inertia", "surge_up", "kill_down"]);
  inspectPick3WebChatWorkspace(findings, promptExchangeLaw, texts);
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
  const selfSourceFile = context.project.getSourceFile(selfPath);
  if (!selfSourceFile) {
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
  inspectPackageScripts(findings, lawRefs.primaryLaw, packageText);

  return {
    capabilityDomain: domain,
    reportedLawIds: lawIds,
    findings,
    inspectedFiles: inspectedFiles.filter(existsRepoPath),
  };
};
