import { resolve } from "node:path";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const ROOT = "src/capabilities/gpt";
const TEXT_RESPONSE_HANDLER_PATH = `${ROOT}/web/children/text-response-children.ts`;
const IMAGE_RESPONSE_HANDLER_PATH = `${ROOT}/web/children/image-response-children.ts`;
const CONVERSATION_HANDLER_PATH = `${ROOT}/web/children/conversation-children.ts`;
const SUBMISSION_HANDLER_PATH = `${ROOT}/web/children/composer-submission-children.ts`;
const RESPONSE_PAGE_PATH = `${ROOT}/web/gpt-response-page.ts`;

type FindingFactory = (checkId: string, filePath: string, message: string) => InspectorFinding;
type ImplementedFile = readonly [string, string, readonly string[]];

const sourceText = (context: InspectorContext, path: string): string =>
  context.project.getSourceFile(resolve(context.sealedRoot, path))?.getFullText() ?? "";

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
  const textResponse = sourceText(context, TEXT_RESPONSE_HANDLER_PATH);
  const imageResponse = sourceText(context, IMAGE_RESPONSE_HANDLER_PATH);
  const conversation = sourceText(context, CONVERSATION_HANDLER_PATH);
  const submission = sourceText(context, SUBMISSION_HANDLER_PATH);
  inspectImplementedFiles([
    [CONVERSATION_HANDLER_PATH, conversation, [
      "prepare_clean_gpt_chat", "focus_exact_gpt_conversation", "verify_gpt_conversation_identity",
      "open_gpt_checkpoint_actions_menu", "fork_exact_gpt_conversation_at_checkpoint",
      "readCoherentObservation", "readExactAssistantTurn", "exactEditableTextHash", "exactGptUserPromptHash",
    ]],
    [SUBMISSION_HANDLER_PATH, submission, [
      "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
      "reconcile_gpt_turn_submission", "readCoherentObservation", "exactEditableTextHash",
      "exactGptUserPromptHash", "GPT_COMPOSER_FORM_SELECTOR",
      "scope: { selector: GPT_COMPOSER_FORM_SELECTOR }", "exactAttachmentSet", "includeAttachments: true",
    ]],
    [TEXT_RESPONSE_HANDLER_PATH, textResponse, [
      "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
      "readExactAssistantTurn", "ensureResponseConversation",
    ]],
    [IMAGE_RESPONSE_HANDLER_PATH, imageResponse, [
      "wait_for_stable_gpt_image", "checkpoint_gpt_generated_image",
      "downloadAuthenticatedMedia", "ensureResponseConversation",
    ]],
  ], findings, finding);
  inspectComposerHashes([
    [CONVERSATION_HANDLER_PATH, conversation], [SUBMISSION_HANDLER_PATH, submission],
  ], findings, finding);
  inspectUserTurnHashes([
    [CONVERSATION_HANDLER_PATH, conversation], [SUBMISSION_HANDLER_PATH, submission],
    [RESPONSE_PAGE_PATH, sourceText(context, RESPONSE_PAGE_PATH)],
  ], findings, finding);
};
