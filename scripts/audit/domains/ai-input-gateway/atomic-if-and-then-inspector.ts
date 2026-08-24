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
  const waitCalls = profile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression()) === "input.browser.wait");
  const waitOwner = waitCalls[0]?.getFirstAncestor((node) =>
    Node.isVariableDeclaration(node) && node.getName() === "waitForProfileEvidence");
  if (exactChoiceIsAtomic && waitCalls.length === 1 && waitOwner) return;
  pushFinding(findings, lawId, P.sessionControl.gptExecutionProfilePath,
    "ai-input-gateway/atomic-if-and-then",
    "GPT execution-profile choice must use exact semantic equality plus a same-command postcondition; timeout may only stop a state-driven observation loop.");
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
  const postcondition = intent.getProperty("postClickAttribute");
  const postconditionObject = Node.isPropertyAssignment(postcondition)
    ? postcondition.getInitializer() : undefined;
  if (!Node.isObjectLiteralExpression(postconditionObject)
    || !stringPropertyEquals(postconditionObject, "name", "aria-checked")
    || !stringPropertyEquals(postconditionObject, "equals", "true")) return false;
  const matchingGuards = exactChoice.getDescendantsOfKind(SyntaxKind.IfStatement)
    .filter((guard) => {
      const condition = guard.getExpression();
      return hasFailureComparison(condition, "result.candidateCount", SyntaxKind.NumericLiteral, 1)
        && hasFailureComparison(condition, "result.mutationCount", SyntaxKind.NumericLiteral, 1)
        && hasFailureComparison(condition, "result.identityRevalidated", SyntaxKind.TrueKeyword)
        && hasFailureComparison(condition, "result.postconditionVerified", SyntaxKind.TrueKeyword);
    });
  return matchingGuards.length === 1;
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
