import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { functionCallsIdentifier } from "./inspector-upload-stability-checks.js";
import { hasConstInitializer } from "./inspector-upload-runtime-stability.js";
import type { UploadStabilityFiles } from "./inspector-upload-stability.js";

const hasObservationWindowCountAssertion = (file: SourceFile, expectedCount: number): boolean =>
  file.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.ExclamationEqualsEqualsToken) return false;
    const left = expression.getLeft();
    const right = expression.getRight();
    return Node.isPropertyAccessExpression(left)
      && Node.isIdentifier(left.getExpression())
      && astIdentifierName(left.getExpression()) === "observationStarts"
      && left.getName() === "length"
      && Node.isNumericLiteral(right)
      && Number(right.getLiteralValue()) === expectedCount;
  });

const callsReadSnapshotWithExplicitTimeout = (file: SourceFile): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    const input = call.getArguments()[1];
    if (!Node.isIdentifier(expression) || astIdentifierName(expression) !== "readSnapshot"
      || !input || !Node.isObjectLiteralExpression(input)) return false;
    return input.getProperties().some((property) =>
      Node.isPropertyAssignment(property) && property.getName() === "timeoutMs");
  });

const hasVariableDeclarationNamed = (file: SourceFile, name: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .some((declaration) => declaration.getName() === name);

const countBrowserOpenCalls = (file: SourceFile): number =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "open") return false;
    const owner = expression.getExpression();
    return (Node.isIdentifier(owner) && astIdentifierName(owner) === "browser")
      || (Node.isPropertyAccessExpression(owner) && owner.getName() === "browser");
  }).length;

export const collectOrderRefreshGuardGaps = (files: UploadStabilityFiles): string[] => {
  const missing: string[] = [];
  const orderFile = files.orderFile;
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_READY_TIMEOUT_MS", 2_000)) missing.push("order-detail-timeout-2000");
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_READY_POLL_INTERVAL_MS", 200)) missing.push("order-detail-poll-200");
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT", 8)) missing.push("order-detail-window-limit-8");
  if (!hasVariableDeclarationNamed(orderFile, "windowDeadlineMs")) missing.push("order-detail-window-deadline");
  if (!hasVariableDeclarationNamed(orderFile, "remainingWindowMs")) missing.push("order-detail-window-remaining-wait");
  if (!callsReadSnapshotWithExplicitTimeout(orderFile)) missing.push("order-detail-window-remaining-snapshot-timeout");
  if (!hasObservationWindowCountAssertion(files.smokeAcceptanceFile, 8)) missing.push("order-detail-window8-smoke-assertion");
  if (!hasConstInitializer(files.smokeAcceptanceSupportFile, "ORDER_DETAIL_EIGHTH_WINDOW_SIGNAL_DELAY_MS", 15_000)) missing.push("order-detail-window8-smoke-signal");
  if (!functionCallsIdentifier(orderFile, "openApprovedOrderDetail", "waitForApprovedOrderDetail")) {
    missing.push("order-detail-readiness-wait-call");
  }
  if (countBrowserOpenCalls(orderFile) !== 1) missing.push("single-order-navigation:browser-open-count");
  for (const retiredFunction of ["refreshApprovedOrderDetailIfNeeded", "refreshApprovedOrderDetailOnce", "retryOrderDetailIfNeeded"]) {
    if (orderFile.getFunction(retiredFunction) || orderFile.getVariableDeclaration(retiredFunction)) {
      missing.push(`order-detail-retired-refresh-function:${retiredFunction}`);
    }
  }
  for (const retiredConstant of [
    "ORDER_DETAIL_READY_WAIT_MIN_MS",
    "ORDER_DETAIL_READY_WAIT_MAX_MS",
    "ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MIN_MS",
    "ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MAX_MS",
  ]) {
    if (orderFile.getVariableDeclaration(retiredConstant)) {
      missing.push(`order-detail-retired-refresh-constant:${retiredConstant}`);
    }
  }
  return missing;
};
