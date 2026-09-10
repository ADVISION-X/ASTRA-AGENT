import { resolve } from "node:path";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const TEXT_HANDLER = `${ROOT}/children/checkpoint_gpt_text_response/handler.ts`;
const TEXT_PAGE = `${ROOT}/children/checkpoint_gpt_text_response/page-observation.ts`;
const IMAGE_HANDLER = `${ROOT}/children/checkpoint_gpt_generated_image/handler.ts`;
const IMAGE_PAGE = `${ROOT}/children/checkpoint_gpt_generated_image/page-observation.ts`;
const SUBMIT_HANDLER = `${ROOT}/children/submit_exact_gpt_turn_once/handler.ts`;
const LIFECYCLE = `${ROOT}/production-browser-lifecycle.ts`;
const CADENCE = `${ROOT}/provider-wait-cross-conversation-cadence.ts`;
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

export const inspectGptCrossConversationPollContract = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const cadence = sourceText(context, CADENCE);
  const lifecycle = sourceText(context, LIFECYCLE);
  requireTokens(cadence, CADENCE, [
    "GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS = 30_000", "private nextEligibleAt = 0",
    "public reserve(now: number)", "public bindDispatch(now: number)",
  ], findings, finding);
  for (const forbidden of ["new Map", "new Set", "setInterval", "setTimeout"]) {
    if (cadence.includes(forbidden)) findings.push(finding(
      "gpt/no-second-wait-scheduler", CADENCE, `Polling cadence retains forbidden ${forbidden}.`,
    ));
  }
  requireTokens(lifecycle, LIFECYCLE, [
    'childCapabilityId !== "checkpoint_gpt_text_response"',
    'childCapabilityId !== "checkpoint_gpt_generated_image"',
    "productionGptCrossConversationPollCadence.reserve(performance.now())",
    "productionGptCrossConversationPollCadence.bindDispatch(performance.now())",
    "await this.yieldAndReacquire(",
  ], findings, finding);
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
    "readExactAssistantTurn", "semanticText.trim().length > 0", "yieldForProviderWait",
    'throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT")',
  ], findings, finding);
  requireTokens(imageHandler, IMAGE_HANDLER, [
    "checkpointGptGeneratedImageHandler", "probeBudgetMs", "ensureResponseConversation",
    "downloadAuthenticatedMedia", "yieldForProviderWait", "requireConfirmedBrowserFact",
    'throw executionFailure("failed", "GPT_IMAGE_TIMEOUT")',
  ], findings, finding);
  for (const [path, source] of [[TEXT_PAGE, textPage], [IMAGE_PAGE, imagePage]] as const) {
    requireTokens(source, path, [
      "canonicalGptConversationUrl", "navigateCrossConversationPoll", "Date.now() >= input.deadline",
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
  requireTokens(sourceText(context, SEMANTIC_TEXT), SEMANTIC_TEXT, [
    "browserCanonicalSemanticText", "insidePre", 'name === "CODE"',
  ], findings, finding);
  requireTokens(sourceText(context, EXACT_ASSISTANT), EXACT_ASSISTANT, [
    "BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE", "browserCanonicalSemanticText",
  ], findings, finding);
};
