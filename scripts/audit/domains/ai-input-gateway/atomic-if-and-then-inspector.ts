import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

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

const inspectExactChoiceTransaction = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const profile = requireSourceFile(context, findings, lawId, P.sessionControl.gptExecutionProfilePath);
  if (!profile) return;
  const exactChoiceIsAtomic = exactChoiceTransactionIsAtomic(profile);
  const straightLineProfile = profileAdvancesWithoutBacktracking(profile);
  const waitCalls = profile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression()) === "input.browser.wait");
  const waitOwner = waitCalls[0]?.getFirstAncestor((node) =>
    Node.isVariableDeclaration(node) && node.getName() === "waitForProfileEvidence");
  const actionBoundObservation = waitOwner
    ? waitOwner.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === "PROFILE_ACTION_OBSERVATION_TIMEOUT_MS")
      && !waitOwner.getText().includes("Date.now() + input.request.timeoutMs")
    : false;
  const openProfile = profile.getVariableDeclaration("openAdvancedProfileMenu")?.getInitializer();
  const triggerActionResolvesItsMenuState = Boolean(openProfile
    && openProfile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      if (astExpressionPath(call.getExpression()) !== "clickAndProve") return false;
      const intent = call.getArguments()[0];
      if (!Node.isObjectLiteralExpression(intent)) return false;
      const selector = intent.getProperty("selector");
      return Node.isPropertyAssignment(selector)
        && astExpressionPath(selector.getInitializer()) === "PROFILE_TRIGGER_SELECTOR"
        && intent.getDescendantsOfKind(SyntaxKind.CallExpression).some(
          (nested) => astExpressionPath(nested.getExpression()) === "readAdvancedProfileState",
        );
    }));
  if (exactChoiceIsAtomic && straightLineProfile && waitCalls.length === 1 && waitOwner
    && actionBoundObservation && triggerActionResolvesItsMenuState) return;
  pushFinding(findings, lawId, P.sessionControl.gptExecutionProfilePath,
    "ai-input-gateway/atomic-if-and-then",
    "GPT execution-profile must advance in one straight line: read the current model, select it only when needed, prove it, then read reasoning and select it only when needed. It may not pre-observe future controls, backtrack for whole-profile rechecks, or let a task-wide timeout span the chain.");
};

const stringPropertyEquals = (
  object: ObjectLiteralExpression,
  name: string,
  expected: string,
): boolean => {
  const property = object.getProperty(name);
  if (!Node.isPropertyAssignment(property)) return false;
  const initializer = property.getInitializer();
  return Node.isStringLiteral(initializer) && initializer.getLiteralValue() === expected;
};

const hasFailureComparison = (
  condition: Node,
  leftPath: string,
  rightKind: SyntaxKind.NumericLiteral | SyntaxKind.TrueKeyword,
  rightValue?: number,
): boolean => condition.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binary) => {
  const right = binary.getRight();
  if (astExpressionPath(binary.getLeft()) !== leftPath
    || binary.getOperatorToken().getKind() !== SyntaxKind.ExclamationEqualsEqualsToken
    || right.getKind() !== rightKind) return false;
  return rightValue === undefined
    || (Node.isNumericLiteral(right) && right.getLiteralValue() === rightValue);
});

export const exactChoiceTransactionIsAtomic = (profile: SourceFile): boolean => {
  const exactChoice = profile.getVariableDeclaration("clickExactChoiceAndProve")?.getInitializer();
  if (!exactChoice) return false;
  const calls = exactChoice.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression())
      === "input.execution.browser.executeDomIntent");
  if (calls.length !== 1) return false;
  const intent = calls[0]!.getArguments()[0];
  if (!Node.isObjectLiteralExpression(intent)
    || !stringPropertyEquals(intent, "kind", "click")
    || intent.getProperty("expectedText") !== undefined) return false;
  const exactText = intent.getProperty("expectedTextEquals");
  if (!Node.isPropertyAssignment(exactText)
    || astExpressionPath(exactText.getInitializer()) !== "input.expectedValue") return false;
  if (intent.getProperty("postClickAttribute") !== undefined) return false;
  const matchingGuards = exactChoice.getDescendantsOfKind(SyntaxKind.IfStatement)
    .filter((guard) => {
      const condition = guard.getExpression();
      return hasFailureComparison(condition, "result.candidateCount", SyntaxKind.NumericLiteral, 1)
        && hasFailureComparison(condition, "result.mutationCount", SyntaxKind.NumericLiteral, 1)
        && hasFailureComparison(condition, "result.identityRevalidated", SyntaxKind.TrueKeyword);
    });
  const observesOnlyCurrentChoice = exactChoice.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression()) === "waitForProfileEvidence")
    .length === 1
    && exactChoice.getText().includes("PROFILE_TRIGGER_SELECTOR")
    && exactChoice.getText().includes("input.parentLabel === REASONING_LABEL");
  return matchingGuards.length === 1 && observesOnlyCurrentChoice;
};

const profileAdvancesWithoutBacktracking = (profile: SourceFile): boolean => {
  if (profile.getVariableDeclaration("observeSubmenuSelection")) return false;
  const apply = profile.getVariableDeclaration("applyExactExecutionProfile")?.getInitializer();
  const select = profile.getVariableDeclaration("selectExactProfileValue")?.getInitializer();
  if (!apply || !select) return false;
  const text = apply.getText();
  const modelRead = text.indexOf("readCurrentProfileSummary(input, MODEL_LABEL");
  const modelSelect = text.indexOf("selectExactProfileValue(input, MODEL_LABEL");
  const reasoningRead = text.indexOf("readCurrentProfileSummary(input, REASONING_LABEL");
  const reasoningSelect = text.indexOf("selectExactProfileValue(input, REASONING_LABEL");
  const selectCalls = select.getDescendantsOfKind(SyntaxKind.CallExpression);
  return modelRead >= 0
    && modelSelect > modelRead
    && reasoningRead > modelSelect
    && reasoningSelect > reasoningRead
    && selectCalls.filter((call) => astExpressionPath(call.getExpression()) === "openExactProfileSubmenu").length === 1
    && selectCalls.filter((call) => astExpressionPath(call.getExpression()) === "clickExactChoiceAndProve").length === 1;
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
