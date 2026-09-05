import { resolve } from "node:path";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const childHandlerPath = (id: string): string => `${ROOT}/children/${id}/handler.ts`;
const childFilePath = (id: string, file: string): string => `${ROOT}/children/${id}/${file}`;
const TEXT_RESPONSE_HANDLER_PATH = childHandlerPath("wait_for_stable_gpt_text");
const TEXT_RESPONSE_PATHS = [
  TEXT_RESPONSE_HANDLER_PATH,
  childFilePath("wait_for_stable_gpt_text", "page-observation.ts"),
  childFilePath("wait_for_stable_gpt_text", "response-support.ts"),
  childFilePath("wait_for_stable_gpt_text", "selectors.ts"),
  childHandlerPath("checkpoint_gpt_text_response"),
  childFilePath("checkpoint_gpt_text_response", "page-observation.ts"),
  childFilePath("checkpoint_gpt_text_response", "response-support.ts"),
  childFilePath("checkpoint_gpt_text_response", "selectors.ts"),
] as const;
const IMAGE_RESPONSE_HANDLER_PATH = childHandlerPath("wait_for_stable_gpt_image");
const IMAGE_RESPONSE_PATHS = [
  IMAGE_RESPONSE_HANDLER_PATH,
  childFilePath("wait_for_stable_gpt_image", "page-observation.ts"),
  childFilePath("wait_for_stable_gpt_image", "response-support.ts"),
  childFilePath("wait_for_stable_gpt_image", "selectors.ts"),
  childHandlerPath("checkpoint_gpt_generated_image"),
  childFilePath("checkpoint_gpt_generated_image", "page-observation.ts"),
  childFilePath("checkpoint_gpt_generated_image", "response-support.ts"),
  childFilePath("checkpoint_gpt_generated_image", "selectors.ts"),
] as const;
const CONVERSATION_HANDLER_PATH = childHandlerPath("prepare_clean_gpt_chat");
const CONVERSATION_PATHS = [
  CONVERSATION_HANDLER_PATH,
  childHandlerPath("focus_exact_gpt_conversation"),
  childHandlerPath("verify_gpt_conversation_identity"),
  childHandlerPath("open_gpt_checkpoint_actions_menu"),
  childHandlerPath("open_gpt_fork_destination_menu"),
  childHandlerPath("fork_exact_gpt_conversation_at_checkpoint"),
  childFilePath("prepare_clean_gpt_chat", "observation.ts"),
  childFilePath("prepare_clean_gpt_chat", "selectors.ts"),
  childFilePath("focus_exact_gpt_conversation", "observation.ts"),
  childFilePath("focus_exact_gpt_conversation", "selectors.ts"),
  childFilePath("verify_gpt_conversation_identity", "observation.ts"),
  childFilePath("verify_gpt_conversation_identity", "selectors.ts"),
  childFilePath("open_gpt_checkpoint_actions_menu", "observation.ts"),
  childFilePath("open_gpt_checkpoint_actions_menu", "menu-state.ts"),
  childFilePath("open_gpt_checkpoint_actions_menu", "selectors.ts"),
  childFilePath("open_gpt_fork_destination_menu", "observation.ts"),
  childFilePath("open_gpt_fork_destination_menu", "menu-state.ts"),
  childFilePath("open_gpt_fork_destination_menu", "selectors.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "observation.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "menu-state.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "selectors.ts"),
] as const;
const SUBMISSION_HANDLER_PATH = childHandlerPath("write_exact_gpt_prompt");
const SUBMISSION_PATHS = [
  SUBMISSION_HANDLER_PATH,
  childHandlerPath("reconcile_gpt_draft"),
  childHandlerPath("submit_exact_gpt_turn_once"),
  childHandlerPath("reconcile_gpt_turn_submission"),
  childFilePath("write_exact_gpt_prompt", "observation.ts"),
  childFilePath("write_exact_gpt_prompt", "selectors.ts"),
  childFilePath("reconcile_gpt_draft", "observation.ts"),
  childFilePath("reconcile_gpt_draft", "selectors.ts"),
  childFilePath("submit_exact_gpt_turn_once", "observation.ts"),
  childFilePath("submit_exact_gpt_turn_once", "selectors.ts"),
  childFilePath("reconcile_gpt_turn_submission", "observation.ts"),
  childFilePath("reconcile_gpt_turn_submission", "selectors.ts"),
] as const;
const PAGE_SELECTORS_PATHS = [
  childFilePath("open_gpt_checkpoint_actions_menu", "selectors.ts"),
  childFilePath("open_gpt_fork_destination_menu", "selectors.ts"),
  childFilePath("fork_exact_gpt_conversation_at_checkpoint", "selectors.ts"),
] as const;
const PAGE_SELECTORS_PATH = PAGE_SELECTORS_PATHS[0];
const RESPONSE_PAGE_PATH = childFilePath("wait_for_stable_gpt_text", "page-observation.ts");
const EXACT_ASSISTANT_PATH = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";
const COHERENT_OBSERVATION_PATH = "src/lib/browser/chrome-extension/dom-coherent-observation.ts";
const SEMANTIC_TEXT_PATH = "src/lib/browser/chrome-extension/dom-semantic-text.ts";
const BAZI_FORK_CONSUMERS = [
  "src/plugins/bazi-ai-full-analysis/flow.ts",
  "src/plugins/bazi-chart-interpretation/flow.ts",
] as const;

type FindingFactory = (checkId: string, filePath: string, message: string) => InspectorFinding;
type ImplementedFile = readonly [string, string, readonly string[]];

const sourceText = (context: InspectorContext, path: string): string =>
  context.project.getSourceFile(resolve(context.sealedRoot, path))?.getFullText() ?? "";

const sourceTexts = (context: InspectorContext, paths: readonly string[]): string =>
  paths.map((path) => sourceText(context, path)).join("\n");

const inspectImplementedFiles = (
  files: readonly ImplementedFile[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  for (const [path, source, requiredTokens] of files) {
    for (const required of ["requireBrowser(context)", "requireExactInputKeys", ...requiredTokens]) {
      if (!source.includes(required)) findings.push(finding(
        "gpt/browser-handoff-implemented", path,
        `Production page Child slice is missing ${required}.`,
      ));
    }
    for (const retired of [
      "GPT_BROWSER_COHERENT_PAGE_HANDOFF_REQUIRED",
      "GPT_BROWSER_COHERENT_SEMANTIC_HANDOFF_REQUIRED",
    ]) if (source.includes(retired)) findings.push(finding(
      "gpt/placeholder-handoff-retired", path,
      `Production page Child slice retains retired placeholder ${retired}.`,
    ));
  }
};

const inspectComposerHashes = (
  sources: readonly (readonly [string, string])[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  for (const [path, source] of sources) {
    if (/queryId:\s*"composer"[\s\S]{0,180}fields:\s*\[[^\]]*"semanticTextHash"/u.test(source)) {
      findings.push(finding(
        "gpt/composer-semantic-fallback-forbidden", path,
        "Composer current-value decisions must consume exactEditableTextHash, never rendered semanticTextHash.",
      ));
    }
  }
};

const inspectUserTurnHashes = (
  sources: readonly (readonly [string, string])[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  for (const [path, source] of sources) {
    if (!source.includes('queryId: "user-turns"') || !source.includes("exactGptUserPromptHash")) {
      findings.push(finding(
        "gpt/exact-user-prompt-hash-required", path,
        "Every GPT user-turn identity reader must consume exactGptUserPromptHash.",
      ));
    }
    if (/queryId:\s*"user-turns"[\s\S]{0,180}fields:\s*\[[^\]]*"semanticTextHash"/u.test(source)) {
      findings.push(finding(
        "gpt/outer-user-turn-semantic-hash-forbidden", path,
        "A whole user-turn semantic hash includes attachments and controls and cannot identify the Prompt.",
      ));
    }
  }
};

export const inspectProviderWaitContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const textResponse = sourceTexts(context, TEXT_RESPONSE_PATHS);
  const imageResponse = sourceTexts(context, IMAGE_RESPONSE_PATHS);
  const conversation = sourceTexts(context, CONVERSATION_PATHS);
  const submission = sourceTexts(context, SUBMISSION_PATHS);
  const pageSelectors = sourceTexts(context, PAGE_SELECTORS_PATHS);
  inspectImplementedFiles([
    [CONVERSATION_HANDLER_PATH, conversation, [
      "prepare_clean_gpt_chat", "focus_exact_gpt_conversation", "verify_gpt_conversation_identity",
      "open_gpt_checkpoint_actions_menu", "open_gpt_fork_destination_menu",
      "fork_exact_gpt_conversation_at_checkpoint", "GPT_OPEN_FORK_ACTION_TEXT",
      "GPT_FORK_TO_NEW_CHAT_TEXT", "postClickTargetTransition", "gpt-fork-successor",
      "readCoherentObservation", "readExactAssistantTurn", "exactEditableTextHash", "exactGptUserPromptHash",
    ]],
    [SUBMISSION_HANDLER_PATH, submission, [
      "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
      "reconcile_gpt_turn_submission", "readCoherentObservation", "exactEditableTextHash",
      "exactGptUserPromptHash", "GPT_COMPOSER_FORM_SELECTOR",
      "scope: { selector: GPT_COMPOSER_FORM_SELECTOR }", "exactAttachmentSet",
      'phase: "precondition" | "postcondition"', 'readDraftState(browser, "precondition")',
    ]],
    [TEXT_RESPONSE_HANDLER_PATH, textResponse, [
      "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
      "readExactAssistantTurn", "ensureResponseConversation", "Date.now() >= deadline",
    ]],
    [IMAGE_RESPONSE_HANDLER_PATH, imageResponse, [
      "wait_for_stable_gpt_image", "checkpoint_gpt_generated_image",
      "downloadAuthenticatedMedia", "ensureResponseConversation", "Date.now() >= deadline",
    ]],
  ], findings, finding);
  for (const [path, source] of [
    [TEXT_RESPONSE_HANDLER_PATH, textResponse], [IMAGE_RESPONSE_HANDLER_PATH, imageResponse],
  ] as const) if (source.includes("overdueRecoveryProbe")) findings.push(finding(
    "gpt/stability-overdue-shortcut-retired", path,
    "An expired deadline must fail before page observation and cannot make one sample stable.",
  ));
  for (const retired of ["GPT_FORK_ACTION_SELECTOR", "branch-conversation-button", "postClickUrl:"]) {
    if (conversation.includes(retired)) findings.push(finding(
      "gpt/fork-two-menu-contract", CONVERSATION_HANDLER_PATH,
      `The retired one-menu fork path remains reachable through ${retired}.`,
    ));
  }
  for (const required of [
    'GPT_MORE_ACTIONS_BUTTON_LABEL = "更多操作"',
    "gptMoreActionsButtonSelector",
    "button[aria-label='${GPT_MORE_ACTIONS_BUTTON_LABEL}'][aria-haspopup='menu']",
  ]) if (!pageSelectors.includes(required)) findings.push(finding(
    "gpt/checkpoint-more-actions-selector", PAGE_SELECTORS_PATH,
    `The source-turn More actions selector is missing ${required}.`,
  ));
  if (pageSelectors.includes("more-turn-action-button")) findings.push(finding(
    "gpt/checkpoint-more-actions-selector", PAGE_SELECTORS_PATH,
    "The retired data-testid More actions selector must not remain as a fallback or second entry.",
  ));
  const semanticText = sourceText(context, SEMANTIC_TEXT_PATH);
  const exactAssistant = sourceText(context, EXACT_ASSISTANT_PATH);
  const coherentObservation = sourceText(context, COHERENT_OBSERVATION_PATH);
  for (const [path, source] of [
    [SEMANTIC_TEXT_PATH, semanticText], [EXACT_ASSISTANT_PATH, exactAssistant],
    [COHERENT_OBSERVATION_PATH, coherentObservation],
  ] as const) for (const required of path === SEMANTIC_TEXT_PATH
    ? ["browserCanonicalSemanticText", "insidePre", 'name === "CODE"', "value.endsWith"]
    : ["BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE", "browserCanonicalSemanticText"]) {
    if (!source.includes(required)) findings.push(finding(
      "gpt/one-semantic-text-serializer", path,
      `Exact and coherent answer identity must use the one whole-tree serializer; missing ${required}.`,
    ));
  }
  if (exactAssistant.includes("codes.length === 1") || exactAssistant.includes("codeBlocks(node)")) {
    findings.push(finding(
      "gpt/rich-answer-code-block-shortcut-retired", EXACT_ASSISTANT_PATH,
      "A single code block must not replace the surrounding rich assistant answer.",
    ));
  }
  for (const path of BAZI_FORK_CONSUMERS) {
    const product = sourceText(context, path);
    const first = product.indexOf('child: "open_gpt_checkpoint_actions_menu"');
    const second = product.indexOf('child: "open_gpt_fork_destination_menu"');
    const third = product.indexOf('child: "fork_exact_gpt_conversation_at_checkpoint"');
    if (first < 0 || second <= first || third < 0 || second >= product.indexOf("const fork =", second)) {
      findings.push(finding(
        "gpt/product-explicit-three-step-fork", path,
        "Every production fork consumer must explicitly run checkpoint menu, destination menu, then the one final fork.",
      ));
    }
  }
  inspectComposerHashes([
    [CONVERSATION_HANDLER_PATH, conversation], [SUBMISSION_HANDLER_PATH, submission],
  ], findings, finding);
  inspectUserTurnHashes([
    [CONVERSATION_HANDLER_PATH, conversation], [SUBMISSION_HANDLER_PATH, submission],
    [RESPONSE_PAGE_PATH, sourceText(context, RESPONSE_PAGE_PATH)],
  ], findings, finding);
};
