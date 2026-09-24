import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const LAW_ID = "LAW-GPT-002-V27";
const ROOT = "src/capabilities/gpt";
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");

export const textResponseTwoGateSettlementIsFrozen = (source: string): boolean => {
  const required = [
    "if (observation.generatingRaw > 0 || observation.semanticText.trim().length > 0)",
    "let exactResponseObserved = false",
    "while (Date.now() < deadline || exactResponseObserved)",
    "Date.now() + GPT_STOPPED_EMPTY_CONFIRMATION_MS : deadline",
    "let nextWaitReason: GptProviderObservationWaitReason = \"initial-observation\"",
    "observationDeadline, nextWaitReason",
    "nextWaitReason = \"exact-user-turn-unavailable\"",
    "nextWaitReason = \"adjacent-assistant-missing\"",
    'assistant.generatingRaw > 0\n        ? "stop-present" : "stopped-empty-confirming"',
    "if (exactResponseObserved) continue",
    "exactResponseObserved = assistant !== null",
    "assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0",
  ];
  const forbidden = ["assistant.visible", "assistant.layout", "assistant.hidden",
    "assistant.ariaHidden", "assistant.inert", "assistant.composerRaw", "assistant.assistantIndex",
    "assistant.precedingPromptHash", "if (nextWaitReason", "switch (nextWaitReason"];
  return required.every((token) => source.includes(token))
    && forbidden.every((token) => !source.includes(token));
};

export const providerWaitReasonProjectionIsFrozen = (
  contract: string,
  lifecycle: string,
  textHandler: string,
  imageHandler: string,
): boolean => [
  'reason: GptProviderObservationWaitReason',
  '"initial-observation"',
  '"exact-user-turn-unavailable"',
  '"adjacent-assistant-missing"',
  '"stop-present"',
  '"stopped-empty-confirming"',
  '"generated-image-source-pending"',
].every((token) => contract.includes(token))
  && [
    '"initial-observation": "GPT_PROVIDER_WAIT_INITIAL_OBSERVATION"',
    '"exact-user-turn-unavailable": "GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE"',
    '"adjacent-assistant-missing": "GPT_PROVIDER_WAIT_ADJACENT_ASSISTANT_MISSING"',
    '"stop-present": "GPT_PROVIDER_WAIT_STOP_PRESENT"',
    '"stopped-empty-confirming": "GPT_PROVIDER_WAIT_STOPPED_EMPTY_CONFIRMING"',
    'reason === "generated-image-source-pending"',
    '"GPT_PROVIDER_WAIT_ACTIVE"',
    "reason in textCodes",
  ].every((token) => lifecycle.includes(token))
  && [
    'nextWaitReason: GptProviderObservationWaitReason = "initial-observation"',
    "observationDeadline, nextWaitReason",
    'nextWaitReason = "exact-user-turn-unavailable"',
    'nextWaitReason = "adjacent-assistant-missing"',
    '? "stop-present" : "stopped-empty-confirming"',
  ].every((token) => textHandler.includes(token))
  && imageHandler.includes('deadline, "generated-image-source-pending"')
  && !textHandler.includes("if (nextWaitReason")
  && !textHandler.includes("switch (nextWaitReason");

const contractChecks = (sources: Readonly<Record<string, string>>): boolean[] => [
  /attach_approved_gpt_files_once:[^\n]+profile: "TARGET_LOCAL_MUTATION"[^\n]+replayPolicy: "target-local-per-generation"/u.test(sources.contract!),
  /submit_exact_gpt_turn_once:[^\n]+profile: "PROVIDER_EFFECT_ONCE"[^\n]+replayPolicy: "provider-effect-once"/u.test(sources.contract!),
  sources.atomic!.includes("gptCanonicalHash([resultRevision, intent.inputHash])"),
  sources.contract!.includes("browserAtomicIdentity?: BrowserAtomicStepIdentity"),
  sources.atomic!.includes("executionContext(input, browser, atomicIdentity)"),
  sources.childHandler!.includes("readAtomicStepOutcome(context.browserAtomicIdentity)"),
  sources.group!.includes("readAtomicStepOutcome(context.browserAtomicIdentity)"),
  !sources.childHandler!.includes("inputHash: intent.inputHash"),
  !sources.group!.includes("inputHash: intent.inputHash"),
];

const productChecks = (sources: Readonly<Record<string, string>>): boolean[] => [
  sources.productApi!.includes("readConfirmedSubmit("),
  sources.seoFlow!.includes("context.gpt.readConfirmedSubmit"),
  sources.seoReadback!.indexOf("await input.read()") < sources.seoReadback!.indexOf("await input.prepare()"),
  sources.seoReadback!.indexOf("await input.prepare()") < sources.seoReadback!.indexOf("await input.execute()"),
  sources.submit!.includes("userTurnSelector: GPT_USER_TURN_SELECTOR"),
  sources.submit!.includes("latestGptUserTurn: true"),
  sources.submit!.includes("GPT_EMPTY_COMPOSER_SELECTOR"),
];

const frozenBlueprintChecks = (sources: Readonly<Record<string, string>>): boolean[] => [
  sources.blueprint!.includes("FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001"),
  sources.blueprint!.includes("FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001"),
  sources.browserBlueprint!.includes("FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001"),
  sources.blueprint!.includes("(<8位十进制日期>-<6位十进制时间>)"),
  sources.browserBlueprint!.includes("(<8位十进制日期>-<6位十进制时间>)"),
  sources.attachmentSchema!.includes("normalizeGptProviderAttachmentLabel"),
  sources.attachmentReconciliation!.includes("normalizeGptProviderAttachmentLabel(label, expectedLabels)"),
  sources.candidate!.includes("expectedLabels.includes(providerLabel(label))"),
  sources.blueprint!.includes("FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001"),
  sources.blueprint!.includes("FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001"),
  sources.browserBlueprint!.includes("FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001"),
  sources.blueprint!.includes("FROZEN-GPT-ATOMIC-IDENTITY-ROUNDTRIP-001"),
  sources.blueprint!.includes("FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001"),
  sources.blueprint!.includes("GPT_RESPONSE_STOPPED_EMPTY"),
  sources.blueprint!.includes("连续消失且回答连续为空满20分钟"),
  sources.blueprint!.includes("账号级至少 1.5 秒起始节拍"),
  sources.blueprint!.includes("detection→ack 唯一紧急对外动作"),
  sources.browserBlueprint!.includes("chatgptPageAccessNotBefore"),
  sources.browserBlueprint!.includes("detection→dispatch可豁免1.5秒"),
];

const lifecycleChecks = (sources: Readonly<Record<string, string>>): boolean[] => {
  const probeWalRead = sources.lifecycle!.indexOf("active.browser.readAtomicStepOutcome(confirmed.submitIdentity)");
  return [
    sources.lifecycle!.includes('"confirmed-readback"'),
    probeWalRead >= 0,
    sources.lifecycle!.includes("PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000"),
    sources.lifecycle!.includes("GPT_PROVIDER_WAIT_INITIAL_OBSERVATION"),
    sources.lifecycle!.includes("GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE"),
    sources.lifecycle!.includes("GPT_PROVIDER_WAIT_ADJACENT_ASSISTANT_MISSING"),
    sources.lifecycle!.includes("GPT_PROVIDER_WAIT_STOP_PRESENT"),
    sources.lifecycle!.includes("GPT_PROVIDER_WAIT_STOPPED_EMPTY_CONFIRMING"),
    sources.lifecycle!.includes('reason === "generated-image-source-pending"'),
    sources.lifecycle!.includes('"GPT_PROVIDER_WAIT_ACTIVE"'),
    sources.lifecycle!.includes("recoverySelectionRequired: targetMode === \"confirmed-readback\""),
    !sources.lifecycle!.includes('"provider-probe"'),
    !sources.lifecycle!.includes("startProviderProbeCooldown"),
    !sources.lifecycle!.includes("BROWSER_RECONCILIATION_IDENTITY_MISMATCH"),
    sources.targetAcquirer!.includes(
      "requestPreauthorizedTargetAcquisition(\n        targetMode, jobRefHash, parentConversationUrl, expectedTargetRef,",
    ),
    sources.targetAcquirer!.includes("expectedTargetRef"),
    sources.mutationEvidence!.includes("providerEffectIdentityHash: input.effectScope === \"provider_effect\""),
    !sources.candidate!.includes("priorTurns.length > 1"),
    !sources.candidate!.includes("querySelectorAll(outgoing.userTurnSelector)"),
    !sources.candidate!.includes("baselineOrdinal + 2"),
    sources.store!.includes("row.attempt_id !== input.attemptId"),
    sources.checkpoint!.includes("GPT_STOPPED_EMPTY_CONFIRMATION_MS = 20 * 60 * 1_000"),
    sources.checkpoint!.includes("observation.generatingRaw > 0"),
    sources.checkpoint!.includes('gptExecutionFailure("GPT_RESPONSE_STOPPED_EMPTY"'),
    sources.checkpoint!.includes("stoppedEmptyWindow = null"),
    sources.checkpoint!.includes("let exactResponseObserved = false"),
    sources.checkpoint!.includes("Date.now() < deadline || exactResponseObserved"),
    sources.checkpoint!.includes("Date.now() + GPT_STOPPED_EMPTY_CONFIRMATION_MS : deadline"),
    sources.checkpoint!.includes("if (exactResponseObserved) continue"),
    sources.checkpoint!.includes("exactResponseObserved = assistant !== null"),
    sources.checkpoint!.includes("continuousMonotonicMs"),
    sources.checkpoint!.includes("observationCount"),
    sources.checkpoint!.includes("terminalObservationRevisionHash"),
    textResponseTwoGateSettlementIsFrozen(sources.checkpoint!),
    providerWaitReasonProjectionIsFrozen(
      sources.contract!, sources.lifecycle!, sources.checkpoint!, sources.imageCheckpoint!,
    ),
  ];
};

const sources = (context: InspectorContext): Readonly<Record<string, string>> => ({
  contract: read(context, `${ROOT}/contract.ts`),
  atomic: read(context, `${ROOT}/production-atomic-call.ts`),
  group: read(context, `${ROOT}/ability-group.ts`),
  childHandler: read(context, `${ROOT}/web/child-handler.ts`),
  productApi: read(context, `${ROOT}/product-api.ts`),
  seoReadback: read(context, "src/plugins/public-knowledge-article-pipeline/seo-submit-readback.ts"),
  seoFlow: read(context, "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts"),
  submit: read(context, `${ROOT}/children/submit_exact_gpt_turn_once/handler.ts`),
  candidate: read(context, "src/lib/browser/chrome-extension/dom-coherent-candidate.ts"),
  attachmentSchema: read(context, `${ROOT}/schema.ts`),
  attachmentReconciliation: read(context, `${ROOT}/children/reconcile_gpt_attachment_set/observation.ts`),
  store: read(context, "src/lib/browser/exact-target/browser-mutation-store.ts"),
  mutationEvidence: read(context, "src/lib/browser/exact-target/browser-mutation-evidence.ts"),
  lifecycle: read(context, `${ROOT}/production-browser-lifecycle.ts`),
  targetAcquirer: read(context, "src/lib/browser/infrastructure/browser-target-acquirer.ts"),
  checkpoint: read(context, `${ROOT}/children/checkpoint_gpt_text_response/handler.ts`),
  imageCheckpoint: read(context, `${ROOT}/children/checkpoint_gpt_generated_image/handler.ts`),
  blueprint: read(context, "docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md"),
  browserBlueprint: read(context,
    "docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md"),
});

export const inspectFrozenAttemptBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  evidenceMode: "static.ast" | "static.contract",
): void => {
  const current = sources(context);
  const valid = [...contractChecks(current), ...productChecks(current),
    ...frozenBlueprintChecks(current), ...lifecycleChecks(current)].every(Boolean);
  if (!valid) findings.push(createFinding({
    evidenceMode,
    lawId: LAW_ID,
    clauseId: `${LAW_ID.toLowerCase()}-requirement`,
    checkId: "gpt/frozen-job-attempt-provider-effect",
    filePath: `${ROOT}/contract.ts`,
    message: "Frozen attempt-local preparation and cross-attempt submit boundary is incomplete.",
  }));
};
