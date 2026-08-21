import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import {
  type AiInputGatewayFinding,
  identifiers,
  pushAiInputGatewayFinding,
  requireAiInputGatewaySource,
  stringLiterals,
} from "./inspector-helpers.js";
import * as P from "./paths.js";

interface FreshIdentitySources {
  canonicalBinding: SourceFile;
  managedExecution: SourceFile;
  freshConversationControl: SourceFile;
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
  const freshConversationControl = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.freshConversationControlPath,
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
  if (!canonicalBinding || !managedExecution || !freshConversationControl
    || !checkpoint || !acceptance || !shared) return null;
  return {
    canonicalBinding,
    managedExecution,
    freshConversationControl,
    checkpoint,
    acceptance,
    shared,
  };
};

const literalContains = (source: SourceFile, value: string): boolean =>
  [...stringLiterals(source)].some((literal) => literal.includes(value));

const hasPropertyAssignmentPath = (
  source: SourceFile,
  propertyName: string,
  expressionPath: string,
): boolean => source.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
  property.getName() === propertyName
  && astExpressionPath(property.getInitializer()) === expressionPath);

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
  const freshIds = identifiers(sources.freshConversationControl);
  const checkpointIds = identifiers(sources.checkpoint);
  return identifiers(sources.canonicalBinding).has("assertWebChatCanonicalConversationBinding")
    && identifiers(sources.canonicalBinding).has("resolveSubmittedDraftOwnerByTurnMarker")
    && identifiers(sources.managedExecution).has("assertBinding")
    && hasPropertyAssignmentPath(sources.managedExecution, "request", "input.request")
    && identifiers(sources.acceptance).has("assertCanonicalConversationOwnership")
    && identifiers(sources.acceptance)
      .has("assertSubmittedDraftOwnershipRequiresOneCanonicalOwner")
    && freshIds.has("isExactFreshChatGptRoot")
    && freshIds.has("startFreshChatGptConversation")
    && literalContains(sources.freshConversationControl, "#upload-files")
    && literalContains(sources.freshConversationControl, "pasted content")
    && literalContains(sources.freshConversationControl, "停止生成")
    && freshIds.has("removeAttachmentCount")
    && sharedPreparationCallOrderIsValid(sources.shared)
    && checkpointIds.has("observeSubmittedWebChatTurn")
    && checkpointIds.has("finalizeObservedWebChatSubmission");
};

export const inspectFreshConversationIdentity = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const sources = loadFreshIdentitySources(context, findings, lawId);
  if (!sources || freshIdentityCoreIsValid(sources)) return;
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
    schema: requireAiInputGatewaySource(
      context, findings, lawId, P.attachment.schemaPath,
    ),
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
  const schemaIds = identifiers(s.schema);
  const profileIds = identifiers(s.profile);
  const gptProfileIds = identifiers(s.gptProfile);
  const titlePolicyIds = identifiers(s.titlePolicy);
  const titleIds = identifiers(s.title);
  const discoveryIds = identifiers(s.discovery);
  const routingIds = identifiers(s.routing);
  const executionIds = identifiers(s.executionState);
  const checkpointIds = identifiers(s.checkpoint);

  const required = [
    literalContains(s.schema, "gpt-web-execution-profile.v1"),
    literalContains(s.schema, "extra_high"),
    literalContains(s.schema, "pro_standard"),
    literalContains(s.schema, "pro_extended"),
    schemaIds.has("buildGptWebProviderExecutionProfile"),
    profileIds.has("governProductionGptExecutionProfileInput"),
    gptProfileIds.has("enforceGptWebExecutionProfile"),
    gptProfileIds.has("assertStableWebChatDocument"),
    !gptProfileIds.has("reasoningSliderIndex"),
    !literalContains(s.gptProfile, "data-model-reasoning-effort-slider"),
    identifiers(s.session).has("prepareWebChatSessionForSubmission"),
    identifiers(s.session).has("finalizeWebChatSessionAfterResult"),
    identifiers(s.pageAction).has("recordWebChatPageAction"),
    literalContains(s.titlePolicy, "Asia/Dubai"),
    literalContains(s.titlePolicy, "gpt-web-title-policy.v1"),
    !titlePolicyIds.has("textPrompt"),
    titleIds.has("finalizeGptWebConversationTitle"),
    titleIds.has("runExclusivePatrol"),
    literalContains(s.title, "[data-testid^='conversation-turn-'][data-turn='user']"),
    titleIds.has("canonicalConversationUrl"),
    discoveryIds.has("turnMarker"),
    discoveryIds.has("targetPath"),
    literalContains(s.discovery, "Search chats"),
    !routingIds.has("expectedTitle"),
    !routingIds.has("systemChatTitle"),
    literalContains(s.executionState, "web-chat-execution-v3"),
    executionIds.has("providerExecutionProfileBinding"),
    executionIds.has("conversationTitle"),
    executionIds.has("pageActionLedger"),
    literalContains(s.executionState, "title_finalization_pending"),
    checkpointIds.has("providerExecutionProfileProof"),
    literalContains(s.proof, "AI_INPUT_GATEWAY_CONVERSATION_TITLE_PROOF_MISSING"),
    literalContains(s.proof, "AI_INPUT_GATEWAY_PROVIDER_EXECUTION_PROFILE_PROOF_MISMATCH"),
    identifiers(s.sessionAcceptance).has("assertGptWebSessionControllerContracts"),
    identifiers(s.sessionAcceptance).has("assertPrivacySafeTitle"),
    identifiers(s.sessionAcceptance).has("assertContinuationDoesNotFakeLegacyTitleProof"),
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
    identifiers(routing).has("turnMarker"),
    identifiers(acceptance).has("assertCanonicalConversationOwnership"),
    identifiers(acceptance).has("assertSubmittedDraftOwnershipRequiresOneCanonicalOwner"),
    !identifiers(routing).has("expectedTitle"),
    !identifiers(routing).has("systemChatTitle"),
    literalContains(executionState, "web-chat-execution-v3"),
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
