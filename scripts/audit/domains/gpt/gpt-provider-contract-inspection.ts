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
const SEMANTIC_TEXT = "src/lib/browser/chrome-extension/dom-semantic-text.ts";
const EXACT_ASSISTANT = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";
const PRODUCTION_CHILD_TOOLS = `${ROOT}/production-child-tools.ts`;
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

export const inspectGptProviderProbeOwnerContract = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const lane = sourceText(context, BROWSER_LANE);
  const lifecycle = sourceText(context, LIFECYCLE);
  requireTokens(lane, BROWSER_LANE, [
    "private readonly queue: LaneWaiter[] = []", "new Proxy(lease",
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
  if (existsSync(resolve(context.sealedRoot, RETIRED_CADENCE))) {
    findings.push(finding(
      "gpt/no-second-wait-scheduler", RETIRED_CADENCE,
      "GPT-local Provider polling cadence must be physically absent.",
    ));
  }
  requireTokens(lifecycle, LIFECYCLE, [
    'childCapabilityId !== "checkpoint_gpt_text_response"',
    'childCapabilityId !== "checkpoint_gpt_generated_image"',
    "PROVIDER_OBSERVATION_INTERVAL_MS = 30_000", "waitForProviderObservation",
    "active.browser.readAtomicStepOutcome(confirmed.submitIdentity)",
    'recoverySelectionRequired: targetMode === "confirmed-readback"',
    "selectExactGptConversation", "setTimeout",
    'mode: "product-call-settlement"',
  ], findings, finding);
  for (const forbidden of ["yieldForProviderProbe", "yieldForProviderWait", "waitForDelay",
    "yieldAndReacquire", "productionGptCrossConversationPollCadence", '"provider-probe"',
    "startProviderProbeCooldown"]) if (lifecycle.includes(forbidden)) findings.push(finding(
    "gpt/no-second-wait-scheduler", LIFECYCLE, `GPT lifecycle retains forbidden ${forbidden}.`,
  ));
  const lifecycleClass = context.project.getSourceFile(resolve(context.sealedRoot, LIFECYCLE))
    ?.getClass("ProductionGptBrowserLifecycle");
  const parkActive = lifecycleClass?.getMethod("parkActive");
  const parkCalls = lifecycleClass?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "active.browser.park") ?? [];
  if (parkCalls.length !== 1 || !parkActive?.getText().includes("active.browser.pendingMutationCount() > 0")
    || !parkActive.getText().includes('mode: "product-call-settlement"')
    || !lifecycleClass?.getMethod("settle")?.getText().includes("this.parkActive(")) findings.push(finding(
    "gpt/no-browser-poll-scheduler", LIFECYCLE,
    "The sole Browser park must be structurally owned by guarded Product settlement.",
  ));
  for (const retired of ["wait_for_stable_gpt_text", "wait_for_stable_gpt_image", "overdueRecoveryProbe"]) {
    if (lifecycle.includes(retired)) findings.push(finding(
      "gpt/retired-wait-child-absent", LIFECYCLE, `Lifecycle retains retired ${retired}.`,
    ));
  }
};

export const inspectProviderWaitContract = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const textHandler = sourceText(context, TEXT_HANDLER);
  const imageHandler = sourceText(context, IMAGE_HANDLER);
  const responseState = sourceText(context, RESPONSE_STATE);
  const submit = sourceText(context, SUBMIT_HANDLER);
  const tools = sourceText(context, PRODUCTION_CHILD_TOOLS);
  const artifacts = sourceText(context, EVIDENCE_ARTIFACTS);
  requireTokens(textHandler, TEXT_HANDLER, [
    "checkpointGptTextResponseHandler", "probeBudgetMs", "userTurnId",
    "readExactAssistantTurn", "semanticText.trim().length > 0", "waitForProviderObservation",
    'throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT")',
  ], findings, finding);
  requireTokens(imageHandler, IMAGE_HANDLER, [
    "checkpointGptGeneratedImageHandler", "probeBudgetMs", "userTurnId",
    "readAuthenticatedMedia", "waitForProviderObservation", 'mutationOutcome: "no"', "browserFact: null",
    'throw executionFailure("failed", "GPT_IMAGE_TIMEOUT")',
  ], findings, finding);
  requireTokens(responseState, RESPONSE_STATE, [
    "readExactAssistantTurn", "userTurnId", "precedingUserTurnId",
  ], findings, finding);
  requireTokens(submit, SUBMIT_HANDLER, [
    "submitExactGptTurnOnceHandler", "requireConfirmedBrowserFact", 'status: "CONFIRMED"',
    "canonicalConversationUrl", "userTurnId",
  ], findings, finding);
  requireTokens(artifacts, EVIDENCE_ARTIFACTS, [
    "readPersistedGptTextResponse", "FORENSICS_ARTIFACT_NOT_FOUND",
    "GPT_TEXT_TASK_ARTIFACT_INVALID", "observedResponseArtifact(row)",
  ], findings, finding);
  const persistedRead = tools.indexOf("readPersistedGptTextResponse(");
  const browserObservation = tools.indexOf("executeProductionGptAtomicCall({");
  if (persistedRead < 0 || browserObservation < 0 || persistedRead > browserObservation) {
    findings.push(finding("gpt/persisted-checkpoint-before-browser", PRODUCTION_CHILD_TOOLS,
      "A valid exact-call text artifact must be read before any checkpoint Browser observation."));
  }
  for (const retired of [
    "reconcile_gpt_draft", "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text",
    "wait_for_stable_gpt_image", "fork_exact_gpt_conversation_at_checkpoint",
  ]) if ([textHandler, responseState, imageHandler, submit].some((source) => source.includes(retired))) {
    findings.push(finding("gpt/retired-provider-step-absent", ROOT,
      `Current provider chain retains retired ${retired}.`));
  }
  for (const forbidden of [
    "adjacentGptAssistantTurnId", "downloadAuthenticatedMedia", "visible-download",
    "requireConfirmedBrowserFact(intent, browser)",
  ]) if ([textHandler, responseState, imageHandler].some((source) => source.includes(forbidden))) {
    findings.push(finding("gpt/retired-provider-step-absent", ROOT,
      `Current checkpoint chain retains forbidden ${forbidden}.`));
  }
  for (const [path, source] of [[TEXT_HANDLER, textHandler], [IMAGE_HANDLER, imageHandler]] as const) {
    for (const forbidden of ["browser.wait(", "selectExactGptConversation", "let delay = 250",
      "Math.min(5_000", "* 1.5"]) {
      if (source.includes(forbidden)) findings.push(finding(
        "gpt/no-child-poll-clock", path, `Checkpoint Child retains forbidden ${forbidden}.`,
      ));
    }
  }
  requireTokens(sourceText(context, SEMANTIC_TEXT), SEMANTIC_TEXT, [
    "browserCanonicalSemanticText", "insidePre", 'name === "CODE"',
  ], findings, finding);
  requireTokens(sourceText(context, EXACT_ASSISTANT), EXACT_ASSISTANT, [
    "BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE", "browserCanonicalSemanticText",
  ], findings, finding);
  for (const forbidden of ["expectedPromptHash", "precedingPromptHash", "responseHashInput"]) {
    if ([textHandler, imageHandler, responseState, sourceText(context, EXACT_ASSISTANT)]
      .some((source) => source.includes(forbidden))) findings.push(finding(
      "gpt/response-prompt-rehash-absent", ROOT,
      `Response checkpoint chain retains forbidden second prompt identity ${forbidden}.`,
    ));
  }
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
