import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import { createPick3BlindImages, renderPick3BlindChartSvg } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import { verifyPick3FullHistoryCoverage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.js";
import { buildPick3AiGatewayInput, runPick3PromptExchange, type Pick3GatewaySender } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { reviewPick3Failures } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.js";
import { listPick3TrendSnapshot } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.trend.js";
import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { revealPick3Predictions, scorePick3Predictions } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";
import { buildDatedDraw, buildDraw, buildEmptyFixtureAiResult, buildFixtureAiResult, buildRawTextFixtureAiResult, oppositeLabel, toVisibleLabel, visiblePromptPackageId } from "./pick3-is-blind-eval.acceptance-support.js";
const repoRoot = resolve(import.meta.dirname, "../..");
const fromRepo = (path: string): string => resolve(repoRoot, path);
const readRepoText = (path: string): string => readFileSync(fromRepo(path), "utf8");
type ValidFixtureInput = { imageId: string | undefined; promptPackageId: string; predictionLabel: string; confidence: number; reason: string };
const buildValidPredictionFixture = (input: ValidFixtureInput): Record<string, unknown> => ({ imageId: input.imageId, promptPackageId: input.promptPackageId, predictionLabel: input.predictionLabel, confidence: input.confidence, tailShapes: ["sharp_top"], zoneWeight: "lower_weighted", drivingEvidence: "sharp_top drove the lower conclusion", discountedEvidence: null, reason: input.reason, abstainReason: null });
const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const misplacedLawPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 法案.md";
const manifestPath = "scripts/audit/domains/pick3-is-blind-eval/manifest.json";
const inspectorPath = "scripts/audit/domains/pick3-is-blind-eval/inspector.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const pick3TrendClientPath = "src/app/workbench-home-pick3-trend-client.ts";
const workbenchPick3RoutesPath = "src/app/workbench-pick3-routes.ts";
const workbenchApiBoundaryPath = "src/app/workbench-api-boundary.ts";
const playbookLoaderPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts";
const aiExchangePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts";
const workbenchPick3SupportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const aiGatewaySchemaPath = "src/capabilities/ai-input-gateway/schema.ts";
const webChatOpenPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
const webChatWorkspacePath = "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts";
const webChatSharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const webChatSharedSupportPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts";
const webChatPick3HistoryCleanupPath = "src/capabilities/ai-input-gateway/providers/web-chat-pick3-history-cleanup.ts";
const playbookPaths = ["src/plugins/pick3-is-blind-eval/playbooks/system.md", "src/plugins/pick3-is-blind-eval/playbooks/visual-grammar.md"];
for (const removedPositionPlaybookPath of ["src/plugins/pick3-is-blind-eval/playbooks/is_hundreds_l80_v1.md", "src/plugins/pick3-is-blind-eval/playbooks/is_tens_l80_v1.md", "src/plugins/pick3-is-blind-eval/playbooks/is_ones_l80_v1.md"]) {
  assert.equal(existsSync(fromRepo(removedPositionPlaybookPath)), false, `${removedPositionPlaybookPath} must not exist; hand-authored position playbooks were deleted, real experience comes only from the live-assembled pick3_playbook_lessons pool`);
}
assert.equal(existsSync(fromRepo(lawPath)), true);
assert.equal(existsSync(fromRepo(blueprintPath)), true);
assert.equal(existsSync(fromRepo(manifestPath)), true);
assert.equal(existsSync(fromRepo(inspectorPath)), true);
assert.equal(existsSync(fromRepo(appShellLayoutPath)), true);
assert.equal(existsSync(fromRepo(pick3TrendClientPath)), true);
assert.equal(existsSync(fromRepo(workbenchPick3RoutesPath)), true);
assert.equal(existsSync(fromRepo(workbenchApiBoundaryPath)), true);
assert.equal(existsSync(fromRepo(playbookLoaderPath)), true);
assert.equal(existsSync(fromRepo(aiExchangePath)), true);
assert.equal(existsSync(fromRepo(workbenchPick3SupportPath)), true);
assert.equal(existsSync(fromRepo(aiGatewaySchemaPath)), true);
assert.equal(existsSync(fromRepo(webChatOpenPath)), true);
assert.equal(existsSync(fromRepo(webChatWorkspacePath)), true);
assert.equal(existsSync(fromRepo(webChatSharedPath)), true);
assert.equal(existsSync(fromRepo(webChatSharedSupportPath)), true);
assert.equal(existsSync(fromRepo(webChatPick3HistoryCleanupPath)), true);
for (const playbookPath of playbookPaths) assert.equal(existsSync(fromRepo(playbookPath)), true, `${playbookPath} must exist`);
assert.equal(existsSync(fromRepo(misplacedLawPath)), false);
const lawText = readRepoText(lawPath), blueprintText = readRepoText(blueprintPath);
const appShellLayoutText = readRepoText(appShellLayoutPath), pick3TrendClientText = readRepoText(pick3TrendClientPath), flowText = readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts");
const workbenchPick3SupportText = readRepoText(workbenchPick3SupportPath), aiGatewaySchemaText = readRepoText(aiGatewaySchemaPath);
const workbenchPick3RoutesText = readRepoText(workbenchPick3RoutesPath), workbenchApiBoundaryText = readRepoText(workbenchApiBoundaryPath);
const webChatOpenText = readRepoText(webChatOpenPath), webChatWorkspaceText = readRepoText(webChatWorkspacePath), webChatSharedText = readRepoText(webChatSharedPath);
const webChatSharedSupportText = readRepoText(webChatSharedSupportPath), webChatPick3HistoryCleanupText = readRepoText(webChatPick3HistoryCleanupPath);
const webChatRestorePolicyText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-restore-policy.ts");
const webChatUploadText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-upload.ts");
const webChatClipboardText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-clipboard.ts");
const webChatComposerText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts");
const webChatSelectorPreludeText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-selector-prelude.ts");
const webChatEvaluationText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts");
for (const token of ["```apex-law", "\"capabilityDomain\": \"pick3-is-blind-eval\"", "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1", "GRASSEYE-PICK3-IS-BRAIN-006-V1", "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1", "Pick3 GPT web-chat feeds must reuse one fixed AI Input Gateway workspace tab", "Pick3 GPT workspace tab reuse must be host/workspace based", "`/c/<conversation>` URLs may be recorded only in the conversation ledger", "Pick3 Gemini workspace tab reuse must record `https://gemini.google.com/app/<conversation>` URLs", "Pick3 GPT workspace opening must use `reuse-host-tab`", "Every Pick3 prompt and GPT output carries matching imageId and promptPackageId", "Playbook content sent to blind prediction must describe an anonymous time-series chart", "Pick3 Prompt Exchange may retry an empty web-chat raw output once", "explicitly non-directional", "normalized to internal `abstain`", "Pick3 GPT Prompt Exchange must detect ChatGPT rate-limit dialogs", "Pick3 GPT rate-limit recovery must not wait before clicking the acknowledgement", "Pick3 GPT web-chat transport must verify after submit that the last submitted user message contains the expected bound image attachment", "Pick3 provider sidebar history deletion is temporarily disabled", "provider_history_delete_temporarily_disabled", "current_history_delete_temporarily_disabled", "Pick3 training must preserve parsed prediction results when post-response provider history deletion is disabled", "Pick3 full pipeline must stop before reveal/scoring only after the same-chain Prompt Exchange completion queue is exhausted", "No one-GPT-tab-per-image behavior for Pick3 training"]) {
  assert.equal(lawText.includes(token), true, `law must include ${token}`);
}
for (const token of ["Prompt Exchange completion queue", "deferred_retry_scheduled", "expectedCount, completedCount, deferredRetryCount, skippedCount, and unresolvedCount", "remaining images/repeats continue", "Only final unresolved parse_failed_raw_available interactions", "provider-reported missing image", "three local retries", "skipped_provider_reported_image_missing"]) assert.equal(lawText.includes(token), true, `law must include production completion token ${token}`);
for (const token of ["GRASSEYE-PICK3-NEXT-PREDICTION-STABILITY-008-V1", "next_prediction_stability", "batchSize is the repeat-send count", "must not produce a final selected label"]) {
  assert.equal(lawText.includes(token), true, `next stability law must include ${token}`);
}
for (const token of ["GRASSEYE-PICK3-TREND-DISPLAY-010-V1", "stored official `pick3_draws`", "fixed 80-draw window", "three separated rows", "Hover exposes phase, official drawn numbers, and expected prize time", "Mouse drag changes the historical start index", "lastTargetPhase", "walk backward by `batchSize`", "database-backed phase", "Free-form typed lastTargetPhase as production truth"]) {
  assert.equal(lawText.includes(token), true, `trend display law must include ${token}`);
}
for (const token of ["https://www.theuaelottery.ae/lottery/pick3", "https://www.theuaelottery.ae/lottery/pick3/results", "lotteryType=72", "command=660201", "command=660104", "command=660301", "260616", "4 2 7", "L=80", "no Chart #", "no point-count text", "PredictionSeal", "failure_replay", "not_valid_for_accuracy", "model_id", "temperature", "image_detail", "system_prompt_version_id", "business_prompt_version_id", "confidence_is_probability", "abstain", "coverageRate", "officialStartTime", "officialEndTime", "pick3_full_history_missing_earliest", "pick3_full_history_missing_latest", "pick3_full_history_date_gap", "one-position baseline = 50%", "three-position combination baseline = 12.5%", "three-position hit rate > 25%", "approximate stable per-position hit rate > 63%", "confidence is not probability", "## AGENT-Owned IS Brain", "pick3_playbooks", "Pick3PlaybookPromptPackage", "Pick3 Prompt Exchange", "pick3_ai_interactions", "prompt_package_id", "prompt_contract_id", "raw_response_text", "raw_response_hash", "raw_output_ref", "provider_proof_json", "parse_status", "parse_failed_raw_available", "Pick3GatewaySender", "workspaceId = pick3-is-blind-eval", "workspace tab anchor = https://chatgpt.com/", "conversation ledger entries = https://chatgpt.com/c/<conversation-id>", "Gemini conversation ledger entries = https://gemini.google.com/app/<conversation-id>", "Record Gemini /app/<conversation-id> URLs", "Do not save a /c/<conversation-id> URL as the workspace tab anchor.", "Do not use reuse-exact-url against a /c/<conversation-id> URL to find the Pick3 workspace tab.", "open https://chatgpt.com/ with reuse-host-tab", "one browser tab per image", "imageId = opaque image id", "promptPackageId = active playbook package id", "de-lotteried anonymous time-series prompt", "no Pick3 / UAE / lottery / digit-game wording", "provider_proof_json.webChatWorkspaceId", "provider_proof_json.providerTabPolicy", "provider_proof_json.providerRecoveryStatus", "provider_proof_json.providerRecoveryAttemptCount", "provider_proof_json.staleConversationCleanupStatus", "lifecycle watcher = startPick3RateLimitDialogWatcher", "If the Pick3 GPT web-chat prompt has been submitted and no provider result is captured after 200 seconds", "refresh the current ChatGPT conversation URL in the same workspace tab", "do not delete that current ChatGPT conversation history entry while provider history deletion is temporarily disabled", "resend the same governed one-image prompt package exactly once", "current_history_delete_temporarily_disabled", "Submitted image binding proof:", "last [data-message-author-role=\"user\"] message contains at least one real image/attachment candidate", "provider_missing_bound_image", "temporarily skip provider sidebar history deletion", "provider_history_delete_temporarily_disabled", "Never open provider history sidebars, click Delete, or confirm Delete chat? while provider history deletion is temporarily disabled.", "If any one-image interaction has parse_status = parse_failed_raw_available", "If AI Input Gateway returns empty normalizedText", "If response is structured JSON but predictionLabel is an explicitly non-directional invalid word", "normalize to internal abstain with null confidence", "non_directional_prediction_label_<word>", "If response is structured JSON but predictionLabel is an explicit directional synonym", "normalize through the directional alias whitelist", "If response is structured JSON but predictionLabel is another invalid shape word", "do not map the shape word to lower/upper", "retry the same one-image prompt once through the same AI Input Gateway sender", "immediately click 明白了 / OK / Got it", "acknowledgement helper = acknowledgePick3RateLimitDialogIfVisible", "pre-submit conversation snapshot", "prompt pasted verification", "response capture", "injection path = createWorkbenchAiInputGateway -> AiInputGatewayExecutionContext -> AiProviderAdapterContext"]) {
  assert.equal(blueprintText.includes(token), true, `blueprint must include ${token}`);
}
for (const token of ["## Prompt Exchange Completion Queue", "continue sending the remaining images/repeats before returning to deferred work", "expectedCount = images.length * repeatCount", "unresolvedCount = expectedCount - completedCount", "If `unresolvedCount = 0`, full_pipeline may continue to reveal/scoring", "infinite retry loop"]) {
  assert.equal(blueprintText.includes(token), true, `blueprint must include production completion token ${token}`);
}
for (const token of ["### Next Prediction Stability Image", "visible = latest confirmed 80 official draws", "answerDigit = null", "batchSize = repeat-send count for the same image", "stability_results.json", "Do not show a final choice"]) {
  assert.equal(blueprintText.includes(token), true, `next stability blueprint must include ${token}`);
}
for (const token of ["## Official Trend Display", "official sync -> pick3_draws -> listPick3TrendSnapshot", "GET /api/pick3-is-blind-eval/trend", "windowSize: 80", "Default view = latest 80 stored official draws", "Rows = hundreds, tens, ones as three separated rows", "Hover point info = phase + official drawn numbers + expected prize time", "Dragging right/left changes the window location", "dropdown populated from stored official pick3_draws", "The UI must not use a free-form text box for lastTargetPhase in production."]) {
  assert.equal(blueprintText.includes(token), true, `trend display blueprint must include ${token}`);
}
for (const runtimePath of ["src/plugins/pick3-is-blind-eval/index.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts", "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts"]) {
  assert.equal(readRepoText(runtimePath).includes("trend-intuition-brain"), false, `${runtimePath} must not read external IS brain`);
}
for (const token of ['value="full_pipeline"', 'name="promptMode"', 'value="free_analysis_strict_reasoning"', 'name="lastTargetPhase"', 'data-pick3-last-target-phase', '<select name="lastTargetPhase"']) assert.equal(appShellLayoutText.includes(token), true, `Pick3 App Shell must expose ${token}.`);
const pick3ClientText = readRepoText("src/app/workbench-home-pick3-client.ts");
assert.equal(pick3ClientText.includes("renderPick3TargetClient"), true, "Pick3 client must include the target selector client module.");
const pick3TargetClientText = readRepoText("src/app/workbench-home-pick3-target-client.ts");
for (const token of ["renderPick3LastTargetPhaseOptions", "data-pick3-last-target-phase", "index >= windowSize", "Latest stored target"]) assert.equal(pick3TargetClientText.includes(token), true, `Pick3 target client must populate lastTargetPhase from stored draw options with ${token}`);
assert.match(readRepoText("src/app/workbench-home-pick3-client.ts"), /promptMode: form\.promptMode\.value/);
for (const token of ['data-workspace-page="trend"', "Official Trend", "Latest 80 draw window", "data-pick3-trend-chart", "data-pick3-trend-tooltip", "data-pick3-trend-refresh"]) {
  assert.equal(appShellLayoutText.includes(token), true, `Pick3 Trend App Shell must include ${token}`);
}
for (const token of ["pick3TrendPositions", "windowSize || 80", "showPick3TrendTooltip", "formatPick3TrendInfo", "bindPick3TrendDrag", "dragStartIndex", "/api/pick3-is-blind-eval/trend"]) {
  assert.equal(pick3TrendClientText.includes(token), true, `Pick3 Trend client must include ${token}`);
}
for (const token of ["handlePick3Trend", "/api/pick3-is-blind-eval/trend", "workbench.listPick3TrendSnapshot()"]) {
  assert.equal(workbenchPick3RoutesText.includes(token), true, `Pick3 Trend route must include ${token}`);
}
for (const token of ["/api/pick3-is-blind-eval/trend", "local_pick3_trend_snapshot", "externalApiAllowed: false"]) {
  assert.equal(workbenchApiBoundaryText.includes(token), true, `Pick3 Trend API boundary must include ${token}`);
}
assert.equal(workbenchPick3SupportText.includes("assembly.aiInputGateway.execute"), true, "Workbench Pick3 handle must reuse canonical AI Input Gateway.");
assert.equal(workbenchPick3SupportText.includes("pick3GatewaySender"), true, "Workbench Pick3 handle must pass Pick3GatewaySender.");
assert.equal(workbenchPick3SupportText.includes("assembly.browserController"), true, "Workbench Pick3 sender must use governed BrowserController.");
assert.equal(workbenchPick3SupportText.includes("runtimeLogger: assembly.runtimeLogger"), true, "Workbench Pick3 handle must pass Runtime Log Spine logger.");
assert.equal(aiGatewaySchemaText.includes("providerRecoveryAttemptCount"), true, "AI Input Gateway proof schema must include Pick3 recovery attempt count.");
assert.equal(aiGatewaySchemaText.includes("providerRecoveryStatus"), true, "AI Input Gateway proof schema must include Pick3 recovery status.");
const storageSchemaText = readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts");
for (const token of ["PRAGMA table_info(ai_predictions)", "ALTER TABLE ai_predictions ADD COLUMN", "tail_shapes TEXT", "zone_weight TEXT", "driving_evidence TEXT"]) assert.equal(storageSchemaText.includes(token), true, `Pick3 storage schema must migrate existing ai_predictions with ${token}`);
assert.equal(webChatOpenText.includes("reuse-host-tab"), true, "Pick3 GPT workspace open must use host-level tab reuse.");
assert.equal(webChatOpenText.includes("isPick3WorkspaceId(input.workspaceId)"), true, "Pick3 GPT workspace policy must branch on Pick3 workspace id.");
assert.equal(webChatWorkspaceText.includes("normalizeWorkspaceUrl"), true, "Pick3 workspace URLs must be normalized.");
assert.equal(webChatWorkspaceText.includes("`${parsed.origin}/`"), true, "Pick3 conversation URLs must normalize to the ChatGPT origin anchor.");
assert.equal(webChatSharedSupportText.includes("providerRecoveryAttemptCount"), true, "Web chat raw proof must carry recovery attempt count.");
assert.equal(webChatSharedSupportText.includes("providerRecoveryStatus"), true, "Web chat raw proof must carry recovery status.");
for (const token of ["PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000", "PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1", "isPick3NoResultTimeoutError", "recoverPick3NoResultConversation", "isPick3MissingBoundImageError", "recoverPick3MissingBoundImageConversation", "pick3_missing_bound_image_recovery_without_history_delete_and_reopened_new_chat", "pick3_no_result_recovery_refreshed_without_history_delete_and_reopened_new_chat"]) {
  assert.equal(webChatSharedText.includes(token), true, `web-chat shared runner must include ${token}`);
}
for (const token of ["isPick3GeminiRequest", "gemini.google.com", "reuse-active-tab", "gemini-web-chat:pick3-is-blind-eval:fresh"]) assert.equal(webChatOpenText.includes(token), true, `Gemini Pick3 fresh conversation must include ${token}`);
assert.equal(lawText.includes("Pick3 Gemini web-chat feeds must also reuse one fixed AI Input Gateway workspace tab"), true, "law must require fresh Gemini conversations per Pick3 image.");
assert.equal(blueprintText.includes("fresh conversation = navigate the existing Gemini workspace tab to https://gemini.google.com/app before every Pick3 image"), true, "blueprint must document the verified Gemini fresh conversation path.");
for (const token of ["Pick3 Gemini pre-image history cleanup must emit terminal-visible `pre_image_history_cleanup` timing logs", "provider_history_delete_temporarily_disabled", "pre_image_history_cleanup"]) assert.equal(lawText.includes(token), true, `law must include Gemini pre-image cleanup token ${token}`);
for (const token of ["Gemini pre-image cleanup rule", "provider_history_delete_temporarily_disabled", "do not block attachment upload for visible stale Gemini provider history while provider history deletion is disabled"]) assert.equal(blueprintText.includes(token), true, `blueprint must include Gemini pre-image cleanup token ${token}`);
const webChatRecoveryLogText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts"); assert.equal(webChatRecoveryLogText.includes("PICK3_RATE_LIMIT_MAX_ACK_ATTEMPTS"), false, "rate-limit recovery must not keep an attempt cap; the only action is click acknowledgement, repeated indefinitely"); assert.equal(webChatRecoveryLogText.includes("PICK3_RATE_LIMIT_WATCH_INTERVAL_MS = 500"), true, "rate-limit lifecycle watcher must poll during every web-chat feed phase"); assert.equal(webChatRecoveryLogText.includes("waitWithPick3RateLimitHeartbeat"), false, "rate-limit recovery must not keep the old wait-before-click helper"); assert.equal(webChatRecoveryLogText.includes("PICK3_RATE_LIMIT_BACKOFF_MS"), false, "rate-limit recovery must not keep a backoff schedule"); assert.equal(webChatRecoveryLogText.includes("pick3_rate_limit_backoff_waiting"), false, "rate-limit recovery must not emit backoff waiting progress"); assert.equal(webChatRecoveryLogText.includes("reservePick3RateLimitAttempt"), true, "rate-limit attempt counter must be mission-scoped, not one-image scoped"); for (const token of ["missionKey", "imageId", "promptPackageId", "recoveryAction"]) assert.equal(webChatRecoveryLogText.includes(token), true, `rate-limit logs must include ${token}`); for (const token of ["isChatGptRateLimitDialogVisible", "acknowledgePick3RateLimitDialogIfVisible", "acknowledgePick3RateLimitIfVisible", "startPick3RateLimitDialogWatcher", "pick3_rate_limit_dialog_watcher_started", "rate_limit_ack_clicked_and_dialog_closed", "rate_limit_dialog_still_visible_after_ack"]) assert.equal(webChatRecoveryLogText.includes(token), true, `rate-limit acknowledgement must include ${token}`); assert.equal(webChatRecoveryLogText.includes("pick3_rate_limit_chatgpt_refresh_completed"), false, "acknowledgement helper must only click and verify, not refresh"); assert.equal(webChatRecoveryLogText.includes("pick3_rate_limit_immediate_acknowledgement_retry_exhausted"), false, "rate-limit watcher must never escalate to review_required by attempt count; only-click is the entire policy"); assert.equal(webChatRecoveryLogText.includes("querySelectorAll('[role=\"dialog\"], [data-radix-portal]')"), true, "rate limit popup detection must not fall back to body"); assert.equal(webChatRecoveryLogText.includes("node.innerText"), true, "rate limit popup detection must use visible text"); assert.equal(webChatRecoveryLogText.includes("console."), false, "must use process.stdout.write, not console"); assert.equal(webChatRecoveryLogText.includes("process.stdout.write"), true, "terminal stdout is mandatory — must write to process.stdout"); const webChatSubmitText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-submit.ts"); for (const token of ["acknowledgePick3SubmitRateLimitIfVisible", "isChatGptRateLimitDialogVisible", "acknowledgePick3RateLimitDialogIfVisible"]) assert.equal(webChatSubmitText.includes(token), true, `submit waits must include rate-limit guard ${token}`);
const webChatSharedTextForRateLimit = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts"); assert.equal(webChatSharedTextForRateLimit.includes("recoverAfterPick3RateLimit"), false, "rate-limit response_capture detection must not reopen the page or resend the prompt; the only action is click acknowledgement"); assert.equal(webChatSharedTextForRateLimit.includes("pick3_rate_limit_same_payload_resend_started"), false, "rate-limit recovery must not resend the same payload");
const webChatEvaluationTextForRateLimit = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts"); assert.equal(webChatEvaluationTextForRateLimit.includes("provider_rate_limited_too_many_requests"), false, "response_capture in-page evaluation must not escalate a visible rate-limit dialog to review_required; it must keep polling as pending while the parallel click-ack handles dismissal");
assert.equal(webChatSharedText.includes("same_payload_resend_started"), false, "rate-limit recovery must never resend the same payload; the only action is click acknowledgement."); assert.equal(webChatSharedText.includes("startPick3RateLimitDialogWatcher"), true, "web-chat feed lifecycle must start the Pick3 rate-limit dialog watcher."); assert.equal(webChatSharedText.includes("rateLimitDialogWatcher?.stop"), true, "web-chat feed lifecycle must stop and surface watcher failures.");
	assert.equal(webChatSharedText.includes("screenshotRegion"), false, "Pick3 web-chat runtime must not put system screenshots in the per-image critical path.");
	for (const token of ["isPick3WebChatRequest", "outputRefs"]) assert.equal(webChatSharedText.includes(token), true, `Pick3 web-chat runtime must include ${token}`);
for (const token of ["copyFileObjectToMacClipboard", "pasteMacClipboardIntoChrome", "uploadSingleFileByClipboardPaste"]) assert.equal(webChatUploadText.includes(token), true, `Gemini web-chat upload must reuse GPT clipboard-file upload flow token: ${token}`); for (const token of ["selectFilePathInNativeChooser", "Upload files"]) assert.equal(webChatUploadText.includes(token), false, `Gemini web-chat upload must not keep native chooser token: ${token}`); assert.equal(webChatClipboardText.includes("keystroke \"g\" using {command down, shift down}"), false, "Gemini must not use a second native chooser file-selection path."); for (const token of ["user-query, user-query-content, .user-query-container", "countGeminiBoundAttachments"]) assert.equal(webChatEvaluationText.includes(token), true, `Gemini submitted-image binding proof must use Gemini user-query DOM token: ${token}`);
for (const token of ["WEB_CHAT_ATTACHMENT_COUNT_SCRIPT", "findAttachmentTileRoot", "file-tile", "在文本字段中显示", "移除文件", "seenTiles.add(findAttachmentTileRoot(node) || node)"]) assert.equal(webChatComposerText.includes(token), true, `ChatGPT file-tile attachment counting must include ${token}`);
for (const token of ["WEB_CHAT_ATTACHMENT_COUNT_SCRIPT", "countChatGptBoundAttachments", "messageNode.parentElement", "messageNode.previousElementSibling", "button[aria-label*='在文本字段中显示']", "[class*='file-tile' i]", "composerRootText.includes(\"在文本字段中显示\")", "isChatGptPastedTextTile", "isRealSubmittedAttachment", "findAttachmentTileRoot(node) || node"]) assert.equal(webChatEvaluationText.includes(token), true, `submitted image binding must recognize ChatGPT file-tile DOM token ${token}`);
for (const token of ["extractLastJsonObject", "extractFirstJsonObject", "location.hostname.includes(\"gemini.google.com\")", "Gemini said", "geminiStructuredJsonAnswer", "responseGenerating = geminiBodyAnswer || geminiStructuredJsonAnswer ? false : generating", "answer extracted from gemini structured json", "answer extracted from gemini body json"]) assert.equal(webChatEvaluationText.includes(token), true, `Gemini answer extraction must include ${token}`);
assert.equal(webChatSharedText.includes('input.request.providerKind === "gemini-web-chat" ? 1 : STABLE_ROUNDS_REQUIRED'), true, "Gemini answer capture must not wait on unstable assistant-count growth.");
assert.equal(webChatSelectorPreludeText.includes("aria-label='Enter a prompt for Gemini'"), true, "Gemini composer selector must include the live aria-label-backed contenteditable textbox.");
assert.equal(webChatSharedText.includes("pick3_no_result_recovery_reopened_gemini_new_chat"), true, "Gemini Pick3 no-result recovery must reopen Gemini new chat.");
for (const token of ["runtimeLogger?: RuntimeLogger", "PICK3_OFFICIAL_SYNC", "PICK3_BUILD_BLIND_BATCH", "PICK3_PROMPT_EXCHANGE", "PICK3_REVEAL_AND_SCORING", "PICK3_TASK"]) assert.equal(flowText.includes(token), true, `Pick3 flow must emit Runtime Log Spine stage ${token}`);
assert.equal(webChatSubmitText.includes("verifyLastUserMessageAttachments"), true, "Web chat submit must verify the last submitted user message has the bound image.");
assert.equal(webChatSubmitText.includes("provider_missing_bound_image"), true, "Web chat submit must fail missing bound images before GPT output is accepted.");
  const aiExchangeText = readRepoText(aiExchangePath), aiOutputContractText = [aiExchangeText, readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-contract.ts"), readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-parse.ts")].join("\n"); for (const token of ["未收到图片", "pick3_provider_reported_image_missing", "RECOVERABLE_PARSE_FAILURE_REASONS", "PICK3_PROVIDER_REPORTED_MISSING_IMAGE_RETRY_COUNT = 3", "skipped_provider_reported_image_missing", "pick3_provider_reported_image_missing_retry_exhausted", "skipped_missing_image"]) assert.equal(aiOutputContractText.includes(token), true, `Pick3 prompt exchange must retry provider-reported missing images with ${token}`);
for (const token of ["[GRASSEYE][PICK3][EXCHANGE]", "send_started", "send_result", "parse_result", "empty_raw_output", "WARN empty_raw_output", "rawLen=", "boundVerify=", "parseStatus=", "parseFailureReason=", "predictionLabel=", "targetPhase=", "process.stdout.write"]) assert.equal(aiExchangeText.includes(token), true, `pick3 AI exchange must emit terminal log token: ${token}`);
for (const token of ["provider_history_delete_temporarily_disabled"]) assert.equal(webChatPick3HistoryCleanupText.includes(token), true, `Pick3 history cleanup must include ${token}`);
assert.equal(webChatPick3HistoryCleanupText.includes("deletePick3WorkspaceConversationHistoryUrl"), false, "Pick3 provider current-history delete export must stay removed while provider history deletion is temporarily disabled.");
  const webChatSubmitTextFull = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-submit.ts");
  for (const token of ["dismissFloatingMenus", "Escape", "5_000"]) assert.equal(webChatSubmitTextFull.includes(token), true, `web-chat-submit must include ${token}`);
  for (const token of ["GEMINI_PROMPT_PASTE_VERIFY_TIMEOUT_MS = 5_000", "GEMINI_PROMPT_PASTE_RETRY_LIMIT = 3", "pasteTextReplacingInChrome", "gemini_clipboard_prompt_paste", "verify_gemini_prompt_pasted_before_submit"]) assert.equal(webChatSubmitTextFull.includes(token), true, `Gemini prompt submit must include ${token}`);
  for (const token of ["[GRASSEYE][AI-GATEWAY][WEB-CHAT]", "gemini_clipboard_prompt_paste", "prompt_prepare", "verify_attachments_before_submit", "prompt_submit", "elapsedMs"]) assert.equal(webChatSubmitTextFull.includes(token), true, `Gemini prompt timing logs must include ${token}`);
  const webChatSharedTextFull = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts");
  for (const token of ["shouldSkipPreSubmitConversationState", "pre_submit_snapshot", "fresh_gemini_pick3_conversation"]) assert.equal(webChatSharedTextFull.includes(token), true, `Gemini upload-to-prompt idle guard must include ${token}`);
for (const token of ["providerKind === \"gemini-web-chat\"", "promptContractId.startsWith(\"pick3-is-blind-eval\")", "deferred_gemini_pick3_post_batch_cleanup_required"]) assert.equal(webChatSharedSupportText.includes(token), true, `Gemini Pick3 per-image cleanup must defer post-batch history work with ${token}`);
  for (const token of ["cleanupGeminiPick3HistoryBeforeNextImage", "isBlockingGeminiPick3PreImageHistoryCleanupStatus"]) assert.equal(webChatSharedSupportText.includes(token), true, `Gemini pre-image history cleanup helper must include ${token}`);
  for (const token of ["pre_image_history_cleanup", "delete_previous_stale_history_before_next_image", "before attachment upload"]) assert.equal(webChatSharedTextFull.includes(token), true, `Gemini pre-image history cleanup runtime must include ${token}`);
  for (const token of ["provider_composer_ready", "provider_composer_ready_probe", "PROVIDER_COMPOSER_READY_TIMEOUT_MS = 60_000"]) assert.equal(webChatOpenText.includes(token), true, `Gemini composer readiness logs must include ${token}`);
  for (const token of ["read active provider workspace URL", "getSessionState().currentUrl"]) assert.equal(webChatOpenText.includes(token), true, `provider workspace URL persistence must include ${token}`);
  for (const token of ["chrome-error://", "recover provider page before attachment upload", "phase === \"attachment upload\""]) assert.equal(webChatSharedSupportText.includes(token), true, `provider error-page recovery must include ${token}`);
  for (const token of ["upload_file_clipboard_paste", "inputRefId", "elapsedMs", "COMPOSER_FOCUS_RETRY_TIMEOUT_MS = 15_000"]) assert.equal(webChatUploadText.includes(token), true, `Gemini upload timing logs must include ${token}`);
assert.equal(lawText.includes("must not burn the generic 20-second GPT clipboard-paste verification window"), true, "law must forbid Gemini 20s clipboard-paste burn.");
for (const token of ["provider history deletion is temporarily disabled", "falling back to the browser session current URL", "before attachment upload"]) assert.equal(lawText.includes(token), true, `law must include ${token}`);
assert.equal(blueprintText.includes("prompt entry = for Gemini, focus the verified Quill composer and use real clipboard paste immediately after upload"), true, "blueprint must document verified Gemini real-paste prompt entry.");
for (const token of ["Temporary provider-history deletion disable rule", "workspace URL persistence", "provider error page recovery"]) assert.equal(blueprintText.includes(token), true, `blueprint must include ${token}`);
const webChatPageActionsText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts"); assert.equal(webChatPageActionsText.includes("Math.min(timeoutMs, 5_000)"), true, "waitForComposerFocused hard cap must be 5000ms (not 2000ms)");
for (const token of ["provider_history_delete_temporarily_disabled"]) assert.equal(webChatPick3HistoryCleanupText.includes(token), true, `history cleanup must safely disable provider deletion with ${token}`);
for (const token of ["PICK3_CONVERSATION_LEDGER_MAX_ENTRIES = 100", "slice(-PICK3_CONVERSATION_LEDGER_MAX_ENTRIES)"]) assert.equal(webChatWorkspaceText.includes(token), true, `Pick3 conversation ledger must retain full-run cleanup evidence with ${token}`); assert.equal(webChatWorkspaceText.includes("const keptLedger = ledger.slice(-input.keepRecentCount)"), false, "stale tab cleanup must not truncate the history-deletion ledger.");
assert.equal(webChatSharedSupportText.includes("Pick3 ChatGPT sidebar cleanup failed"), false, "raw output must not be dropped by post-response sidebar cleanup failure"); assert.equal(aiExchangeText.includes("cleanupStatus="), true, "Pick3 exchange must log provider cleanup failure without overwriting parsed predictions"); assert.equal(aiExchangeText.includes("pick3_provider_cleanup_failed_"), false, "Pick3 exchange must not convert cleanup failure into parse failure");
assert.equal(webChatRestorePolicyText.includes("PICK3_PROMPT_CONTRACT_PREFIX"), true, "Pick3 raw output must survive post-response source restore failure.");
assert.equal(webChatRestorePolicyText.includes("pick3-is-blind-eval"), true, "Pick3 source restore exception must be Pick3 contract-scoped.");
for (const playbookPath of playbookPaths) { const playbookText = readRepoText(playbookPath); for (const forbidden of ["0-4", "5-9", "0-2", "7-9", "Pick3", "UAE", "lottery", "pick3-is-blind-eval"]) assert.equal(playbookText.includes(forbidden), false, `${playbookPath} must not contain numeric bucket ${forbidden}`); }
const systemPlaybookText = readRepoText("src/plugins/pick3-is-blind-eval/playbooks/system.md");
const visualGrammarText = readRepoText("src/plugins/pick3-is-blind-eval/playbooks/visual-grammar.md");
assert.equal(systemPlaybookText.includes("Phase 1"), true, "system.md must declare Phase 1 mode");
assert.equal(systemPlaybookText.includes("Analysis is mandatory"), true, "system.md Phase 1 must require analysis, not guessing");
assert.equal(systemPlaybookText.includes("Guessing is forbidden"), true, "system.md must explicitly forbid guessing");
assert.equal(systemPlaybookText.includes("Ambiguity alone is not sufficient reason to abstain"), true, "system.md must reject ambiguity as abstain justification");
assert.equal(systemPlaybookText.includes("Evidence requirement") || systemPlaybookText.includes("Mandatory evidence output"), true, "system.md must require evidence naming");
assert.equal(systemPlaybookText.includes("tailShapes"), true, "system.md output contract must include tailShapes field");
assert.equal(systemPlaybookText.includes("zoneWeight"), true, "system.md output contract must include zoneWeight field");
assert.equal(systemPlaybookText.includes("drivingEvidence"), true, "system.md output contract must include drivingEvidence field");
assert.equal(systemPlaybookText.includes("discountedEvidence"), true, "system.md output contract must include discountedEvidence field");
assert.equal(systemPlaybookText.includes("opposing signal"), true, "system.md must explain discountedEvidence purpose as opposing signal");
assert.equal(systemPlaybookText.includes("Contrarian override rule"), true, "system.md must declare contrarian override rule for discountedEvidence");
assert.equal(systemPlaybookText.includes("must NOT be null"), true, "system.md must state discountedEvidence is non-null when contrarian override applies");
assert.equal(systemPlaybookText.includes("lower_weighted"), true, "system.md must define lower_weighted as valid zoneWeight value");
assert.equal(systemPlaybookText.includes("When confidence is low (can't clearly name a shape), always choose `abstain`"), false, "system.md must NOT contain old forced-abstain rule");
assert.equal(visualGrammarText.includes("0.75"), true, "visual-grammar must allow confidence up to 0.75 in Phase 1");
assert.equal(visualGrammarText.includes("bare_low` means the tail weight is in the lower zone"), true, "visual-grammar must define bare_low as lower-leaning, not abstain-forcing");
assert.equal(visualGrammarText.includes("Analysis discipline"), true, "visual-grammar must have Analysis discipline section, not just evidence discipline");
assert.equal(visualGrammarText.includes("Unnamed intuition is not valid evidence"), true, "visual-grammar must forbid unnamed intuition");
assert.equal(visualGrammarText.includes("Do not choose `abstain` because the signal is weak"), true, "visual-grammar must forbid weak-signal abstain");
assert.equal(visualGrammarText.includes("Vocabulary restriction"), true, "visual-grammar must declare vocabulary restriction for tailShapes");
assert.equal(visualGrammarText.includes("informal and invalid in `tailShapes`"), true, "visual-grammar must explicitly label informal descriptors as invalid in tailShapes");
assert.equal(systemPlaybookText.includes("Words must come from the visual-grammar vocabulary only"), true, "system.md must require tailShapes words to come from visual-grammar vocabulary only");
assert.equal(systemPlaybookText.includes("informal descriptors"), true, "system.md must call out informal descriptors as invalid");
const lawText2 = readRepoText(lawPath);
assert.equal(lawText2.includes("tailShapes` values must be drawn exclusively from the named vocabulary"), true, "law must enforce tailShapes vocabulary restriction");
assert.equal(lawText2.includes("surge_up"), true, "law must enumerate valid tailShapes vocabulary words");
assert.equal(lawText2.includes("discountedEvidence"), true, "law must require discountedEvidence field in output contract");
assert.equal(lawText2.includes("opposing signal"), true, "law must explain discountedEvidence as opposing signal field");
assert.equal(lawText2.includes("V2 correction rules"), true, "law must state discountedEvidence purpose for V2 correction rules");
assert.equal(lawText2.includes("contrarian override"), true, "law must address contrarian override and discountedEvidence non-null requirement");
assert.equal(lawText2.includes("standard grammar interpretation being overridden IS the discounted evidence"), true, "law must state that overridden standard grammar = discounted evidence");
for (const token of ["zoneCount", "patternRecurrence", "weakestLink", "counted not estimated", "must not be confused with the V1 evidence fields"]) {
  assert.equal(lawText2.includes(token), true, `law must include Free Analysis probing field token ${token}`);
}
const blueprintText2 = readRepoText(blueprintPath);
for (const token of ["mandatory zoneCount", "mandatory patternRecurrence", "mandatory weakestLink", "probing fields, not vocabulary or direction"]) {
  assert.equal(blueprintText2.includes(token), true, `blueprint must include Free Analysis probing field token ${token}`);
}
const freeAnalysisPlaybookText = readRepoText("src/plugins/pick3-is-blind-eval/playbooks/free-analysis-strict-reasoning.md");
for (const token of ["zoneCount", "patternRecurrence", "weakestLink", "Self-check before you answer", "a single occurrence is weak evidence, not a rule"]) {
  assert.equal(freeAnalysisPlaybookText.includes(token), true, `free-analysis playbook must include probing field token ${token}`);
}
const aiContractText = readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-contract.ts");
for (const token of ["lowerCount", "upperCount", "patternRecurrence", "weakestLink", "zoneCount must be two non-negative integers"]) {
  assert.equal(aiContractText.includes(token), true, `ai-contract output shape must include Free Analysis probing field token ${token}`);
}
// Contrarian-override discountedEvidence contract now lives only in system.md (asserted above);
// there is no Stream A/B/C position file to carry a position-specific contrarian example.

const latestPayload = { data: { lotteryType: 72, includeSelf: 1, isDesc: 1, prePhases: 10, alreadyDrawn: 1 } };
const encoded = Buffer.from(JSON.stringify(latestPayload), "utf8").toString("base64");
assert.deepEqual(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")), latestPayload);

const officialRow = { phase: "260616", result: [{ key: "pick3", data: ["4", "2", "7"] }] };
const nums = officialRow.result[0]?.data ?? [];
assert.deepEqual({ drawNo: officialRow.phase, hundreds: Number(nums[0]), tens: Number(nums[1]), ones: Number(nums[2]) }, { drawNo: "260616", hundreds: 4, tens: 2, ones: 7 });

assert.equal(0.5, 1 / 2);
assert.equal(0.125, 1 / 8);
assert.ok(Math.pow(0.63, 3) < 0.251);
assert.ok(Math.pow(0.64, 3) > 0.25);

  const fullCoverageDraws = [buildDatedDraw("2025-06-04", 1), buildDatedDraw("2025-06-05", 2), buildDatedDraw("2025-06-06", 3)];
  verifyPick3FullHistoryCoverage({ bounds: { startTime: "2025-06-04", endTime: "2025-06-06" }, drawsAscending: fullCoverageDraws });
assert.throws(
  () => verifyPick3FullHistoryCoverage({ bounds: { startTime: "2025-06-04", endTime: "2025-06-06" }, drawsAscending: fullCoverageDraws.slice(1) }),
  /pick3_full_history_missing_earliest/,
);
assert.throws(
  () => verifyPick3FullHistoryCoverage({ bounds: { startTime: "2025-06-04", endTime: "2025-06-06" }, drawsAscending: fullCoverageDraws.slice(0, 2) }),
  /pick3_full_history_missing_latest/,
);
assert.throws(
  () => verifyPick3FullHistoryCoverage({ bounds: { startTime: "2025-06-04", endTime: "2025-06-06" }, drawsAscending: [fullCoverageDraws[0]!, fullCoverageDraws[2]!] }),
  /pick3_full_history_date_gap_2025-06-05/,
);

const tempDataDir = mkdtempSync(resolve(tmpdir(), "pick3-is-blind-eval-"));
const storage = openPick3Storage(tempDataDir);
try {
  const draws = Array.from({ length: 100 }, (_, index) => buildDraw(index + 1));
  const firstUpsert = storage.upsertDraws(draws);
  assert.equal(firstUpsert.inserted, 100);
  assert.equal(firstUpsert.updated, 0);
  const secondUpsert = storage.upsertDraws(draws);
  assert.equal(secondUpsert.inserted, 0);
  assert.equal(secondUpsert.updated, 0);
  assert.equal(storage.listDrawsAscending().length, 100);
  const trendSnapshot = listPick3TrendSnapshot(tempDataDir);
  assert.equal(trendSnapshot.source, "pick3_draws");
  assert.equal(trendSnapshot.windowSize, 80);
  assert.equal(trendSnapshot.drawCount, 100);
  assert.equal(trendSnapshot.latestWindowStartIndex, 20);
  assert.equal(trendSnapshot.latestPhase, draws[99]?.phase);
  assert.equal(trendSnapshot.draws[0]?.positions.hundreds, draws[0]?.hundreds);
  assert.equal(trendSnapshot.draws[0]?.numbers, draws[0]?.resultText);

  const targets = storage.listTargetDraws({ batchSize: 2 });
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((draw) => draw.phase), [draws[98]!.phase, draws[99]!.phase]);
  const historicalTargets = storage.listTargetDraws({ batchSize: 3, lastPhase: draws[90]!.phase });
  assert.deepEqual(historicalTargets.map((draw) => draw.phase), [draws[88]!.phase, draws[89]!.phase, draws[90]!.phase]);
  assert.equal(storage.listTargetDraws({ batchSize: 3, lastPhase: draws[20]!.phase }).length, 0);
  assert.equal(storage.listTargetDraws({ batchSize: 3, lastPhase: "missing-phase" }).length, 0);
  const artifactDir = resolve(tempDataDir, "artifacts", "acceptance-batch");
  const images = await createPick3BlindImages({
    artifactDir,
    batchId: "acceptance-batch",
    drawsAscending: storage.listDrawsAscending(),
    positions: ["hundreds", "tens", "ones"],
    targetDraws: targets,
  });
  assert.equal(images.length, 6);
  const playbooks = loadBuiltInPick3Playbooks();
  assert.equal(playbooks.length, 3);
  storage.upsertPlaybooks(playbooks);
  assert.equal(storage.listActivePlaybooks().length, 3);
  const promptPackages = [];
  for (const image of images) {
    assert.equal(existsSync(image.imagePath), true);
    assert.ok(statSync(image.imagePath).size > 1000);
    assert.equal(image.imagePath.includes(image.targetPhase), false);
    assert.equal(image.imagePath.includes(`answer_${image.answerDigit}`), false);
    assert.equal(image.imagePath.includes(`/${image.position}/`), false);
    assert.equal(image.imagePath.includes("Chart"), false);
    assert.equal(image.imagePath.includes("points"), false);
    const imageSource = readFileSync(image.imagePath);
    const { width: imgWidth, height: imgHeight } = await sharp(imageSource).metadata();
    assert.equal(imgWidth, 12340, `blind chart image must be 5x wide; got ${imgWidth}`);
    assert.equal(imgHeight, 1500, `blind chart image must be 5x tall; got ${imgHeight}`);
    const playbook = playbooks.find((item) => item.position === image.position);
    assert.ok(playbook);
    const sampleSvg = renderPick3BlindChartSvg([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(sampleSvg.includes('stroke="#dc2626"'), true, "midline must render as red (#dc2626), not the old gray, for AI visual contrast against the blue data line");
    assert.equal(sampleSvg.includes("stroke-dasharray=\"40 30\""), true, "midline must render dashed (40 30 dash pattern) so the AI can distinguish it from the solid blue data line");
    assert.equal(sampleSvg.includes('stroke="#d1d5db"'), false, "midline must not still use the old solid gray color");
    const promptPackage = buildPick3PlaybookPromptPackage(playbook, image);
    promptPackages.push(promptPackage);
    assert.equal(promptPackage.confidenceIsProbability, false);
    assert.deepEqual(promptPackage.allowedLabels, ["lower", "upper", "abstain"]);
    const promptJson = JSON.stringify(promptPackage);
    assert.equal(promptJson.includes(image.targetPhase), false);
    assert.equal(promptJson.includes(image.targetExpectedPrizeTime), false);
    assert.equal(promptJson.includes("answerDigit"), false);
    assert.equal(promptJson.includes("answerLabel"), false);
    assert.equal(promptJson.includes("targetPhase"), false);
    assert.equal(promptJson.includes("expectedPrizeTime"), false);
    assert.equal(promptJson.includes("trend-intuition-brain"), false);
  }
  const imageById = new Map(images.map((image) => [image.imageId, image]));
  const sampleGatewayInput = buildPick3AiGatewayInput({ batchId: "acceptance-batch", image: images[0]!, promptPackage: promptPackages[0]!, providerKind: "gemini-web-chat" });
  assert.equal(sampleGatewayInput.providerKind, "gemini-web-chat");
  assert.equal(sampleGatewayInput.inputRefs.length, 1);
  assert.equal(sampleGatewayInput.textPrompt.includes("predictionLabel"), true);
  assert.equal(sampleGatewayInput.textPrompt.includes("lower | upper | abstain"), true);
  assert.equal(sampleGatewayInput.textPrompt.includes("front | back | abstain"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("AGENT-owned"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("Pick3"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("UAE"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("lottery"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("pick3_"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("blind_series_package_"), true);
  const observedInputs: AiFeedInput[] = [];
  const sender: Pick3GatewaySender = async (input) => {
    observedInputs.push(input);
    const image = imageById.get(input.inputRefs[0]?.id ?? "");
    assert.ok(image);
    assert.ok(image.answerLabel);
    const predictionLabel = observedInputs.length === 1 ? oppositeLabel(image.answerLabel) : image.answerLabel;
    return buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify(buildValidPredictionFixture({
        imageId: input.inputRefs[0]?.id,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel: toVisibleLabel(predictionLabel),
        confidence: 0.56,
        reason: "sharp_top tail shape is clear enough for this fixture",
      })),
    });
  };
  const exchange = await runPick3PromptExchange({ postParseDelayMsOverride: 0, artifactDir, images, promptPackages, sender });
  assert.equal(observedInputs.length, images.length);
  assert.equal(exchange.interactions.length, images.length);
  assert.equal(exchange.predictions.length, images.length);
  assert.equal(exchange.interactions.every((interaction) => interaction.parseStatus === "parsed"), true);
  assert.equal(exchange.predictions.every((prediction) => prediction.sealedBeforeReveal), true);
  storage.insertAiInteractions(exchange.interactions);
  storage.insertPredictions(exchange.predictions);
  assert.equal(storage.listAiInteractions("acceptance-batch").length, images.length);
  assert.equal(storage.listPredictions("acceptance-batch").length, images.length);

  const reveals = revealPick3Predictions({ images, predictions: exchange.predictions });
  storage.insertReveals(reveals);
  assert.equal(storage.listReveals("acceptance-batch").length, images.length);
  const scoring = scorePick3Predictions({ predictions: exchange.predictions, reveals });
  assert.equal(scoring.total, images.length);
  assert.equal(scoring.misses, 1);
  assert.equal(scoring.hits, images.length - 1);
  assert.equal(scoring.randomBaseline.onePositionFrontBack, 0.5);
  assert.equal(scoring.randomBaseline.threePositionCombination, 0.125);
  assert.equal(scoring.calibration.every((row) => row.confidenceIsProbability === false), true);

  const failureReviews = reviewPick3Failures({ images, predictions: exchange.predictions, reveals });
  storage.insertFailureReviews(failureReviews);
  assert.deepEqual(failureReviews.map((review) => review.failureType), ["high_exhaustion_missed"]);
  assert.equal(storage.listFailureReviews("acceptance-batch").length, 1);

  const badExchange = await runPick3PromptExchange({ postParseDelayMsOverride: 0, artifactDir, images: [images[0]!], promptPackages: [promptPackages[0]!],
    sender: async (input) => buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        imageId: input.inputRefs[0]?.id,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel: "not-a-label",
        confidence: 0.56,
        reason: "invalid fixture",
      abstainReason: null,
      }),
    }),
  });
  assert.equal(badExchange.interactions.length, 1);
  assert.equal(badExchange.interactions[0]?.parseStatus, "parse_failed_raw_available");
  assert.equal(badExchange.predictions.length, 0);
  let nonDirectionalLabelCalls = 0;
  const nonDirectionalLabelExchange = await runPick3PromptExchange({ postParseDelayMsOverride: 0, artifactDir, images: [images[0]!], promptPackages: [promptPackages[0]!],
    sender: async (input) => {
      nonDirectionalLabelCalls += 1;
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify(buildValidPredictionFixture({
          imageId: input.inputRefs[0]?.id,
          promptPackageId: visiblePromptPackageId(input),
          predictionLabel: "hold",
          confidence: 0.55,
          reason: "non-directional invalid label fixture",
        })),
      });
    },
  });
  assert.equal(nonDirectionalLabelCalls, 1);
  assert.equal(nonDirectionalLabelExchange.interactions.length, 1);
  assert.equal(nonDirectionalLabelExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(nonDirectionalLabelExchange.predictions.length, 1);
  assert.equal(nonDirectionalLabelExchange.predictions[0]?.predictionLabel, "abstain");
  assert.equal(nonDirectionalLabelExchange.predictions[0]?.confidence, null);
  assert.equal(nonDirectionalLabelExchange.predictions[0]?.abstainReason, "non_directional_prediction_label_hold");

  const directionalAliasExchange = await runPick3PromptExchange({ postParseDelayMsOverride: 0, artifactDir, images: [images[0]!], promptPackages: [promptPackages[0]!],
    sender: async (input) => buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify(buildValidPredictionFixture({
        imageId: input.inputRefs[0]?.id,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel: "rise",
        confidence: 0.55,
        reason: "directional alias fixture",
      })),
    }),
  });
  assert.equal(directionalAliasExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(directionalAliasExchange.predictions[0]?.predictionLabel, "back");

  let emptyRetryCalls = 0;
  const emptyRetryExchange = await runPick3PromptExchange({ postParseDelayMsOverride: 0, artifactDir, images: [images[1]!], promptPackages: [promptPackages[1]!],
    sender: async (input) => {
      emptyRetryCalls += 1;
      if (emptyRetryCalls === 1) {
        return buildEmptyFixtureAiResult({ gatewayInput: input });
      }
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify(buildValidPredictionFixture({
          imageId: input.inputRefs[0]?.id,
          promptPackageId: visiblePromptPackageId(input),
          predictionLabel: "lower",
          confidence: 0.55,
          reason: "retry recovered from empty web-chat capture",
        })),
      });
    },
  });
  assert.equal(emptyRetryCalls, 2);
	  assert.equal(emptyRetryExchange.interactions.length, 1);
	  assert.equal(emptyRetryExchange.interactions[0]?.parseStatus, "parsed");
	  assert.equal(emptyRetryExchange.predictions.length, 1);
  let missingImageRetryCalls = 0;
  const missingImageRetryExchange = await runPick3PromptExchange({ postParseDelayMsOverride: 0, artifactDir, images: [images[1]!], promptPackages: [promptPackages[1]!],
    sender: async (input) => {
      missingImageRetryCalls += 1;
      if (missingImageRetryCalls <= 3) return buildRawTextFixtureAiResult({ gatewayInput: input, rawText: "未收到图片" });
      return buildFixtureAiResult({ gatewayInput: input, rawText: JSON.stringify(buildValidPredictionFixture({ imageId: input.inputRefs[0]?.id, promptPackageId: visiblePromptPackageId(input), predictionLabel: "lower", confidence: 0.55, reason: "retry recovered from provider-reported missing image" })) });
    },
  });
  assert.equal(missingImageRetryCalls, 4);
  assert.equal(missingImageRetryExchange.interactions.length, 1);
  assert.equal(missingImageRetryExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(missingImageRetryExchange.predictions.length, 1);
  const mismatchedIdentityExchange = await runPick3PromptExchange({ postParseDelayMsOverride: 0, artifactDir, images: [images[0]!], promptPackages: [promptPackages[0]!],
    sender: async (input) => buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        imageId: "wrong-image-id",
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel: "lower",
        confidence: 0.56,
        reason: "identity mismatch fixture",
        abstainReason: null,
      }),
    }),
  });
  assert.equal(mismatchedIdentityExchange.interactions.length, 1);
  assert.equal(mismatchedIdentityExchange.interactions[0]?.parseFailureReason, "pick3_prediction_image_id_mismatch");
  assert.equal(mismatchedIdentityExchange.predictions.length, 0);
} finally { storage.close(); }
console.log("pick3-is-blind-eval acceptance passed");
