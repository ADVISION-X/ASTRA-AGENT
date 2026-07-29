import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type {
  InspectorContext,
} from "../../shared/inspector-contracts.js";
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
  continuationTitle: SourceFile;
  managedExecution: SourceFile;
  freshConversation: SourceFile;
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
  const continuationTitle = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.continuationTitlePath,
  );
  const managedExecution = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.managedExecutionPath,
  );
  const freshConversation = requireAiInputGatewaySource(
    context, findings, lawId, P.runtime.freshConversationPath,
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
    !continuationTitle
    || !managedExecution
    || !freshConversation
    || !promptEvaluation
    || !checkpoint
    || !acceptance
    || !shared
  ) return null;
  return {
    continuationTitle,
    managedExecution,
    freshConversation,
    promptEvaluation,
    checkpoint,
    acceptance,
    shared,
  };
};

const literalContains = (source: SourceFile, value: string): boolean =>
  [...stringLiterals(source)].some((literal) => literal.includes(value));

const sharedPreparationCallOrderIsValid = (source: SourceFile): boolean => {
  const initializer = source
    .getVariableDeclaration("prepareWebChatConversation")
    ?.getInitializer();
  const calls = initializer?.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  ) ?? [];
  const position = (name: string): number | null => calls
    .find((call) => {
      const expression = call.getExpression();
      return Node.isIdentifier(expression)
        && expression.getText() === name;
    })?.getStart() ?? null;
  const preSubmit = position("readPreSubmitConversationState");
  const attachment = position("attachApprovedWebChatFilesOnce");
  return preSubmit !== null
    && attachment !== null
    && preSubmit < attachment;
};

const freshIdentityContractIsValid = (
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
    identifiers(sources.promptEvaluation).has(value)
    || literalContains(sources.promptEvaluation, value));
  const checkpointHasRequiredIdentity = [
    "exact_turn_marker_and_canonical_conversation",
    "observeSubmittedWebChatTurn",
    "finalizeObservedWebChatSubmission",
  ].every((value) =>
    identifiers(sources.checkpoint).has(value)
    || literalContains(sources.checkpoint, value));
  return identifiers(sources.continuationTitle)
    .has("assertWebChatCanonicalConversationBinding")
    && identifiers(sources.managedExecution).has("assertBinding")
    && identifiers(sources.acceptance)
      .has("assertCanonicalConversationOwnership")
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
    + "bind an unoccupied canonical conversation before logging success.",
  );
};

const inspectSystemTitleBuilder = (
  systemTitle: SourceFile,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const values = stringLiterals(systemTitle);
  for (const required of ["SEO资料研究", "AI任务", "｜"]) {
    if (!values.has(required)) {
      pushAiInputGatewayFinding(
        findings,
        lawId,
        P.executionRuntime.systemChatTitlePath,
        "ai-input-gateway/human-readable-system-chat-title",
        `System chat title builder must declare ${required}.`,
      );
    }
  }
  if (
    identifiers(systemTitle).has("textPrompt")
    || [...values].some((literal) => literal.startsWith("GRASSEYE-"))
  ) {
    pushAiInputGatewayFinding(
      findings,
      lawId,
      P.executionRuntime.systemChatTitlePath,
      "ai-input-gateway/human-readable-system-chat-title",
      "System chat titles must not copy prompt text or retain the legacy "
      + "machine-only title prefix.",
    );
  }
};

const inspectTitleAcceptance = (
  acceptance: SourceFile,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const acceptanceIds = identifiers(acceptance);
  for (const required of [
    "buildHumanReadableSystemChatTitle",
    "seoTitle",
    "assertContinuationInheritsParentSystemTitle",
  ]) {
    if (!acceptanceIds.has(required)) {
      pushAiInputGatewayFinding(
        findings,
        lawId,
        P.acceptance.identityRecoveryAcceptancePath,
        "ai-input-gateway/human-readable-system-chat-title",
        `Title acceptance must prove ${required}.`,
      );
    }
  }
  const acceptanceValues = stringLiterals(acceptance);
  for (const required of ["seo_research", "bazi_analysis", "generic_ai"]) {
    if (!acceptanceValues.has(required)) {
      pushAiInputGatewayFinding(
        findings,
        lawId,
        P.acceptance.identityRecoveryAcceptancePath,
        "ai-input-gateway/human-readable-system-chat-title",
        `Title acceptance must cover ${required}.`,
      );
    }
  }
};

export const inspectHumanReadableSystemChatTitle = (
  context: InspectorContext,
  findings: AiInputGatewayFinding[],
  lawId: string,
): void => {
  const executionState = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.executionStatePath,
  );
  const continuationTitle = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.continuationTitlePath,
  );
  const managedStart = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.managedExecutionStartPath,
  );
  const systemTitle = requireAiInputGatewaySource(
    context, findings, lawId, P.executionRuntime.systemChatTitlePath,
  );
  const acceptance = requireAiInputGatewaySource(
    context, findings, lawId, P.acceptance.identityRecoveryAcceptancePath,
  );
  if (
    !executionState
    || !continuationTitle
    || !managedStart
    || !systemTitle
    || !acceptance
  ) return;
  if (!identifiers(executionState).has("buildHumanReadableSystemChatTitle")) {
    pushAiInputGatewayFinding(
      findings,
      lawId,
      P.executionRuntime.executionStatePath,
      "ai-input-gateway/human-readable-system-chat-title",
      "New GPT executions must use the single human-readable system chat "
      + "title builder.",
    );
  }
  inspectSystemTitleBuilder(systemTitle, findings, lawId);
  const continuationContract = [
    identifiers(continuationTitle).has(
      "resolveContinuationWebChatSystemTitle",
    ),
    identifiers(managedStart).has("resolveContinuationWebChatSystemTitle"),
    identifiers(continuationTitle).has("earliestVerifiedTitle"),
    identifiers(continuationTitle).has("verifiedAt"),
  ].every(Boolean);
  if (!continuationContract) {
    pushAiInputGatewayFinding(
      findings,
      lawId,
      P.executionRuntime.managedExecutionStartPath,
      "ai-input-gateway/one-parent-conversation-title",
      "Every continuation turn must inherit one durable title from its exact "
      + "parent conversation, and legacy title pollution must collapse "
      + "deterministically without blocking the user.",
    );
  }
  inspectTitleAcceptance(acceptance, findings, lawId);
};
