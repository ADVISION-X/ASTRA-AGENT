import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import { createPick3BlindImages } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import { verifyPick3FullHistoryCoverage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.js";
import {
  buildPick3AiGatewayInput,
  runPick3PromptExchange,
  type Pick3GatewaySender,
} from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { reviewPick3Failures } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.js";
import {
  buildPick3PlaybookPromptPackage,
  loadBuiltInPick3Playbooks,
} from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { writeCandidatePick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.js";
import { revealPick3Predictions, scorePick3Predictions } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";
import {
  buildDatedDraw,
  buildDraw,
  buildEmptyFixtureAiResult,
  buildFixtureAiResult,
  oppositeLabel,
  toVisibleLabel,
  visiblePromptPackageId,
} from "./pick3-is-blind-eval.acceptance-support.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const fromRepo = (path: string): string => resolve(repoRoot, path);
const readRepoText = (path: string): string => readFileSync(fromRepo(path), "utf8");

const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const misplacedLawPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 法案.md";
const manifestPath = "scripts/audit/domains/pick3-is-blind-eval/manifest.json";
const inspectorPath = "scripts/audit/domains/pick3-is-blind-eval/inspector.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const playbookLoaderPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts";
const aiExchangePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts";
const workbenchPick3SupportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const aiGatewaySchemaPath = "src/capabilities/ai-input-gateway/schema.ts";
const webChatOpenPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
const webChatWorkspacePath = "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts";
const webChatSharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const webChatSharedSupportPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts";
const webChatPick3HistoryCleanupPath = "src/capabilities/ai-input-gateway/providers/web-chat-pick3-history-cleanup.ts";
const playbookPaths = ["src/plugins/pick3-is-blind-eval/playbooks/system.md", "src/plugins/pick3-is-blind-eval/playbooks/visual-grammar.md", "src/plugins/pick3-is-blind-eval/playbooks/is_hundreds_l80_v1.md", "src/plugins/pick3-is-blind-eval/playbooks/is_tens_l80_v1.md", "src/plugins/pick3-is-blind-eval/playbooks/is_ones_l80_v1.md"];

assert.equal(existsSync(fromRepo(lawPath)), true);
assert.equal(existsSync(fromRepo(blueprintPath)), true);
assert.equal(existsSync(fromRepo(manifestPath)), true);
assert.equal(existsSync(fromRepo(inspectorPath)), true);
assert.equal(existsSync(fromRepo(appShellLayoutPath)), true);
assert.equal(existsSync(fromRepo(playbookLoaderPath)), true);
assert.equal(existsSync(fromRepo(aiExchangePath)), true);
assert.equal(existsSync(fromRepo(workbenchPick3SupportPath)), true);
assert.equal(existsSync(fromRepo(aiGatewaySchemaPath)), true);
assert.equal(existsSync(fromRepo(webChatOpenPath)), true);
assert.equal(existsSync(fromRepo(webChatWorkspacePath)), true);
assert.equal(existsSync(fromRepo(webChatSharedPath)), true);
assert.equal(existsSync(fromRepo(webChatSharedSupportPath)), true);
assert.equal(existsSync(fromRepo(webChatPick3HistoryCleanupPath)), true);
for (const playbookPath of playbookPaths) {
  assert.equal(existsSync(fromRepo(playbookPath)), true, `${playbookPath} must exist`);
}
assert.equal(existsSync(fromRepo(misplacedLawPath)), false);

const lawText = readRepoText(lawPath);
const blueprintText = readRepoText(blueprintPath);
const appShellLayoutText = readRepoText(appShellLayoutPath);
const workbenchPick3SupportText = readRepoText(workbenchPick3SupportPath);
const aiGatewaySchemaText = readRepoText(aiGatewaySchemaPath);
const webChatOpenText = readRepoText(webChatOpenPath);
const webChatWorkspaceText = readRepoText(webChatWorkspacePath);
const webChatSharedText = readRepoText(webChatSharedPath);
const webChatSharedSupportText = readRepoText(webChatSharedSupportPath);
const webChatPick3HistoryCleanupText = readRepoText(webChatPick3HistoryCleanupPath);

for (const token of [
  "```apex-law",
  "\"capabilityDomain\": \"pick3-is-blind-eval\"",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1",
  "GRASSEYE-PICK3-IS-BRAIN-006-V1",
  "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1",
	  "Pick3 GPT web-chat feeds must reuse one fixed AI Input Gateway workspace tab",
	  "Pick3 GPT workspace tab reuse must be host/workspace based",
	  "`/c/<conversation>` URLs may be recorded only in the conversation ledger",
	  "Pick3 GPT workspace opening must use `reuse-host-tab`",
	  "Every Pick3 prompt and GPT output carries matching imageId and promptPackageId",
  "Playbook content sent to blind prediction must describe an anonymous time-series chart", "Pick3 Prompt Exchange may retry an empty web-chat raw output once", "Pick3 GPT Prompt Exchange must detect ChatGPT rate-limit dialogs", "Pick3 GPT rate-limit waiting must not be one opaque long sleep",
  "Pick3 GPT web-chat transport must verify after submit that the last submitted user message contains the expected bound image attachment",
  "Pick3 GPT workspace cleanup must also delete stale ChatGPT sidebar conversation history entries",
  "Pick3 GPT workspace cleanup must delete stale visible ChatGPT sidebar history entries whose title matches the controlled Pick3 training title allowlist", "Pick3 training must stop before the next prompt when sidebar cleanup reports a deletion failure",
  "Pick3 full pipeline must stop before reveal/scoring when any one-image GPT response fails JSON parsing",
  "No one-GPT-tab-per-image behavior for Pick3 training",
]) {
  assert.equal(lawText.includes(token), true, `law must include ${token}`);
}

for (const token of [
  "https://www.theuaelottery.ae/lottery/pick3",
  "https://www.theuaelottery.ae/lottery/pick3/results",
  "lotteryType=72",
  "command=660201",
  "command=660104",
  "command=660301",
  "260616",
  "4 2 7",
  "L=80",
  "no Chart #",
  "no point-count text",
  "PredictionSeal",
  "failure_replay",
  "not_valid_for_accuracy",
  "model_id",
  "temperature",
  "image_detail",
  "system_prompt_version_id",
  "business_prompt_version_id",
  "confidence_is_probability",
  "abstain",
  "coverageRate",
  "officialStartTime",
  "officialEndTime",
  "pick3_full_history_missing_earliest",
  "pick3_full_history_missing_latest",
  "pick3_full_history_date_gap",
  "one-position baseline = 50%",
  "three-position combination baseline = 12.5%",
  "three-position hit rate > 25%",
  "approximate stable per-position hit rate > 63%",
  "confidence is not probability",
  "## AGENT-Owned IS Brain",
  "pick3_playbooks",
  "Pick3PlaybookPromptPackage",
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
	  "workspaceId = pick3-is-blind-eval",
	  "workspace tab anchor = https://chatgpt.com/",
	  "conversation ledger entries = https://chatgpt.com/c/<conversation-id>",
	  "Do not save a /c/<conversation-id> URL as the workspace tab anchor.",
	  "Do not use reuse-exact-url against a /c/<conversation-id> URL to find the Pick3 workspace tab.",
	  "open https://chatgpt.com/ with reuse-host-tab",
	  "one browser tab per image",
  "imageId = opaque image id",
  "promptPackageId = active playbook package id",
  "de-lotteried anonymous time-series prompt",
  "no Pick3 / UAE / lottery / digit-game wording",
  "provider_proof_json.webChatWorkspaceId",
  "provider_proof_json.providerTabPolicy",
  "provider_proof_json.providerRecoveryStatus",
  "provider_proof_json.providerRecoveryAttemptCount",
  "provider_proof_json.staleConversationCleanupStatus",
  "provider_proof_json.staleConversationHistoryCleanupStatus",
  "If the Pick3 GPT web-chat prompt has been submitted and no provider result is captured after 200 seconds",
  "refresh the current ChatGPT conversation URL in the same workspace tab",
  "delete that current ChatGPT conversation history entry through the verified sidebar delete path",
  "resend the same governed one-image prompt package exactly once",
  "pick3_no_result_recovery_delete_failed",
  "Submitted image binding proof:", "last [data-message-author-role=\"user\"] message contains at least one real image/attachment candidate", "provider_missing_bound_image",
  "delete older recorded Pick3 conversations from ChatGPT sidebar history",
  "delete legacy sidebar records only when visible title matches the controlled Pick3 training title allowlist", "Never continue training when non-protected Pick3 training history remains visible after cleanup.",
  "If any one-image interaction has parse_status = parse_failed_raw_available",
  "If AI Input Gateway returns empty normalizedText", "retry the same one-image prompt once through the same AI Input Gateway sender", "do not click 明白了 / OK / Got it before the wait expires",
  "waitWithPick3RateLimitHeartbeat", "RECOVERY_PROGRESS reason=pick3_rate_limit_backoff_waiting", "injection path = createWorkbenchAiInputGateway -> AiInputGatewayExecutionContext -> AiProviderAdapterContext",
]) {
  assert.equal(blueprintText.includes(token), true, `blueprint must include ${token}`);
}

for (const runtimePath of [
  "src/plugins/pick3-is-blind-eval/index.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts",
]) {
  assert.equal(readRepoText(runtimePath).includes("trend-intuition-brain"), false, `${runtimePath} must not read external IS brain`);
}
assert.equal(appShellLayoutText.includes('value="full_pipeline"'), true, "Pick3 App Shell must expose full_pipeline mode.");
assert.equal(workbenchPick3SupportText.includes("assembly.aiInputGateway.execute"), true, "Workbench Pick3 handle must reuse canonical AI Input Gateway.");
assert.equal(workbenchPick3SupportText.includes("pick3GatewaySender"), true, "Workbench Pick3 handle must pass Pick3GatewaySender.");
assert.equal(workbenchPick3SupportText.includes("assembly.browserController"), true, "Workbench Pick3 sender must use governed BrowserController.");
assert.equal(aiGatewaySchemaText.includes("providerRecoveryAttemptCount"), true, "AI Input Gateway proof schema must include Pick3 recovery attempt count.");
assert.equal(aiGatewaySchemaText.includes("providerRecoveryStatus"), true, "AI Input Gateway proof schema must include Pick3 recovery status.");
assert.equal(webChatOpenText.includes("reuse-host-tab"), true, "Pick3 GPT workspace open must use host-level tab reuse.");
assert.equal(webChatOpenText.includes("isPick3WorkspaceId(input.workspaceId)"), true, "Pick3 GPT workspace policy must branch on Pick3 workspace id.");
assert.equal(webChatWorkspaceText.includes("normalizeWorkspaceUrl"), true, "Pick3 workspace URLs must be normalized.");
assert.equal(webChatWorkspaceText.includes("`${parsed.origin}/`"), true, "Pick3 conversation URLs must normalize to the ChatGPT origin anchor.");
assert.equal(webChatSharedSupportText.includes("providerRecoveryAttemptCount"), true, "Web chat raw proof must carry recovery attempt count.");
assert.equal(webChatSharedSupportText.includes("providerRecoveryStatus"), true, "Web chat raw proof must carry recovery status.");
for (const token of [
  "PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000",
  "PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1",
  "isPick3NoResultTimeoutError",
  "recoverPick3NoResultConversation",
  "isPick3MissingBoundImageError", "recoverPick3MissingBoundImageConversation", "pick3_missing_bound_image_recovery_deleted_current_conversation_and_reopened_new_chat",
  "deletePick3WorkspaceConversationHistoryUrl",
  "provider_rate_limited_too_many_requests",
  "pick3_no_result_recovery_refreshed_deleted_current_conversation_and_reopened_new_chat",
]) {
  assert.equal(webChatSharedText.includes(token), true, `web-chat shared runner must include ${token}`);
}
const webChatRecoveryLogText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-pick3-recovery-log.ts"); assert.equal(webChatRecoveryLogText.includes("RECOVERY_PROGRESS"), true); assert.equal(webChatRecoveryLogText.includes("HEARTBEAT_MS = 30_000"), true, "heartbeat chunk must be 30 seconds"); assert.equal(webChatRecoveryLogText.includes("PICK3_RATE_LIMIT_BACKOFF_MS = [600_000, 1_800_000, 3_600_000]"), true, "rate-limit schedule must be 10/30/60 minutes"); assert.equal(webChatRecoveryLogText.includes("180_000") || webChatRecoveryLogText.includes("300_000"), false, "rate-limit schedule must not regress to 3/5 minutes"); assert.equal(webChatRecoveryLogText.includes("reservePick3RateLimitAttempt"), true, "rate-limit attempt counter must be mission-scoped, not one-image scoped"); for (const token of ["missionKey", "imageId", "promptPackageId", "totalWaitSec", "elapsedSec", "remainingSec", "recoveryAction"]) assert.equal(webChatRecoveryLogText.includes(token), true, `rate-limit logs must include ${token}`); assert.equal(webChatRecoveryLogText.includes("pick3_rate_limit_backoff_waiting"), true); assert.equal(webChatRecoveryLogText.includes("and_refreshed"), true); assert.equal(webChatRecoveryLogText.includes("querySelectorAll('[role=\"dialog\"], [data-radix-portal]')"), true, "rate limit popup detection must not fall back to body"); assert.equal(webChatRecoveryLogText.includes("node.innerText"), true, "rate limit popup detection must use visible text"); assert.equal(webChatRecoveryLogText.includes("console."), false, "must use process.stdout.write, not console"); assert.equal(webChatRecoveryLogText.includes("process.stdout.write"), true, "terminal stdout heartbeat is mandatory — must write to process.stdout"); assert.equal(webChatRecoveryLogText.includes("do NOT interrupt"), true, "heartbeat message must warn user not to interrupt"); const webChatSubmitText = readRepoText("src/capabilities/ai-input-gateway/providers/web-chat-submit.ts");
assert.equal(webChatSharedText.includes("emitPick3RateLimitRecoveryStep"), true, "rate-limit resume steps must emit terminal-visible recovery lines."); assert.equal(webChatSharedText.includes("same_payload_resend_started"), true, "rate-limit recovery must visibly start same-payload resend.");
assert.equal(webChatSubmitText.includes("verifyLastUserMessageAttachments"), true, "Web chat submit must verify the last submitted user message has the bound image.");
assert.equal(webChatSubmitText.includes("provider_missing_bound_image"), true, "Web chat submit must fail missing bound images before GPT output is accepted.");
for (const token of [
  "deletePick3WorkspaceConversationHistoryUrl",
  "PICK3_TRAINING_HISTORY_TITLE_MARKERS", "Blind Time-Series", "remainingLegacyUrls",
  "current_history_deleted",
  "current_history_delete_verify_failed",
]) {
  assert.equal(webChatPick3HistoryCleanupText.includes(token), true, `Pick3 history cleanup must include ${token}`);
}

for (const playbookPath of playbookPaths) {
  const playbookText = readRepoText(playbookPath);
  for (const forbidden of ["0-4", "5-9", "0-2", "7-9", "Pick3", "UAE", "lottery", "pick3-is-blind-eval"]) {
    assert.equal(playbookText.includes(forbidden), false, `${playbookPath} must not contain numeric bucket ${forbidden}`);
  }
}

const latestPayload = {
  data: {
    lotteryType: 72,
    includeSelf: 1,
    isDesc: 1,
    prePhases: 10,
    alreadyDrawn: 1,
  },
};
const encoded = Buffer.from(JSON.stringify(latestPayload), "utf8").toString("base64");
assert.deepEqual(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")), latestPayload);

const officialRow = {
  phase: "260616",
  result: [{ key: "pick3", data: ["4", "2", "7"] }],
};
const nums = officialRow.result[0]?.data ?? [];
assert.deepEqual({
  drawNo: officialRow.phase,
  hundreds: Number(nums[0]),
  tens: Number(nums[1]),
  ones: Number(nums[2]),
}, {
  drawNo: "260616",
  hundreds: 4,
  tens: 2,
  ones: 7,
});

assert.equal(0.5, 1 / 2);
assert.equal(0.125, 1 / 8);
assert.ok(Math.pow(0.63, 3) < 0.251);
assert.ok(Math.pow(0.64, 3) > 0.25);

const fullCoverageDraws = [
  buildDatedDraw("2025-06-04", 1),
  buildDatedDraw("2025-06-05", 2),
  buildDatedDraw("2025-06-06", 3),
];
verifyPick3FullHistoryCoverage({
  bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
  drawsAscending: fullCoverageDraws,
});
assert.throws(
  () => verifyPick3FullHistoryCoverage({
    bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
    drawsAscending: fullCoverageDraws.slice(1),
  }),
  /pick3_full_history_missing_earliest/,
);
assert.throws(
  () => verifyPick3FullHistoryCoverage({
    bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
    drawsAscending: fullCoverageDraws.slice(0, 2),
  }),
  /pick3_full_history_missing_latest/,
);
assert.throws(
  () => verifyPick3FullHistoryCoverage({
    bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
    drawsAscending: [fullCoverageDraws[0]!, fullCoverageDraws[2]!],
  }),
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

  const targets = storage.listTargetDraws({ batchSize: 2 });
  assert.equal(targets.length, 2);
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
    const playbook = playbooks.find((item) => item.position === image.position);
    assert.ok(playbook);
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
  const sampleGatewayInput = buildPick3AiGatewayInput({
    batchId: "acceptance-batch",
    image: images[0]!,
    promptPackage: promptPackages[0]!,
  });
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
    const predictionLabel = observedInputs.length === 1 ? oppositeLabel(image.answerLabel) : image.answerLabel;
    return buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        imageId: input.inputRefs[0]?.id,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel: toVisibleLabel(predictionLabel),
        confidence: 0.56,
        reason: "sharp_top tail shape is clear enough for this fixture",
        abstainReason: null,
      }),
    });
  };
  const exchange = await runPick3PromptExchange({
    artifactDir,
    images,
    promptPackages,
    sender,
  });
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
  const candidatePlaybooks = writeCandidatePick3Playbooks({
    artifactDir,
    activePlaybooks: playbooks,
    failureReviews,
  });
  storage.upsertPlaybooks(candidatePlaybooks);
  assert.equal(candidatePlaybooks.length, 1);
  assert.equal(candidatePlaybooks[0]?.status, "candidate");
  assert.equal(readFileSync(candidatePlaybooks[0]!.contentPath, "utf8").includes("Do not memorize concrete answers"), true);

  const badExchange = await runPick3PromptExchange({
    artifactDir,
    images: [images[0]!],
    promptPackages: [promptPackages[0]!],
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

  let emptyRetryCalls = 0;
  const emptyRetryExchange = await runPick3PromptExchange({
    artifactDir,
    images: [images[1]!],
    promptPackages: [promptPackages[1]!],
    sender: async (input) => {
      emptyRetryCalls += 1;
      if (emptyRetryCalls === 1) {
        return buildEmptyFixtureAiResult({ gatewayInput: input });
      }
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify({
          imageId: input.inputRefs[0]?.id,
          promptPackageId: visiblePromptPackageId(input),
          predictionLabel: "lower",
          confidence: 0.55,
          reason: "retry recovered from empty web-chat capture",
          abstainReason: null,
        }),
      });
    },
  });
  assert.equal(emptyRetryCalls, 2);
  assert.equal(emptyRetryExchange.interactions.length, 1);
  assert.equal(emptyRetryExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(emptyRetryExchange.predictions.length, 1);

  const mismatchedIdentityExchange = await runPick3PromptExchange({
    artifactDir,
    images: [images[0]!],
    promptPackages: [promptPackages[0]!],
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
