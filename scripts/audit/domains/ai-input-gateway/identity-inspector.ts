import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
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
  if (!canonicalBinding || !managedExecution || !freshConversation
    || !freshConversationControl || !pageActionScripts || !promptEvaluation
    || !checkpoint || !acceptance || !shared) return null;
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
  const calls = initializers.flatMap((initializer) =>
    initializer.getDescendantsOfKind(SyntaxKind.CallExpression));
  const position = (name: string): number | null => calls.find((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && astIdentifierName(expression) === name;
  })?.getStart() ?? null;
  const preSubmit = position("readPreSubmitConversationState");
  const attachment = position("attachApprovedWebChatFilesOnce");
  return preSubmit !== null && attachment !== null && preSubmit < attachment;
};

const freshIdentityCoreIsValid = (sources: FreshIdentitySources): boolean => {
  const zeroFields = variableStringValues(
    sources.freshConversation,
    "CHATGPT_FRESH_ZERO_STATE_FIELDS",
  );
  const promptHasRequiredIdentity = [
    "promptSuffixBoundToExpectedTurn",
    "WEB_CHAT_FOREIGN_TURN_REBOUND",
    "visibleConversationBusy",
  ].every((value) => sources.promptEvaluation.getFullText().includes(value));
  const checkpointHasRequiredIdentity = [
    "exact_clean_prompt_and_canonical_conversation",
    "observeSubmittedWebChatTurn",
    "finalizeObservedWebChatSubmission",
  ].every((value) => sources.checkpoint.getFullText().includes(value));
  return identifiers(sources.canonicalBinding).has("assertWebChatCanonicalConversationBinding")
    && identifiers(sources.canonicalBinding).has("resolveSubmittedDraftOwnerByTurnMarker")
    && identifiers(sources.managedExecution).has("assertBinding")
    && sources.managedExecution.getFullText().includes("request: input.request")
    && identifiers(sources.acceptance).has("assertCanonicalConversationOwnership")
    && identifiers(sources.acceptance)
      .has("assertSubmittedDraftOwnershipRequiresOneCanonicalOwner")
    && ["userCount", "assistantCount", "composerText.length", "removeAttachmentCount"]
      .every((value) => zeroFields.has(value))
    && promptHasRequiredIdentity
    && !literalContains(
      sources.promptEvaluation,
      "Boolean(document.querySelector('[aria-busy=\"true\"]'))",
    )
    && sharedPreparationCallOrderIsValid(sources.shared)
    && checkpointHasRequiredIdentity;
};

const freshIdentityCleanupIsValid = (sources: FreshIdentitySources): boolean =>
  literalContains(
    sources.freshConversationControl,
    'a[data-testid="create-new-chat-button"][data-sidebar-item="true"]',
  )
  && sources.freshConversationControl.getFullText().includes("hitAnchor")
  && sources.freshConversationControl.getFullText().includes("pointerEvents")
  && !identifiers(sources.freshConversationControl).has("exactAriaCandidates")
  && sources.freshConversationControl.getFullText()
    .includes("clearUniquelyOwnedSubmittedRootDraft")
  && sources.freshConversation.getFullText().includes("eligibleSubmittedDraftCleanup")
  && identifiers(sources.pageActionScripts).has("buildClearProvenSubmittedRootDraftScript")
  && literalContains(sources.freshConversationControl, "protected unknown or unproven draft")
  && literalContains(sources.pageActionScripts, "owned stale draft guard changed before clear");

export const inspectFreshConversationIdentity = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const sources = loadFreshIdentitySources(context, findings, lawId);
  if (!sources || (freshIdentityCoreIsValid(sources) && freshIdentityCleanupIsValid(sources))) return;
  pushAiInputGatewayFinding(
    findings,
    lawId,
    P.executionRuntime.executionStatePath,
    "ai-input-gateway/fresh-conversation-identity",
    "Fresh GPT submission must prove a clean zero-turn composer, persist one exact "
      + "logical-turn marker before post-submit inspection, and bind an unoccupied "
      + "canonical conversation before logging success. Unknown root drafts stay intact.",
  );
};

const loadSessionControlSources = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
) => {
  const result = {
    profile: requireAiInputGatewaySource(
      context, findings, lawId, P.sessionControl.providerExecutionProfilePath,
    ),
    gptProfile: requireAiInputGatewaySource(
      context, findings, lawId, P.sessionControl.gptExecutionProfilePath,
    ),
    session: requireAiInputGatewaySource(
      context, findings, lawId, P.sessionControl.sessionControllerPath,
    ),
    pageAction: requireAiInputGatewaySource(
      context, findings, lawId, P.sessionControl.pageActionContractPath,
    ),
    titlePolicy: requireAiInputGatewaySource(
      context, findings, lawId, P.sessionControl.conversationTitlePolicyPath,
    ),
    title: requireAiInputGatewaySource(
      context, findings, lawId, P.sessionControl.conversationTitlePath,
    ),
    discovery: requireAiInputGatewaySource(
      context, findings, lawId, P.sessionControl.conversationDiscoveryPath,
    ),
    executionState: requireAiInputGatewaySource(
      context, findings, lawId, P.executionRuntime.executionStatePath,
    ),
    routing: requireAiInputGatewaySource(
      context, findings, lawId, P.runtime.singleTabRoutingPath,
    ),
    checkpoint: requireAiInputGatewaySource(
      context, findings, lawId, P.runtime.checkpointResponsePath,
    ),
    proof: requireAiInputGatewaySource(
      context, findings, lawId, P.runtime.providerProofPath,
    ),
    sessionAcceptance: requireAiInputGatewaySource(
      context, findings, lawId, P.acceptance.sessionControllerAcceptancePath,
    ),
  };
  return Object.values(result).every(Boolean)
    ? result as { [K in keyof typeof result]: SourceFile }
    : null;
};

const inspectSessionControllerContract = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const s = loadSessionControlSources(context, findings, lawId);
  if (!s) return;
  const profileText = s.profile.getFullText();
  const gptProfileText = s.gptProfile.getFullText();
  const titleText = s.title.getFullText();
  const titlePolicyText = s.titlePolicy.getFullText();
  const discoveryText = s.discovery.getFullText();
  const routingText = s.routing.getFullText();
  const executionText = s.executionState.getFullText();
  const checkpointText = s.checkpoint.getFullText();
  const proofText = s.proof.getFullText();

  const required = [
    profileText.includes("gpt-web-execution-profile.v1"),
    profileText.includes("extra_high"),
    profileText.includes("pro_standard"),
    profileText.includes("pro_extended"),
    identifiers(s.profile).has("governProductionGptExecutionProfileInput"),
    identifiers(s.gptProfile).has("enforceGptWebExecutionProfile"),
    identifiers(s.gptProfile).has("assertStableWebChatDocument"),
    !gptProfileText.includes("reasoningSliderIndex"),
    !gptProfileText.includes("data-model-reasoning-effort-slider"),
    identifiers(s.session).has("prepareWebChatSessionForSubmission"),
    identifiers(s.session).has("finalizeWebChatSessionAfterResult"),
    identifiers(s.pageAction).has("recordWebChatPageAction"),
    titlePolicyText.includes("Asia/Dubai"),
    titlePolicyText.includes("gpt-web-title-policy.v1"),
    !titlePolicyText.includes("textPrompt"),
    identifiers(s.title).has("finalizeGptWebConversationTitle"),
    titleText.includes("runExclusivePatrol"),
    titleText.includes("[data-testid^='conversation-turn-'][data-turn='user']"),
    titleText.includes("canonicalConversationUrl"),
    discoveryText.includes("turnMarker"),
    discoveryText.includes("targetPath"),
    discoveryText.includes("Search chats"),
    !routingText.includes("expectedTitle"),
    !routingText.includes("systemChatTitle"),
    executionText.includes('schemaVersion: "web-chat-execution-v3"'),
    executionText.includes("providerExecutionProfileBinding"),
    executionText.includes("conversationTitle"),
    executionText.includes("pageActionLedger"),
    checkpointText.includes("title_finalization_pending"),
    checkpointText.includes("providerExecutionProfileProof"),
    proofText.includes("AI_INPUT_GATEWAY_CONVERSATION_TITLE_PROOF_MISSING"),
    proofText.includes("AI_INPUT_GATEWAY_PROVIDER_EXECUTION_PROFILE_PROOF_MISMATCH"),
    identifiers(s.sessionAcceptance).has("assertGptWebSessionControllerContracts"),
    s.sessionAcceptance.getFullText().includes("assertPrivacySafeTitle"),
    s.sessionAcceptance.getFullText().includes("assertContinuationDoesNotFakeLegacyTitleProof"),
  ].every(Boolean);

  if (!required) {
    pushAiInputGatewayFinding(
      findings,
      lawId,
      P.sessionControl.sessionControllerPath,
      "ai-input-gateway/gpt-web-session-controller",
      "GPT Web must have one Session Controller that hash-binds the semantic model "
        + "profile, records page actions, routes by canonical URL plus marker, and "
        + "finalizes a privacy-safe title only after provider result checkpointing.",
    );
  }
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
  if (!executionState || !canonicalBinding || !routing || !acceptance) return;
  const contract = [
    identifiers(canonicalBinding).has("assertWebChatCanonicalConversationBinding"),
    identifiers(canonicalBinding).has("resolveSubmittedDraftOwnerByTurnMarker"),
    identifiers(routing).has("focusChatGptConversationByCanonicalPath"),
    routing.getFullText().includes("turnMarker"),
    identifiers(acceptance).has("assertCanonicalConversationOwnership"),
    identifiers(acceptance).has("assertSubmittedDraftOwnershipRequiresOneCanonicalOwner"),
    !routing.getFullText().includes("expectedTitle"),
    !routing.getFullText().includes("systemChatTitle"),
    executionState.getFullText().includes("web-chat-execution-v3"),
  ].every(Boolean);
  if (!contract) {
    pushAiInputGatewayFinding(
      findings,
      lawId,
      P.executionRuntime.canonicalBindingPath,
      "ai-input-gateway/canonical-conversation-identity",
      "Durable provider identity must remain canonical URL plus exact logical-turn marker; "
        + "a human-readable title is secondary evidence and may never become routing identity.",
    );
  }
  inspectSessionControllerContract(context, findings, lawId);
};
