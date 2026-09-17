import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SyntaxKind } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const TEXT_HANDLER = `${ROOT}/children/checkpoint_gpt_text_response/handler.ts`;
const IMAGE_HANDLER = `${ROOT}/children/checkpoint_gpt_generated_image/handler.ts`;
const RESPONSE_STATE = `${ROOT}/web/gpt-dom-observation.ts`;
const SUBMIT_HANDLER = `${ROOT}/children/submit_exact_gpt_turn_once/handler.ts`;
const LIFECYCLE = `${ROOT}/production-browser-lifecycle.ts`;
const RETIRED_CADENCE = `${ROOT}/provider-wait-cross-conversation-cadence.ts`;
const BROWSER_LANE = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
const BROWSER_MUTATION_STORE = "src/lib/browser/exact-target/browser-mutation-store.ts";
const SEMANTIC_TEXT = "src/lib/browser/chrome-extension/dom-semantic-text.ts";
const EXACT_ASSISTANT = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";
const PRODUCTION_CHILD_TOOLS = `${ROOT}/production-child-tools.ts`;
const PRODUCTION_CALL_PREPARATION = `${ROOT}/production-call-preparation.ts`;
const PRODUCTION_PORTS = `${ROOT}/production-ports.ts`;
const PRODUCT_API = `${ROOT}/product-api.ts`;
const EVIDENCE_ARTIFACTS = `${ROOT}/evidence-artifacts.ts`;

type FindingFactory = (checkId: string, filePath: string, message: string) => InspectorFinding;
const sourceText = (context: InspectorContext, path: string): string =>
  context.project.getSourceFile(resolve(context.sealedRoot, path))?.getFullText() ?? "";

const requireTokens = (source: string, path: string, tokens: readonly string[],
  findings: InspectorFinding[], finding: FindingFactory): void => {
  for (const token of tokens) if (!source.includes(token)) findings.push(finding(
    "gpt/current-provider-chain", path, `Current provider chain is missing ${token}.`,
  ));
};

const inspectBrowserLaneProviderContract = (
  context: InspectorContext, lane: string, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  requireTokens(lane, BROWSER_LANE, [
    "private readonly queue: LaneWaiter[] = []", "new Proxy(lease", "waiter.binding.productStepId",
    "PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000",
    "PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001",
    "Math.floor(Math.random() * PROVIDER_OBSERVATION_RANDOM_SPAN_MS)",
  ], findings, finding);
  for (const forbidden of ["provider-probe", "nextProviderProbeEligibleAt", "startProviderProbeCooldown",
    "waiter.purpose"]) if (lane.includes(forbidden)) findings.push(finding(
    "gpt/no-browser-poll-scheduler", BROWSER_LANE,
    `Browser FIFO retains retired normal-poll scheduling state ${forbidden}.`,
  ));
  if (lane.includes("...lease")) findings.push(finding(
    "gpt/live-browser-document", BROWSER_LANE,
    "Browser FIFO wrapper must not snapshot the lease's live Document getter.",
  ));
  if (existsSync(resolve(context.sealedRoot, RETIRED_CADENCE))) findings.push(finding(
    "gpt/no-second-wait-scheduler", RETIRED_CADENCE,
    "GPT-local Provider polling cadence must be physically absent.",
  ));
};

const inspectProviderParking = (
  context: InspectorContext, lifecycle: string,
  findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const lifecycleClass = context.project.getSourceFile(resolve(context.sealedRoot, LIFECYCLE))
    ?.getClass("ProductionGptBrowserLifecycle");
  const parkActive = lifecycleClass?.getMethod("parkActive");
  const waitForObservation = lifecycleClass?.getMethod("waitForProviderObservation");
  const observationParkCalls = waitForObservation?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "active.facade.park") ?? [];
  const settlementParkCalls = parkActive?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "current.call.browser.park") ?? [];
  const exactParkCalls = [observationParkCalls.length, settlementParkCalls.length]
    .every((count) => count === 1);
  if (!exactParkCalls
    || !parkActive?.getText().includes('mode: "product-call-settlement"')
    || !waitForObservation?.getText().includes("active.browser.pendingMutationCount() > 0")
    || !waitForObservation?.getText().includes('"bound-observation", eligibleAt')
    || !lifecycleClass?.getMethod("settle")?.getText().includes("this.parkActive(")) findings.push(finding(
    "gpt/no-browser-poll-scheduler", LIFECYCLE,
    "Provider pending and Product settlement must park through the sole Browser lane, with Browser-owned observation eligibility.",
  ));
  for (const retired of ["wait_for_stable_gpt_text", "wait_for_stable_gpt_image", "overdueRecoveryProbe"]) {
    if (lifecycle.includes(retired)) findings.push(finding(
      "gpt/retired-wait-child-absent", LIFECYCLE, `Lifecycle retains retired ${retired}.`,
    ));
  }
};

export const inspectGptProviderProbeOwnerContract = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const lane = sourceText(context, BROWSER_LANE);
  const lifecycle = sourceText(context, LIFECYCLE);
  inspectBrowserLaneProviderContract(context, lane, findings, finding);
  requireTokens(lifecycle, LIFECYCLE, [
    'childCapabilityId !== "checkpoint_gpt_text_response"',
    'childCapabilityId !== "checkpoint_gpt_generated_image"',
    "PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000", "waitForProviderObservation",
    "const eligibleAt = Date.now() + PROVIDER_OBSERVATION_MIN_INTERVAL_MS",
    'if (eligibleAt > observationDeadlineAt) return "deadline"',
    "active.browser.readAtomicStepOutcome(confirmed.submitIdentity)",
    'recoverySelectionRequired: targetMode === "confirmed-readback"',
    "selectExactGptConversation", '"bound-observation"', "eligibleAt",
    'mode: "product-call-settlement"',
  ], findings, finding);
  if (lifecycle.includes("Math.random")) findings.push(finding(
    "gpt/no-second-wait-scheduler", LIFECYCLE,
    "GPT must not sample a per-Child Provider observation interval.",
  ));
  const mutationStore = sourceText(context, BROWSER_MUTATION_STORE);
  requireTokens(mutationStore, BROWSER_MUTATION_STORE, [
    "readUniqueConfirmedConversationUrl(parentJobId: string, parentProductStepId: string)",
    "where job_id=? and product_step_id=?", "product_step_id=? and call_id='turn-submit'",
    "child_capability_id='submit_exact_gpt_turn_once'",
  ], findings, finding);
  for (const forbidden of ["parentAttemptId", "job_id=? and attempt_id=? and product_step_id=?"])
    if (mutationStore.includes(forbidden)) findings.push(finding(
      "gpt/attempt-free-parent-provider-locator", BROWSER_MUTATION_STORE,
      `Parent Provider locator retains forbidden attempt gate ${forbidden}.`,
    ));
  for (const forbidden of ["yieldForProviderProbe", "yieldForProviderWait", "waitForDelay",
    "yieldAndReacquire", "productionGptCrossConversationPollCadence", '"provider-probe"',
    "startProviderProbeCooldown"]) if (lifecycle.includes(forbidden)) findings.push(finding(
    "gpt/no-second-wait-scheduler", LIFECYCLE, `GPT lifecycle retains forbidden ${forbidden}.`,
  ));
  inspectProviderParking(context, lifecycle, findings, finding);
};

type ProviderWaitSources = Readonly<{
  textHandler: string;
  imageHandler: string;
  responseState: string;
  submit: string;
  tools: string;
  preparation: string;
  artifacts: string;
}>;

const inspectProviderObservationOrder = (
  sources: ProviderWaitSources, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const textGate = sources.textHandler.indexOf("await context.waitForProviderObservation(");
  const textObservation = sources.textHandler.indexOf("readExactAssistantTurn(browser");
  const imageGate = sources.imageHandler.indexOf("await context.waitForProviderObservation(");
  const imageObservation = sources.imageHandler.indexOf("browser.readAuthenticatedMedia(");
  if (textGate < 0 || textObservation < 0 || textGate > textObservation
    || imageGate < 0 || imageObservation < 0 || imageGate > imageObservation) findings.push(finding(
    "gpt/provider-observation-gate-first", ROOT,
    "The first and subsequent text or image observations must enter the global Browser gate first.",
  ));
  const recoveryCall = sources.tools.indexOf("recoverPersistedTextCheckpoint(");
  const browserObservation = sources.tools.indexOf("runProductionAtomicPhase(");
  const ownsPersistedRead = sources.preparation.includes("readPersistedGptTextResponse({");
  if (!ownsPersistedRead || recoveryCall < 0 || browserObservation < 0
    || recoveryCall > browserObservation) findings.push(finding(
    "gpt/persisted-checkpoint-before-browser", PRODUCTION_CHILD_TOOLS,
    "A valid exact-call text artifact must be read before any checkpoint Browser observation.",
  ));
};

const inspectRetiredProviderWaitSurfaces = (
  context: InspectorContext, sources: ProviderWaitSources,
  findings: InspectorFinding[], finding: FindingFactory,
): void => {
  for (const retired of [
    "reconcile_gpt_draft", "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text",
    "wait_for_stable_gpt_image", "fork_exact_gpt_conversation_at_checkpoint",
  ]) if ([sources.textHandler, sources.responseState, sources.imageHandler, sources.submit]
    .some((source) => source.includes(retired))) findings.push(finding(
    "gpt/retired-provider-step-absent", ROOT, `Current provider chain retains retired ${retired}.`,
  ));
  for (const forbidden of [
    "adjacentGptAssistantTurnId", "downloadAuthenticatedMedia", "visible-download",
    "requireConfirmedBrowserFact(intent, browser)",
  ]) if ([sources.textHandler, sources.responseState, sources.imageHandler]
    .some((source) => source.includes(forbidden))) findings.push(finding(
    "gpt/retired-provider-step-absent", ROOT,
    `Current checkpoint chain retains forbidden ${forbidden}.`,
  ));
  for (const [path, source] of [
    [TEXT_HANDLER, sources.textHandler], [IMAGE_HANDLER, sources.imageHandler],
  ] as const) for (const forbidden of [
    "browser.wait(", "selectExactGptConversation", "let delay = 250", "Math.min(5_000", "* 1.5",
  ]) if (source.includes(forbidden)) findings.push(finding(
    "gpt/no-child-poll-clock", path, `Checkpoint Child retains forbidden ${forbidden}.`,
  ));
  for (const forbidden of ["expectedPromptHash", "precedingPromptHash", "responseHashInput"]) {
    if ([sources.textHandler, sources.imageHandler, sources.responseState, sourceText(context, EXACT_ASSISTANT)]
      .some((source) => source.includes(forbidden))) findings.push(finding(
      "gpt/response-prompt-rehash-absent", ROOT,
      `Response checkpoint chain retains forbidden second prompt identity ${forbidden}.`,
    ));
  }
};

export const inspectProviderWaitContract = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const sources: ProviderWaitSources = {
    textHandler: sourceText(context, TEXT_HANDLER),
    imageHandler: sourceText(context, IMAGE_HANDLER),
    responseState: sourceText(context, RESPONSE_STATE),
    submit: sourceText(context, SUBMIT_HANDLER),
    tools: sourceText(context, PRODUCTION_CHILD_TOOLS),
    preparation: sourceText(context, PRODUCTION_CALL_PREPARATION),
    artifacts: sourceText(context, EVIDENCE_ARTIFACTS),
  };
  requireTokens(sources.textHandler, TEXT_HANDLER, [
    "checkpointGptTextResponseHandler", "probeBudgetMs", "userTurnId",
    "readExactAssistantTurn", "semanticText.trim().length > 0", "waitForProviderObservation",
    'throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT")',
  ], findings, finding);
  requireTokens(sources.imageHandler, IMAGE_HANDLER, [
    "checkpointGptGeneratedImageHandler", "probeBudgetMs", "userTurnId",
    "readAuthenticatedMedia", "waitForProviderObservation", 'mutationOutcome: "no"', "browserFact: null",
    'throw executionFailure("failed", "GPT_IMAGE_TIMEOUT")',
  ], findings, finding);
  inspectProviderObservationOrder(sources, findings, finding);
  requireTokens(sources.responseState, RESPONSE_STATE, [
    "readExactAssistantTurn", "userTurnId", "precedingUserTurnId",
  ], findings, finding);
  requireTokens(sources.submit, SUBMIT_HANDLER, [
    "submitExactGptTurnOnceHandler", "requireConfirmedBrowserFact", 'status: "CONFIRMED"',
    "canonicalConversationUrl", "userTurnId", "promptHash: submittedPromptHash",
  ], findings, finding);
  requireTokens(sources.tools, PRODUCTION_CHILD_TOOLS, [
    "readProviderEffectStepCallFact({", "inputHash: existing.inputHash",
    "browserAtomicIdentity",
  ], findings, finding);
  requireTokens(sourceText(context, PRODUCTION_PORTS), PRODUCTION_PORTS, [
    "readProviderEffectStepCallFact(input:", "BrowserProviderEffectStepCallFact | null",
  ], findings, finding);
  if ([sources.tools, sourceText(context, PRODUCTION_PORTS)]
    .some((source) => source.includes("readProviderEffectStepCallIdentities"))) findings.push(finding(
    "gpt/historical-provider-effect-authority", PRODUCTION_CHILD_TOOLS,
    "The retired current-identity comparison gate must remain physically absent.",
  ));
  requireTokens(sources.artifacts, EVIDENCE_ARTIFACTS, [
    "readPersistedGptTextResponse", "FORENSICS_ARTIFACT_NOT_FOUND",
    "GPT_TEXT_TASK_ARTIFACT_INVALID", "observedResponseArtifact(row)",
  ], findings, finding);
  inspectRetiredProviderWaitSurfaces(context, sources, findings, finding);
  requireTokens(sourceText(context, SEMANTIC_TEXT), SEMANTIC_TEXT, [
    "browserCanonicalSemanticText", "insidePre", 'name === "CODE"',
  ], findings, finding);
  requireTokens(sourceText(context, EXACT_ASSISTANT), EXACT_ASSISTANT, [
    "BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE", "browserCanonicalSemanticText",
  ], findings, finding);
};

export const inspectGptCrossTaskStateAbsence = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const tools = sourceText(context, PRODUCTION_CHILD_TOOLS);
  const ports = sourceText(context, PRODUCTION_PORTS);
  const api = sourceText(context, PRODUCT_API);
  for (const forbidden of [
    "acquireContinuation", "recordContinuation", "GptContinuationStore", "gpt_continuations",
    "consultationIdentityHash", "predecessorSourceTaskRef", "readConfirmedProviderLocator",
  ]) {
    if ([tools, ports, api].some((source) => source.includes(forbidden))) findings.push(finding(
      "gpt/no-cross-task-provider-state", ROOT,
      `GPT production surface retains forbidden cross-task Provider state ${forbidden}.`,
    ));
  }
};
