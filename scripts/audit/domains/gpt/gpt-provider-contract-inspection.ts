import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const TEXT_HANDLER = `${ROOT}/children/checkpoint_gpt_text_response/handler.ts`;
const TEXT_PAGE = `${ROOT}/children/checkpoint_gpt_text_response/page-observation.ts`;
const IMAGE_HANDLER = `${ROOT}/children/checkpoint_gpt_generated_image/handler.ts`;
const IMAGE_PAGE = `${ROOT}/children/checkpoint_gpt_generated_image/page-observation.ts`;
const SUBMIT_HANDLER = `${ROOT}/children/submit_exact_gpt_turn_once/handler.ts`;
const LIFECYCLE = `${ROOT}/production-browser-lifecycle.ts`;
const RETIRED_CADENCE = `${ROOT}/provider-wait-cross-conversation-cadence.ts`;
const BROWSER_LANE = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
const SEMANTIC_TEXT = "src/lib/browser/chrome-extension/dom-semantic-text.ts";
const EXACT_ASSISTANT = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";

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
    "BROWSER_PROVIDER_PROBE_INTERVAL_MS = 30_000", "private nextProviderProbeEligibleAt = 0",
    'waiter.purpose === "provider-probe"', "startProviderProbeCooldown", "new Proxy(lease",
  ], findings, finding);
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
    '"provider-probe", probeDeadlineAt', "startProviderProbeCooldown: true",
    "navigateExactProviderConversation",
  ], findings, finding);
  for (const forbidden of ["yieldForProviderWait", "waitForDelay", "yieldAndReacquire",
    "productionGptCrossConversationPollCadence"]) if (lifecycle.includes(forbidden)) findings.push(finding(
    "gpt/no-second-wait-scheduler", LIFECYCLE, `GPT lifecycle retains forbidden ${forbidden}.`,
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
  const textPage = sourceText(context, TEXT_PAGE);
  const imageHandler = sourceText(context, IMAGE_HANDLER);
  const imagePage = sourceText(context, IMAGE_PAGE);
  const submit = sourceText(context, SUBMIT_HANDLER);
  requireTokens(textHandler, TEXT_HANDLER, [
    "checkpointGptTextResponseHandler", "probeBudgetMs", "readExactResponsePage",
    "readExactAssistantTurn", "semanticText.trim().length > 0", "yieldForProviderProbe",
    'throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT")',
  ], findings, finding);
  requireTokens(imageHandler, IMAGE_HANDLER, [
    "checkpointGptGeneratedImageHandler", "probeBudgetMs", "ensureResponseConversation",
    "downloadAuthenticatedMedia", "yieldForProviderProbe", "requireConfirmedBrowserFact",
    'throw executionFailure("failed", "GPT_IMAGE_TIMEOUT")',
  ], findings, finding);
  for (const [path, source] of [[TEXT_PAGE, textPage], [IMAGE_PAGE, imagePage]] as const) {
    requireTokens(source, path, [
      "canonicalGptConversationUrl", "navigateExactProviderConversation", "Date.now() >= input.deadline",
    ], findings, finding);
  }
  requireTokens(submit, SUBMIT_HANDLER, [
    "submitExactGptTurnOnceHandler", "requireConfirmedBrowserFact", 'status: "CONFIRMED"',
    "canonicalConversationUrl", "userTurnId",
  ], findings, finding);
  for (const retired of [
    "reconcile_gpt_draft", "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text",
    "wait_for_stable_gpt_image", "fork_exact_gpt_conversation_at_checkpoint",
  ]) if ([textHandler, textPage, imageHandler, imagePage, submit].some((source) => source.includes(retired))) {
    findings.push(finding("gpt/retired-provider-step-absent", ROOT,
      `Current provider chain retains retired ${retired}.`));
  }
  for (const [path, source] of [[TEXT_HANDLER, textHandler], [IMAGE_HANDLER, imageHandler]] as const) {
    for (const forbidden of ["browser.wait(", "let delay = 250", "Math.min(5_000", "* 1.5"]) {
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
};
