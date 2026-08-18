import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type {
  InspectorContext,
} from "../../shared/inspector-contracts.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import {
  type AiInputGatewayFinding,
  identifiers,
  pushAiInputGatewayFinding,
  requireAiInputGatewaySource,
  stringLiterals,
  variableStringValues,
} from "./inspector-helpers.js";
import * as P from "./paths.js";

interface FreshIdentitySources {
  canonicalBinding: SourceFile;
  managedExecution: SourceFile;
  freshConversation: SourceFile;
  freshConversationControl: SourceFile;
  pageActionScripts: SourceFile;
  promptEvaluation: SourceFile;
  checkpoint: SourceFile;
  acceptance: SourceFile;
  shared: SourceFile;
}

const loadFreshIdentitySources = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
): FreshIdentitySources | null => {
  const canonicalBinding = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.canonicalBindingPath,
  );
  const managedExecution = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.managedExecutionPath,
  );
  const freshConversation = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.freshConversationPath,
  );
  const freshConversationControl = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.freshConversationControlPath,
  );
  const pageActionScripts = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.pageActionScriptsPath,
  );
  const promptEvaluation = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.answerEvaluationPath,
  );
  const checkpoint = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.submissionCheckpointPath,
  );
  const acceptance = requireAiInputGatewaySource(
    context, findings, lawId, P.acceptance.identityRecoveryAcceptancePath,
  );
  const shared = requireAiInputGatewaySource(
    context, findings, lawId, P.attachment.sharedPath,
  );
  if (
    !canonicalBinding
    || !managedExecution
    || !freshConversation
    || !freshConversationControl
    || !pageActionScripts
    || !promptEvaluation
    || !checkpoint
    || !acceptance
    || !shared
  ) return null;
  return {
    canonicalBinding,
    managedExecution,
    freshConversation,
    freshConversationControl,
    pageActionScripts,
    promptEvaluation,
    checkpoint,
    acceptance,
    shared,
  };
};

const literalContains = (source: SourceFile, value: string): boolean =>
  [...stringLiterals(source)].some((literal) => literal.includes(value));

const sharedPreparationCallOrderIsValid = (source: SourceFile): boolean => {
  const initializers = ["prepareWebChatConversation", "prepareWebChatAttachments"]
    .map((name) => source.getVariableDeclaration(name)?.getInitializer())
    .filter((initializer): initializer is NonNullable<typeof initializer> => Boolean(initializer));
  const calls = initializers.flatMap((initializer) => initializer
    .getDescendantsOfKind(SyntaxKind.CallExpression));
  const position = (name: string): number | null => calls
    .find((call) => {
      const expression = call.getExpression();
      return Node.isIdentifier(expression)
        && astIdentifierName(expression) === name;
    })?.getStart() ?? null;
  const preSubmit = position("readPreSubmitConversationState");
  const attachment = position("attachApprovedWebChatFilesOnce");
  return preSubmit !== null
    && attachment !== null
    && preSubmit < attachment;
};

const freshIdentityCoreIsValid = (
  sources: FreshIdentitySources,
): boolean => {
  const zeroFields = variableStringValues(
    sources.freshConversation,
    "CHATGPT_FRESH_ZERO_STATE_FIELDS",
  );
  const promptHasRequiredIdentity = [
    "promptSuffixBoundToExpectedTurn",
    "WEB_CHAT_FOREIGN_TURN_REBOUND",
    "visibleConversationBusy",
  ].every((value) =>
    sources.promptEvaluation.getFullText().includes(value));
  const checkpointHasRequiredIdentity = [
    "exact_clean_prompt_and_canonical_conversation",
    "observeSubmittedWebChatTurn",
    "finalizeObservedWebChatSubmission",
  ].every((value) =>
    sources.checkpoint.getFullText().includes(value));
  return identifiers(sources.canonicalBinding)
    .has("assertWebChatCanonicalConversationBinding")
    && identifiers(sources.canonicalBinding)
      .has("resolveSubmittedDraftOwnerByTurnMarker")
    && identifiers(sources.managedExecution).has("assertBinding")
    && sources.managedExecution.getFullText().includes("request: input.request")
    && identifiers(sources.acceptance)
      .has("assertCanonicalConversationOwnership")
    && identifiers(sources.acceptance)
      .has("assertSubmittedDraftOwnershipRequiresOneCanonicalOwner")
    && [
      "userCount",
      "assistantCount",
      "composerText.length",
      "removeAttachmentCount",
    ].every((value) => zeroFields.has(value))
    && promptHasRequiredIdentity
    && !literalContains(
      sources.promptEvaluation,
      "Boolean(document.querySelector('[aria-busy=\"true\"]'))",
    )
    && sharedPreparationCallOrderIsValid(sources.shared)
    && checkpointHasRequiredIdentity;
};

const freshIdentityCleanupIsValid = (
  sources: FreshIdentitySources,
): boolean => literalContains(
      sources.freshConversationControl,
      'a[data-testid="create-new-chat-button"][data-sidebar-item="true"]',
    )
    && sources.freshConversationControl.getFullText().includes("hitAnchor")
    && sources.freshConversationControl.getFullText().includes("pointerEvents")
    && !identifiers(sources.freshConversationControl)
      .has("exactAriaCandidates")
    && sources.freshConversationControl.getFullText()
      .includes("clearUniquelyOwnedSubmittedRootDraft")
    && sources.freshConversation.getFullText()
      .includes("eligibleSubmittedDraftCleanup")
    && identifiers(sources.pageActionScripts)
      .has("buildClearProvenSubmittedRootDraftScript")
    && literalContains(
      sources.freshConversationControl,
      "protected unknown or unproven draft",
    )
    && literalContains(
      sources.pageActionScripts,
      "owned stale draft guard changed before clear",
    );

const freshIdentityContractIsValid = (sources: FreshIdentitySources): boolean =>
  freshIdentityCoreIsValid(sources) && freshIdentityCleanupIsValid(sources);

export const inspectFreshConversationIdentity = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const sources = loadFreshIdentitySources(context, findings, lawId);
  if (!sources || freshIdentityContractIsValid(sources)) return;
  pushAiInputGatewayFinding(
    findings,
    lawId,
    P.executionRuntime.executionStatePath,
    "ai-input-gateway/fresh-conversation-identity",
    "Fresh GPT submission must prove a clean zero-turn composer, persist "
    + "one exact logical-turn marker before post-submit inspection, and "
    + "bind an unoccupied canonical conversation before logging success. "
    + "A root draft may be cleared only after one canonical ledger owner "
    + "and the exact guarded marker are both proven; unknown drafts stay intact.",
  );
};

export const inspectCanonicalConversationIdentity = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const executionState = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.executionStatePath,
  );
  const canonicalBinding = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.canonicalBindingPath,
  );
  const routing = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.singleTabRoutingPath,
  );
  const acceptance = requireAiInputGatewaySource(
    context, findings, lawId, P.acceptance.identityRecoveryAcceptancePath,
  );
  if (
    !executionState
    || !canonicalBinding
    || !routing
    || !acceptance
  ) return;
  const contract = [
    identifiers(canonicalBinding).has("assertWebChatCanonicalConversationBinding"),
    identifiers(canonicalBinding).has("resolveSubmittedDraftOwnerByTurnMarker"),
    identifiers(routing).has("focusChatGptConversationByCanonicalPath"),
    identifiers(acceptance).has("assertCanonicalConversationOwnership"),
    identifiers(acceptance)
      .has("assertSubmittedDraftOwnershipRequiresOneCanonicalOwner"),
    !identifiers(executionState).has("buildHumanReadableSystemChatTitle"),
    !identifiers(executionState).has("WebChatTitleRenameState"),
  ].every(Boolean);
  if (!contract) {
    pushAiInputGatewayFinding(
      findings,
      lawId,
      P.executionRuntime.canonicalBindingPath,
      "ai-input-gateway/canonical-conversation-identity",
      "Provider identity must use canonical URL plus exact clean prompt identity and "
      + "must not retain a title generator or rename-debt state.",
    );
  }
};
