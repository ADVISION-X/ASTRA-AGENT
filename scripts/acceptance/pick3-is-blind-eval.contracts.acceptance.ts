import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const fromRepo = (path: string): string => resolve(repoRoot, path);
const readRepoText = (path: string): string => readFileSync(fromRepo(path), "utf8");

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
const webChatFreshConversationPath =
  "src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation.ts";
const webChatWorkspacePath = "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts";
const webChatSharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const webChatRecoveryPath = "src/capabilities/ai-input-gateway/providers/web-chat-recovery.ts";
const webChatResponseCapturePath = "src/capabilities/ai-input-gateway/providers/web-chat-response-capture.ts";
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
assert.equal(existsSync(fromRepo(webChatFreshConversationPath)), true);
assert.equal(existsSync(fromRepo(webChatWorkspacePath)), true);
assert.equal(existsSync(fromRepo(webChatSharedPath)), true);
assert.equal(existsSync(fromRepo(webChatRecoveryPath)), true);
assert.equal(existsSync(fromRepo(webChatSharedSupportPath)), true);
assert.equal(existsSync(fromRepo(webChatPick3HistoryCleanupPath)), true);
for (const playbookPath of playbookPaths) assert.equal(existsSync(fromRepo(playbookPath)), true, `${playbookPath} must exist`);
assert.equal(existsSync(fromRepo(misplacedLawPath)), false);
const lawText = readRepoText(lawPath),
  blueprintText = readRepoText(blueprintPath);
const appShellLayoutText = readRepoText(appShellLayoutPath),
  pick3TrendClientText = readRepoText(pick3TrendClientPath),
  flowText = readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts");
const workbenchPick3SupportText = readRepoText(workbenchPick3SupportPath),
  aiGatewaySchemaText = readRepoText(aiGatewaySchemaPath);
const workbenchPick3RoutesText = readRepoText(workbenchPick3RoutesPath),
  workbenchApiBoundaryText = readRepoText(workbenchApiBoundaryPath);
const webChatOpenText = readRepoText(webChatOpenPath),
  webChatFreshConversationText = readRepoText(webChatFreshConversationPath),
  webChatWorkspaceText = readRepoText(webChatWorkspacePath),
  webChatSharedText = readRepoText(webChatSharedPath),
  webChatRecoveryText = readRepoText(webChatRecoveryPath),
  webChatResponseCaptureText = readRepoText(webChatResponseCapturePath);
const webChatSharedSupportText = readRepoText(webChatSharedSupportPath),
  webChatPick3HistoryCleanupText = readRepoText(webChatPick3HistoryCleanupPath);
const attachmentChildText = readRepoText("src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts");
const webChatComposerText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts");
const webChatSelectorPreludeText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-selector-prelude.ts");
const webChatEvaluationText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts"),
  webChatResponseExtractionText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-response-extraction-script.ts"),
  webChatSubmittedAttachmentEvaluationText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-submitted-attachment-evaluation.ts");
for (const token of ["```apex-law", '"capabilityDomain": "pick3-is-blind-eval"', "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1", "GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1", "GRASSEYE-PICK3-IS-BRAIN-006-V1", "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1", "Pick3 GPT web-chat feeds must reuse one fixed AI Input Gateway workspace tab", "Pick3 GPT workspace tab reuse must be host/workspace based", "`/c/<conversation>` URLs may be recorded only in the conversation ledger", "Pick3 Gemini workspace tab reuse must record `https://gemini.google.com/app/<conversation>` URLs", "Pick3 GPT workspace opening must use `reuse-host-tab`", "Every Pick3 prompt and GPT output carries matching imageId and promptPackageId", "Playbook content sent to blind prediction must describe an anonymous time-series chart", "Pick3 Prompt Exchange may retry an empty web-chat raw output once", "explicitly non-directional", "normalized to internal `abstain`", "Pick3 GPT Prompt Exchange must detect ChatGPT rate-limit dialogs", "Pick3 GPT rate-limit recovery must not wait before clicking the acknowledgement", "Pick3 GPT web-chat transport must verify after submit that the last submitted user message contains the expected bound image attachment", "Pick3 provider sidebar history deletion is temporarily disabled", "provider_history_delete_temporarily_disabled", "current_history_delete_temporarily_disabled", "Pick3 training must preserve parsed prediction results when post-response provider history deletion is disabled", "Pick3 full pipeline must stop before reveal/scoring only after the same-chain Prompt Exchange completion queue is exhausted", "No one-GPT-tab-per-image behavior for Pick3 training"]) {
  assert.equal(lawText.includes(token), true, `law must include ${token}`);
}
for (const token of ["Prompt Exchange completion queue", "deferred_retry_scheduled", "expectedCount, completedCount, deferredRetryCount, skippedCount, and unresolvedCount", "remaining images/repeats continue", "Only final unresolved parse_failed_raw_available interactions", "provider-reported missing image", "three local retries", "skipped_provider_reported_image_missing"]) assert.equal(lawText.includes(token), true, `law must include production completion token ${token}`);
for (const token of ["GRASSEYE-PICK3-NEXT-PREDICTION-STABILITY-008-V1", "next_prediction_stability", "batchSize is the repeat-send count", "must not produce a final selected label"]) {
  assert.equal(lawText.includes(token), true, `next stability law must include ${token}`);
}
for (const token of ["GRASSEYE-PICK3-TREND-DISPLAY-010-V1", "stored official `pick3_draws`", "fixed 80-draw window", "three separated rows", "Hover exposes phase, official drawn numbers, and expected prize time", "Mouse drag changes the historical start index", "lastTargetPhase", "walk backward by `batchSize`", "database-backed phase", "Free-form typed lastTargetPhase as production truth"]) {
  assert.equal(lawText.includes(token), true, `trend display law must include ${token}`);
}
for (const token of ["https://www.theuaelottery.ae/lottery/pick3", "https://www.theuaelottery.ae/lottery/pick3/results", "lotteryType=72", "command=660201", "command=660104", "command=660301", "260616", "4 2 7", "L=80", "no Chart #", "no point-count text", "PredictionSeal", "failure_replay", "not_valid_for_accuracy", "model_id", "temperature", "image_detail", "system_prompt_version_id", "business_prompt_version_id", "confidence_is_probability", "abstain", "coverageRate", "officialStartTime", "officialEndTime", "pick3_full_history_missing_earliest", "pick3_full_history_missing_latest", "pick3_full_history_date_gap", "one-position baseline = 50%", "three-position combination baseline = 12.5%", "three-position hit rate > 25%", "approximate stable per-position hit rate > 63%", "confidence is not probability", "## AGENT-Owned IS Brain", "pick3_playbooks", "Pick3PlaybookPromptPackage", "Pick3 Prompt Exchange", "pick3_ai_interactions", "prompt_package_id", "prompt_contract_id", "raw_response_text", "raw_response_hash", "raw_output_ref", "provider_proof_json", "parse_status", "parse_failed_raw_available", "Pick3GatewaySender", "workspaceId = pick3-is-blind-eval", "workspace tab anchor = https://chatgpt.com/", "conversation ledger entries = https://chatgpt.com/c/<conversation-id>", "Gemini conversation ledger entries = https://gemini.google.com/app/<conversation-id>", "Record Gemini /app/<conversation-id> URLs", "Do not save a /c/<conversation-id> URL as the workspace tab anchor.", "Do not use reuse-exact-url against a /c/<conversation-id> URL to find the Pick3 workspace tab.", "open https://chatgpt.com/ with reuse-host-tab", "one browser tab per image", "imageId = opaque image id", "promptPackageId = active playbook package id", "de-lotteried anonymous time-series prompt", "no Pick3 / UAE / lottery / digit-game wording", "provider_proof_json.webChatWorkspaceId", "provider_proof_json.providerTabPolicy", "provider_proof_json.providerRecoveryStatus", "provider_proof_json.providerRecoveryAttemptCount", "provider_proof_json.staleConversationCleanupStatus", "lifecycle watcher = startPick3RateLimitDialogWatcher", "If the Pick3 GPT web-chat prompt has been submitted and no provider result is captured after 200 seconds", "do not refresh or reload the timed-out ChatGPT conversation", "do not delete that current ChatGPT conversation history entry while provider history deletion is temporarily disabled", "resend the same governed one-image prompt package exactly once", "current_history_delete_temporarily_disabled", "Submitted image binding proof:", 'last [data-message-author-role="user"] message contains at least one real image/attachment candidate', "provider_missing_bound_image", "temporarily skip provider sidebar history deletion", "provider_history_delete_temporarily_disabled", "Never open provider history sidebars, click Delete, or confirm Delete chat? while provider history deletion is temporarily disabled.", "If any one-image interaction has parse_status = parse_failed_raw_available", "If AI Input Gateway returns empty normalizedText", "If response is structured JSON but predictionLabel is an explicitly non-directional invalid word", "normalize to internal abstain with null confidence", "non_directional_prediction_label_<word>", "If response is structured JSON but predictionLabel is an explicit directional synonym", "normalize through the directional alias whitelist", "If response is structured JSON but predictionLabel is another invalid shape word", "do not map the shape word to lower/upper", "retry the same one-image prompt once through the same AI Input Gateway sender", "immediately click 明白了 / OK / Got it", "acknowledgement helper = acknowledgePick3RateLimitDialogIfVisible", "pre-submit conversation snapshot", "prompt pasted verification", "response capture", "injection path = createWorkbenchAiInputGateway -> AiInputGatewayExecutionContext -> AiProviderAdapterContext"]) {
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
for (const token of ['value="full_pipeline"', 'name="promptMode"', 'value="free_analysis_strict_reasoning"', 'name="lastTargetPhase"', "data-pick3-last-target-phase", '<select name="lastTargetPhase"']) assert.equal(appShellLayoutText.includes(token), true, `Pick3 App Shell must expose ${token}.`);
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
assert.equal(webChatResponseCaptureText.includes("PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000"), true, "web-chat response capture must keep the Pick3 no-result recovery timeout");
for (const token of ["PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1", "isPick3NoResultTimeoutError", "recoverPick3NoResultConversation", "isPick3MissingBoundImageError", "recoverPick3MissingBoundImageConversation"]) {
  assert.equal(webChatSharedText.includes(token), true, `web-chat shared runner must include ${token}`);
}
for (const token of ["recoverPick3NoResultConversation", "recoverPick3MissingBoundImageConversation", "pick3_missing_bound_image_recovery_without_history_delete_and_reopened_new_chat", "pick3_no_result_recovery_reopened_new_chat_without_history_delete"]) {
  assert.equal(webChatRecoveryText.includes(token), true, `web-chat recovery owner must include ${token}`);
}
const geminiFreshConversationContract =
  `${webChatOpenText}\n${webChatFreshConversationText}`;
for (const token of ["isPick3GeminiRequest", "gemini.google.com", "reuse-active-tab", "gemini-web-chat:pick3-is-blind-eval:fresh"]) assert.equal(geminiFreshConversationContract.includes(token), true, `Gemini Pick3 fresh conversation must include ${token}`);
assert.equal(lawText.includes("Pick3 Gemini web-chat feeds must also reuse one fixed AI Input Gateway workspace tab"), true, "law must require fresh Gemini conversations per Pick3 image.");
assert.equal(blueprintText.includes("fresh conversation = navigate the existing Gemini workspace tab to https://gemini.google.com/app before every Pick3 image"), true, "blueprint must document the verified Gemini fresh conversation path.");
for (const token of ["Pick3 Gemini pre-image history cleanup must emit terminal-visible `pre_image_history_cleanup` timing logs", "provider_history_delete_temporarily_disabled", "pre_image_history_cleanup"]) assert.equal(lawText.includes(token), true, `law must include Gemini pre-image cleanup token ${token}`);
for (const token of ["Gemini pre-image cleanup rule", "provider_history_delete_temporarily_disabled", "do not block attachment upload for visible stale Gemini provider history while provider history deletion is disabled"]) assert.equal(blueprintText.includes(token), true, `blueprint must include Gemini pre-image cleanup token ${token}`);
const webChatRecoveryLogText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts");
assert.equal(webChatRecoveryLogText.includes("PICK3_RATE_LIMIT_MAX_ACK_ATTEMPTS"), false, "rate-limit recovery must not keep an attempt cap; in-place acknowledgement clicks repeat indefinitely");
assert.equal(webChatRecoveryLogText.includes("PICK3_RATE_LIMIT_WATCH_INTERVAL_MS = 500"), true, "rate-limit lifecycle watcher must poll during every web-chat feed phase");
assert.equal(webChatRecoveryLogText.includes("waitWithPick3RateLimitHeartbeat"), false, "rate-limit recovery must not keep the old wait-before-click helper");
assert.equal(webChatRecoveryLogText.includes("PICK3_RATE_LIMIT_BACKOFF_MS"), false, "rate-limit recovery must not keep a backoff schedule");
assert.equal(webChatRecoveryLogText.includes("pick3_rate_limit_backoff_waiting"), false, "rate-limit recovery must not emit backoff waiting progress");
assert.equal(webChatRecoveryLogText.includes("reservePick3RateLimitAttempt"), true, "rate-limit attempt counter must be mission-scoped, not one-image scoped");
for (const token of ["missionKey", "imageId", "promptPackageId", "recoveryAction"]) assert.equal(webChatRecoveryLogText.includes(token), true, `rate-limit logs must include ${token}`);
for (const token of ["isChatGptRateLimitDialogVisible", "acknowledgePick3RateLimitDialogIfVisible", "acknowledgePick3RateLimitIfVisible", "startPick3RateLimitDialogWatcher", "pick3_rate_limit_dialog_watcher_started", "rate_limit_ack_clicked_in_place"]) assert.equal(webChatRecoveryLogText.includes(token), true, `rate-limit in-place acknowledgement must include ${token}`);
assert.equal(webChatRecoveryLogText.includes("rate_limit_ack_clicked_and_same_tab_refreshed"), false, "rate-limit acknowledgement must not retain the removed page-refresh status");
assert.equal(webChatRecoveryLogText.includes("pick3_rate_limit_immediate_acknowledgement_retry_exhausted"), false, "rate-limit watcher must never escalate to review_required by attempt count; clicking the acknowledgement in place is the entire policy");
assert.equal(webChatRecoveryLogText.includes("querySelectorAll('[role=\"dialog\"], [data-radix-portal]')"), true, "rate limit popup detection must not fall back to body");
assert.equal(webChatRecoveryLogText.includes("node.innerText"), true, "rate limit popup detection must use visible text");
assert.equal(webChatRecoveryLogText.includes("console."), false, "must use process.stdout.write, not console");
assert.equal(webChatRecoveryLogText.includes("process.stdout.write"), true, "terminal stdout is mandatory — must write to process.stdout");
const webChatSubmitText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-submit.ts");
for (const token of ["acknowledgeChatGptSubmitRateLimitIfVisible", "acknowledgePick3RateLimitIfVisible", 'promptContractId.includes("pick3-is-blind-eval")']) assert.equal(webChatSubmitText.includes(token), true, `submit waits must include current Pick3 rate-limit guard ${token}`);
assert.equal(webChatSubmitText.includes("acknowledgePick3SubmitRateLimitIfVisible"), false, "submit waits must not restore the removed duplicate Pick3 wrapper");
const webChatSharedTextForRateLimit = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts");
assert.equal(webChatSharedTextForRateLimit.includes("recoverAfterPick3RateLimit"), false, "rate-limit response_capture detection must not reopen the page or resend the prompt; the only action is click acknowledgement");
assert.equal(webChatSharedTextForRateLimit.includes("pick3_rate_limit_same_payload_resend_started"), false, "rate-limit recovery must not resend the same payload");
const webChatEvaluationTextForRateLimit = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts");
assert.equal(webChatEvaluationTextForRateLimit.includes("provider_rate_limited_too_many_requests"), false, "response_capture in-page evaluation must not escalate a visible rate-limit dialog to review_required; it must keep polling as pending while the parallel click-ack handles dismissal");
assert.equal(webChatSharedText.includes("same_payload_resend_started"), false, "rate-limit recovery must never resend the same payload; the only action is click acknowledgement.");
assert.equal(webChatSharedText.includes("startPick3RateLimitDialogWatcher"), true, "web-chat feed lifecycle must start the Pick3 rate-limit dialog watcher.");
assert.equal(webChatSharedText.includes("rateLimitDialogWatcher?.stop"), true, "web-chat feed lifecycle must stop and surface watcher failures.");
assert.equal(webChatSharedText.includes("screenshotRegion"), false, "Pick3 web-chat runtime must not put system screenshots in the per-image critical path.");
for (const token of ["isPick3WebChatRequest", "outputRefs"]) assert.equal(webChatSharedText.includes(token), true, `Pick3 web-chat runtime must include ${token}`);
for (const token of ["attachApprovedWebChatFilesOnce", "resolveWebChatAttachmentTransportKind", "ordered_clipboard"]) assert.equal(attachmentChildText.includes(token), true, `Gemini web-chat upload must use the standard attachment child token: ${token}`);
for (const token of ["user-query, user-query-content, .user-query-container", "countGeminiBoundAttachments"]) assert.equal(webChatSubmittedAttachmentEvaluationText.includes(token), true, `Gemini submitted-image binding proof must use Gemini user-query DOM token: ${token}`);
for (const token of ["WEB_CHAT_ATTACHMENT_COUNT_SCRIPT", "findAttachmentTileRoot", "file-tile", "在文本字段中显示", "移除文件", "seenTiles.add(findAttachmentTileRoot(node) || node)"]) assert.equal(webChatComposerText.includes(token), true, `ChatGPT file-tile attachment counting must include ${token}`);
for (const token of ["WEB_CHAT_ATTACHMENT_COUNT_SCRIPT", "countChatGptBoundAttachments", "messageNode.parentElement", "messageNode.previousElementSibling", "button[aria-label*='在文本字段中显示']", "[class*='file-tile' i]", "isChatGptPastedTextTile", "isRealSubmittedAttachment", "findAttachmentTileRoot(node) || node"]) assert.equal(webChatSubmittedAttachmentEvaluationText.includes(token), true, `submitted image binding must recognize ChatGPT file-tile DOM token ${token}`);
assert.equal(webChatEvaluationText.includes('composerRootText.includes("在文本字段中显示")'), true, "prompt-card evaluation must recognize ChatGPT pasted-text cards.");
for (const token of ["extractLastJsonObject", "extractFirstJsonObject", 'location.hostname.includes("gemini.google.com")', "Gemini said", "geminiStructuredJsonAnswer", "responseGenerating = geminiBodyAnswer || geminiStructuredJsonAnswer ? false : generating", "answer extracted from gemini structured json", "answer extracted from gemini body json"]) assert.equal(webChatResponseExtractionText.includes(token), true, `Gemini answer extraction must include ${token}`);
assert.equal(webChatResponseCaptureText.includes('input.request.providerKind === "gemini-web-chat" ? 1 : STABLE_ROUNDS_REQUIRED'), true, "Gemini answer capture must not wait on unstable assistant-count growth.");
assert.equal(webChatSelectorPreludeText.includes("aria-label='Enter a prompt for Gemini'"), true, "Gemini composer selector must include the live aria-label-backed contenteditable textbox.");
assert.equal(webChatRecoveryText.includes("pick3_no_result_recovery_reopened_gemini_new_chat"), true, "Gemini Pick3 no-result recovery must reopen Gemini new chat.");
for (const token of ["runtimeLogger?: RuntimeLogger", "PICK3_OFFICIAL_SYNC", "PICK3_BUILD_BLIND_BATCH", "PICK3_PROMPT_EXCHANGE", "PICK3_REVEAL_AND_SCORING", "PICK3_TASK"]) assert.equal(flowText.includes(token), true, `Pick3 flow must emit Runtime Log Spine stage ${token}`);
assert.equal(webChatSubmitText.includes("verifyLastUserMessageAttachments"), true, "Web chat submit must verify the last submitted user message has the bound image.");
assert.equal(webChatSubmitText.includes("provider_missing_bound_image"), true, "Web chat submit must fail missing bound images before GPT output is accepted.");
const aiExchangeText = readRepoText(aiExchangePath),
  aiOutputContractText = [aiExchangeText, readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-contract.ts"), readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-parse.ts")].join("\n");
for (const token of ["未收到图片", "pick3_provider_reported_image_missing", "RECOVERABLE_PARSE_FAILURE_REASONS", "PICK3_PROVIDER_REPORTED_MISSING_IMAGE_RETRY_COUNT = 3", "skipped_provider_reported_image_missing", "pick3_provider_reported_image_missing_retry_exhausted", "skipped_missing_image"]) assert.equal(aiOutputContractText.includes(token), true, `Pick3 prompt exchange must retry provider-reported missing images with ${token}`);
for (const token of ["[GRASSEYE][PICK3][EXCHANGE]", "send_started", "send_result", "parse_result", "empty_raw_output", "WARN empty_raw_output", "rawLen=", "boundVerify=", "parseStatus=", "parseFailureReason=", "predictionLabel=", "targetPhase=", "process.stdout.write"]) assert.equal(aiExchangeText.includes(token), true, `pick3 AI exchange must emit terminal log token: ${token}`);
for (const token of ["provider_history_delete_temporarily_disabled"]) assert.equal(webChatPick3HistoryCleanupText.includes(token), true, `Pick3 history cleanup must include ${token}`);
assert.equal(webChatPick3HistoryCleanupText.includes("deletePick3WorkspaceConversationHistoryUrl"), false, "Pick3 provider current-history delete export must stay removed while provider history deletion is temporarily disabled.");
const webChatSubmitTextFull = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-submit.ts"),
  webChatSearchDialogHygieneText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-search-dialog-hygiene.ts"),
  webChatSubmitTimingText = [webChatSubmitTextFull, readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-submit-stage-log.ts")].join("\n");
for (const token of ["dismissChatGptSearchDialogIfVisible", "5_000"]) assert.equal(webChatSubmitTextFull.includes(token), true, `web-chat-submit must include ${token}`);
for (const token of ["search chats", "搜索聊天", "CHATGPT_SEARCH_DIALOG_AMBIGUOUS", "CHATGPT_SEARCH_DIALOG_STILL_VISIBLE"]) assert.equal(webChatSearchDialogHygieneText.includes(token), true, `exact search-dialog hygiene must include ${token}`);
assert.equal(webChatSearchDialogHygieneText.includes('key: "Escape"'), false, "prompt submission must close only the uniquely classified chat-search dialog, never an arbitrary floating menu by Escape");
for (const token of ["GEMINI_PROMPT_PASTE_VERIFY_TIMEOUT_MS = 5_000", "GEMINI_PROMPT_PASTE_RETRY_LIMIT = 3", "pasteTextReplacingInChrome", "gemini_clipboard_prompt_paste", "verify_gemini_prompt_pasted_before_submit"]) assert.equal(webChatSubmitTextFull.includes(token), true, `Gemini prompt submit must include ${token}`);
for (const token of ["[GRASSEYE][AI-GATEWAY][WEB-CHAT]", "gemini_clipboard_prompt_paste", "prompt_prepare", "verify_attachments_before_submit", "prompt_submit", "elapsedMs"]) assert.equal(webChatSubmitTimingText.includes(token), true, `Gemini prompt timing logs must include ${token}`);
const webChatSharedTextFull = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts");
const webChatPreSubmitStateText = readRepoText(
  "src/capabilities/ai-input-gateway/providers/web-chat-pre-submit-state.ts",
);
for (const token of ["shouldSkipPreSubmitConversationState", "pre_submit_snapshot", "fresh_gemini_pick3_conversation"]) assert.equal(webChatPreSubmitStateText.includes(token), true, `Gemini upload-to-prompt idle guard must include ${token}`);
for (const token of ['providerKind === "gemini-web-chat"', 'promptContractId.startsWith("pick3-is-blind-eval")', "deferred_gemini_pick3_post_batch_cleanup_required"]) assert.equal(webChatSharedSupportText.includes(token), true, `Gemini Pick3 per-image cleanup must defer post-batch history work with ${token}`);
for (const token of ["cleanupGeminiPick3HistoryBeforeNextImage", "isBlockingGeminiPick3PreImageHistoryCleanupStatus"]) assert.equal(webChatSharedSupportText.includes(token), true, `Gemini pre-image history cleanup helper must include ${token}`);
for (const token of ["pre_image_history_cleanup", "delete_previous_stale_history_before_next_image", "before attachment upload"]) assert.equal(webChatSharedTextFull.includes(token), true, `Gemini pre-image history cleanup runtime must include ${token}`);
for (const token of ["provider_composer_ready", "provider_composer_ready_probe", "PROVIDER_COMPOSER_READY_TIMEOUT_MS = 60_000"]) assert.equal(webChatOpenText.includes(token), true, `Gemini composer readiness logs must include ${token}`);
for (const token of ["read active provider workspace URL", "getSessionState().currentUrl"]) assert.equal(webChatOpenText.includes(token), true, `provider workspace URL persistence must include ${token}`);
for (const token of ["chrome-error://", "recover provider page before attachment upload", 'phase === "attachment upload"']) assert.equal(webChatSharedSupportText.includes(token), true, `provider error-page recovery must include ${token}`);
for (const token of ["inputRefId", "stagingManifestHash", "onAttachmentUploadCompleted"]) assert.equal(attachmentChildText.includes(token), true, `Gemini attachment proof must include ${token}`);
assert.equal(lawText.includes("must not burn the generic 20-second GPT clipboard-paste verification window"), true, "law must forbid Gemini 20s clipboard-paste burn.");
for (const token of ["provider history deletion is temporarily disabled", "falling back to the browser session current URL", "before attachment upload"]) assert.equal(lawText.includes(token), true, `law must include ${token}`);
assert.equal(blueprintText.includes("prompt entry = for Gemini, focus the verified Quill composer and use real clipboard paste immediately after upload"), true, "blueprint must document verified Gemini real-paste prompt entry.");
for (const token of ["Temporary provider-history deletion disable rule", "workspace URL persistence", "provider error page recovery"]) assert.equal(blueprintText.includes(token), true, `blueprint must include ${token}`);
const webChatPageActionsText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts");
assert.equal(webChatPageActionsText.includes("Math.min(timeoutMs, 5_000)"), true, "waitForComposerFocused hard cap must be 5000ms (not 2000ms)");
for (const token of ["provider_history_delete_temporarily_disabled"]) assert.equal(webChatPick3HistoryCleanupText.includes(token), true, `history cleanup must safely disable provider deletion with ${token}`);
for (const token of ["PICK3_CONVERSATION_LEDGER_MAX_ENTRIES = 100", "slice(-PICK3_CONVERSATION_LEDGER_MAX_ENTRIES)"]) assert.equal(webChatWorkspaceText.includes(token), true, `Pick3 conversation ledger must retain full-run cleanup evidence with ${token}`);
assert.equal(webChatWorkspaceText.includes("const keptLedger = ledger.slice(-input.keepRecentCount)"), false, "stale tab cleanup must not truncate the history-deletion ledger.");
assert.equal(webChatSharedSupportText.includes("Pick3 ChatGPT sidebar cleanup failed"), false, "raw output must not be dropped by post-response sidebar cleanup failure");
assert.equal(aiExchangeText.includes("cleanupStatus="), true, "Pick3 exchange must log provider cleanup failure without overwriting parsed predictions");
assert.equal(aiExchangeText.includes("pick3_provider_cleanup_failed_"), false, "Pick3 exchange must not convert cleanup failure into parse failure");
assert.equal(webChatRecoveryText.includes("SOURCE_PAGE_RESTORE_FAILED"), true, "Every captured raw output must survive source restore failure as a transport warning.");
for (const playbookPath of playbookPaths) {
  const playbookText = readRepoText(playbookPath);
  for (const forbidden of ["0-4", "5-9", "0-2", "7-9", "Pick3", "UAE", "lottery", "pick3-is-blind-eval"]) assert.equal(playbookText.includes(forbidden), false, `${playbookPath} must not contain numeric bucket ${forbidden}`);
}
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
for (const token of ["zoneCount", "patternRecurrence", "weakestLink", "counted not estimated", "must not be confused with the V1 evidence fields", "uncertainCount", "reserved for genuinely balanced or mutually cancelling evidence"]) {
  assert.equal(lawText2.includes(token), true, `law must include Free Analysis probing field token ${token}`);
}
const blueprintText2 = readRepoText(blueprintPath);
for (const token of ["mandatory zoneCount", "mandatory patternRecurrence", "mandatory weakestLink", "probing fields, not vocabulary or direction", "uncertainCount", "abstain is reserved for genuinely balanced"]) {
  assert.equal(blueprintText2.includes(token), true, `blueprint must include Free Analysis probing field token ${token}`);
}
const freeAnalysisPlaybookText = readRepoText("src/plugins/pick3-is-blind-eval/playbooks/free-analysis-strict-reasoning.md");
for (const token of ["zoneCount", "patternRecurrence", "weakestLink", "Self-check before you answer", "no reliable recurring pattern", "uncertainCount", "do not invent one"]) {
  assert.equal(freeAnalysisPlaybookText.includes(token), true, `free-analysis playbook must include probing field token ${token}`);
}
const aiContractText = readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-contract.ts");
for (const token of ["lowerCount", "upperCount", "uncertainCount", "patternRecurrence", "weakestLink", "zoneCount must be three non-negative integers"]) {
  assert.equal(aiContractText.includes(token), true, `ai-contract output shape must include Free Analysis probing field token ${token}`);
}
// Contrarian-override discountedEvidence contract now lives only in system.md (asserted above);
// there is no Stream A/B/C position file to carry a position-specific contrarian example.

console.log("pick3-is-blind-eval static contract acceptance passed");
export const pick3StaticContractAcceptanceCompleted = true;
