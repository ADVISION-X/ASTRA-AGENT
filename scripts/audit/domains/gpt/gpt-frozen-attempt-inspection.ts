import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const LAW_ID = "LAW-GPT-002-V15";
const ROOT = "src/capabilities/gpt";
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");

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
  sources.attachmentSchema!.includes("normalizeGptProviderAttachmentLabel"),
  sources.attachmentReconciliation!.includes("normalizeGptProviderAttachmentLabel(label, expectedLabels)"),
  sources.candidate!.includes("expectedLabels.includes(providerLabel(label))"),
  sources.blueprint!.includes("FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001"),
  sources.blueprint!.includes("FROZEN-GPT-ATOMIC-IDENTITY-ROUNDTRIP-001"),
  sources.blueprint!.includes("FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001"),
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
    sources.lifecycle!.includes("PROVIDER_OBSERVATION_INTERVAL_MS = 60_000"),
    sources.lifecycle!.includes("recoverySelectionRequired: targetMode === \"confirmed-readback\""),
    !sources.lifecycle!.includes('"provider-probe"'),
    !sources.lifecycle!.includes("startProviderProbeCooldown"),
    !sources.lifecycle!.includes("BROWSER_RECONCILIATION_IDENTITY_MISMATCH"),
    sources.targetAcquirer!.includes(
      "requestPreauthorizedTargetAcquisition(\n        targetMode, jobRefHash, parentConversationUrl,",
    ),
    !sources.targetAcquirer!.includes("expectedTargetRef"),
    sources.store!.includes("providerEffectIdentityHash: input.effectScope === \"provider_effect\""),
    !sources.candidate!.includes("priorTurns.length > 1"),
    !sources.candidate!.includes("querySelectorAll(outgoing.userTurnSelector)"),
    !sources.candidate!.includes("baselineOrdinal + 2"),
    sources.store!.includes("row.attempt_id !== input.attemptId"),
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
  lifecycle: read(context, `${ROOT}/production-browser-lifecycle.ts`),
  targetAcquirer: read(context, "src/lib/browser/infrastructure/browser-target-acquirer.ts"),
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
