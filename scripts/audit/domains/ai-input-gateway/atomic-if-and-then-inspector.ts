import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath } from "../../shared/ast-node-identity.js";
import type { InspectorContext } from "../../shared/inspector-contracts.js";
import {
  type AiInputGatewayFinding as Finding,
  identifiers,
  propertyNames,
  pushAiInputGatewayFinding as pushFinding,
  requireAiInputGatewaySource as requireSourceFile,
  stringLiterals,
} from "./inspector-helpers.js";
import * as P from "./paths.js";

export const exactChoiceTransactionIsAtomic = (profile: SourceFile): boolean => {
  const mutation = profile.getVariableDeclaration("runAtomicProfileMutation")?.getInitializer();
  const select = profile.getVariableDeclaration("selectExactProfileValue")?.getInitializer();
  const menuClosed = profile.getVariableDeclaration("readProfileMenuClosed")?.getInitializer();
  const summary = profile.getVariableDeclaration("readProfileSummary")?.getInitializer();
  if (!mutation || !select || !menuClosed || !summary) return false;

  const executeCalls = mutation.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression())
      === "input.execution.browser.executeDomIntent");
  const executeIntent = executeCalls[0]?.getArguments()[0];
  if (executeCalls.length !== 1
    || !Node.isObjectLiteralExpression(executeIntent)
    || !executeIntent.getText().includes('kind: "click"')
    || executeIntent.getProperty("postClickAttribute") !== undefined) return false;

  const mutationText = mutation.getText();
  const observeIndex = mutationText.indexOf("input.observePostcondition");
  const proofIndex = mutationText.indexOf("recordWebChatPageAction");
  const unknownIsReadOnlyAdjudicated = mutationText.includes("isOutcomeUnknown(error)")
    && observeIndex >= 0
    && proofIndex > observeIndex
    && !mutationText.includes("while (")
    && !mutationText.includes("for (");

  const exactChoiceCalls = select.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression()) === "runAtomicProfileMutation");
  const exactChoice = exactChoiceCalls[0]?.getArguments()[0];
  const exactChoiceText = exactChoice?.getText() ?? "";
  const exactChoiceUsesMenuClosure = exactChoiceCalls.length === 1
    && exactChoiceText.includes("selector: PROFILE_CHOICE_SELECTOR")
    && exactChoiceText.includes("expectedText: { equals: expectedValue }")
    && exactChoiceText.includes("readProfileMenuClosed")
    && !exactChoiceText.includes("readCollapsedProfileState");

  const menuClosureIsOnlyClickCompletion = menuClosed.getText().includes('"aria-expanded"')
    && menuClosed.getText().includes('expanded === "false"')
    && menuClosed.getText().includes('expanded === "true"')
    && !menuClosed.getText().includes("modelDisplayName")
    && !menuClosed.getText().includes("reasoningUiLabel");
  const exactParentSummary = summary.getText().includes("PROFILE_SUBMENU_SELECTOR")
    && summary.getText().includes('equals: `${parentLabel}${expectedValue}`')
    && summary.getText().includes("parentCount !== 1")
    && summary.getText().includes("expectedCount > 1");

  return unknownIsReadOnlyAdjudicated
    && exactChoiceUsesMenuClosure
    && menuClosureIsOnlyClickCompletion
    && exactParentSummary;
};

const profileAdvancesWithoutBacktracking = (profile: SourceFile): boolean => {
  if (profile.getVariableDeclaration("observeSubmenuSelection")
    || profile.getVariableDeclaration("clickExactChoiceAndProve")
    || profile.getVariableDeclaration("clickAndProve")) return false;
  const apply = profile.getVariableDeclaration("applyExactExecutionProfile")?.getInitializer();
  const select = profile.getVariableDeclaration("selectExactProfileValue")?.getInitializer();
  if (!apply || !select) return false;
  const text = apply.getText();
  const occurrenceIndexes = (needle: string): number[] => {
    const indexes: number[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const index = text.indexOf(needle, cursor);
      if (index < 0) break;
      indexes.push(index);
      cursor = index + needle.length;
    }
    return indexes;
  };
  const modelReads = occurrenceIndexes("readCurrentProfileSummary(input, MODEL_LABEL");
  const reasoningReads = occurrenceIndexes("readCurrentProfileSummary(input, REASONING_LABEL");
  const modelSelect = text.indexOf("selectExactProfileValue(input, MODEL_LABEL");
  const reasoningSelect = text.indexOf("selectExactProfileValue(input, REASONING_LABEL");
  const terminalMenuOpen = text.lastIndexOf("openAdvancedProfileMenu(input)");
  const immediateModelMismatch = text.indexOf(
    'throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH")',
    modelReads[1],
  );
  const selectCalls = select.getDescendantsOfKind(SyntaxKind.CallExpression);
  return modelReads.length === 3
    && reasoningReads.length === 2
    && modelReads[0]! >= 0
    && modelSelect > modelReads[0]!
    && modelReads[1]! > modelSelect
    && immediateModelMismatch > modelReads[1]!
    && reasoningReads[0]! > immediateModelMismatch
    && reasoningSelect > reasoningReads[0]!
    && terminalMenuOpen > reasoningSelect
    && modelReads[2]! > terminalMenuOpen
    && reasoningReads[1]! > modelReads[2]!
    && selectCalls.filter((call) => astExpressionPath(call.getExpression()) === "openExactProfileSubmenu").length === 1
    && selectCalls.filter((call) => astExpressionPath(call.getExpression()) === "runAtomicProfileMutation").length === 1;
};

const inspectExactChoiceTransaction = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const profile = requireSourceFile(context, findings, lawId, P.sessionControl.gptExecutionProfilePath);
  if (!profile) return;
  const waitCalls = profile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression()) === "input.browser.wait");
  const waitOwner = waitCalls[0]?.getFirstAncestor((node) =>
    Node.isVariableDeclaration(node) && node.getName() === "waitForProfileEvidence");
  const actionBoundObservation = waitOwner
    ? waitOwner.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === "PROFILE_ACTION_OBSERVATION_TIMEOUT_MS")
      && !waitOwner.getText().includes("input.request.timeoutMs")
    : false;
  const openProfile = profile.getVariableDeclaration("openAdvancedProfileMenu")?.getInitializer();
  const uniqueTrigger = profile.getVariableDeclaration("readUniqueProfileTrigger")?.getInitializer();
  const triggerWaitsBeforeRead = Boolean(openProfile
    && uniqueTrigger
    && uniqueTrigger.getText().includes("triggerCount > 1")
    && uniqueTrigger.getText().includes("triggerCount === 1 ? true : null")
    && openProfile.getText().indexOf("readUniqueProfileTrigger")
      < openProfile.getText().indexOf('readAttribute(input.browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded")'));
  const triggerActionResolvesItsMenuState = Boolean(openProfile
    && openProfile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      if (astExpressionPath(call.getExpression()) !== "runAtomicProfileMutation") return false;
      const intent = call.getArguments()[0];
      if (!Node.isObjectLiteralExpression(intent)) return false;
      const selector = intent.getProperty("selector");
      return Node.isPropertyAssignment(selector)
        && astExpressionPath(selector.getInitializer()) === "PROFILE_TRIGGER_SELECTOR"
        && intent.getDescendantsOfKind(SyntaxKind.CallExpression).some(
          (nested) => astExpressionPath(nested.getExpression()) === "readAdvancedProfileState",
        );
    }));
  if (exactChoiceTransactionIsAtomic(profile)
    && profileAdvancesWithoutBacktracking(profile)
    && waitCalls.length === 1
    && waitOwner
    && actionBoundObservation
    && triggerWaitsBeforeRead
    && triggerActionResolvesItsMenuState) return;
  pushFinding(findings, lawId, P.sessionControl.gptExecutionProfilePath,
    "ai-input-gateway/atomic-if-and-then",
    "GPT execution-profile must advance in one straight line and treat every physical click as one indivisible transaction. A sent UNKNOWN may be resolved only by that click's exact read-only postcondition and must never be replayed before the next IF.");
};

const inspectCanonicalRouteTransaction = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const routing = requireSourceFile(context, findings, lawId, P.runtime.singleTabRoutingPath);
  if (!routing) return;
  const fn = routing.getVariableDeclaration("focusChatGptConversationByCanonicalPath")?.getInitializer();
  const calls = routing.getDescendantsOfKind(SyntaxKind.CallExpression);
  const clickCount = calls.filter((call) => astExpressionPath(call.getExpression()) === "clickOne").length;
  const names = propertyNames(routing);
  if (fn && clickCount === 1 && names.has("actionId")
    && stringLiterals(routing).has("switch_exact_conversation")
    && identifiers(routing).has("currentPath")) return;
  pushFinding(findings, lawId, P.runtime.singleTabRoutingPath,
    "ai-input-gateway/atomic-if-and-then",
    "Conversation routing must observe the current canonical identity first, click at most once, and record URL plus marker proof before the next action.");
};

const inspectMutationProofLedger = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const paths = [
    P.runtime.submitPath,
    "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
    P.sessionControl.conversationTitlePath,
    P.sessionControl.conversationDiscoveryPath,
  ] as const;
  const sources = paths.map((path) => requireSourceFile(context, findings, lawId, path));
  if (sources.some((source) => !source)) return;
  const values = new Set(sources.flatMap((source) => [...stringLiterals(source!)]));
  for (const actionId of [
    "focus_exact_composer",
    "write_exact_prompt",
    "submit_exact_turn",
    "rename_exact_conversation",
    "discover_conversation_via_search",
  ]) {
    if (values.has(actionId)) continue;
    pushFinding(findings, lawId, P.runtime.submitPath,
      "ai-input-gateway/atomic-if-and-then",
      `Atomic web-chat mutation ${actionId} must retain its own terminal page-action proof.`);
  }
};

export const inspectAtomicIfAndThenActions = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  inspectExactChoiceTransaction(context, findings, lawId);
  inspectCanonicalRouteTransaction(context, findings, lawId);
  inspectMutationProofLedger(context, findings, lawId);
};
