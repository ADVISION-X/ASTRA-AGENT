import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const DATABASE_LAW = "LAW-AGENT-PRODUCTION-RUNTIME-005-V32";
const PROOF_LAW = "LAW-AGENT-PRODUCTION-RUNTIME-008-V36";
const ROOT = "src/lib/local-runtime/production";
const PATHS = {
  authority: `${ROOT}/store-authority-reader.ts`, ledger: `${ROOT}/store-ledger.ts`,
  outbox: `${ROOT}/store-outbox.ts`, taskState: `${ROOT}/store-task-state.ts`,
  outboxReceipt: `${ROOT}/store-outbox-receipt.ts`,
  authorityValidation: `${ROOT}/store-authority-validation.ts`,
  runtimeLoops: `${ROOT}/runtime-loops.ts`,
  providerControl: `${ROOT}/provider-rate-limit-control.ts`,
  providerReceipt: `${ROOT}/provider-cooldown-receipt.ts`,
  proofSupport: "scripts/acceptance/agent-production-runtime.real-proof-support.ts",
} as const;
const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));
const callsIn = (node: Node | undefined): Set<string> => new Set(
  node?.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => call.getExpression().getText()) ?? [],
);
const preparedSql = (source: SourceFile | undefined): string =>
  (source?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []).flatMap((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "prepare") return [];
    const argument = call.getArguments()[0];
    return argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
      ? [argument.getLiteralValue()] : [];
  }).join("\n").toLowerCase();
const finding = (
  lawId: string, checkId: string, filePath: string, message: string,
): InspectorFinding => createFinding({
  evidenceMode: "static.ast", lawId, clauseId: `${lawId.toLowerCase()}-requirement`,
  checkId, filePath, message,
});

const outboxBoundaryValid = (
  sql: string, markerCalls: number, marker: string, receiptIdentity: string, validation: string,
): boolean => [!sql.includes("path like"), sql.includes("instr(path,?)>0"), markerCalls >= 1,
  marker.includes("encodeURIComponent(jobId)"),
  receiptIdentity.includes("decodeURIComponent(pathJobId) !== jobId"),
  validation.includes("decodeURIComponent(encoded)")].every(Boolean);

const providerCooldownAuthorityValid = (
  loops: string, provider: string, receipt: string, outbox: string,
): boolean => [loops.includes("state.providerRateLimitControl.canRequestClaimAuthority()"),
  loops.includes("state.providerRateLimitControl.observeWebsiteAuthority"),
  provider.includes("this.store.hasUndeliveredProviderCooldown()"),
  provider.includes("Date.parse(input.serverNow) < Date.parse(latestIncidentServerNow)"),
  provider.includes('this.store.latestProviderCooldownClearance() === "confirmed_absent"'),
  provider.includes('`${incidentRequestId}_not_cleared`'), !provider.includes("Date.now()"),
  !outbox.includes("Date.parse(receipt.cooldown_until) >"),
  outbox.includes("parseLocalProviderCooldownReceipt(local.body_blob, response)"),
  outbox.includes("latestProviderCooldownClearance()"),
  outbox.includes("clearance')='confirmed_absent'"),
  receipt.includes("receiptHash !== hashCanonical(core)")].every(Boolean);

const proofBoundaryValid = (sql: string, prefix: string): boolean => [
  !sql.includes("path like"), sql.includes("instr(path,?)>0"),
  prefix.includes("encodeURIComponent(jobId)"),
].every(Boolean);

export const inspectAgentAuthorityAst = (
  context: InspectorContext,
  findings: InspectorFinding[],
): void => {
  const ledgerCalls = callsIn(sourceFor(context, PATHS.ledger)
    ?.getClass("ProductionRuntimeStore")?.getMethod("assertStartupDataIntegrity"));
  if (!ledgerCalls.has("stateInvariantFailureCount")) {
    findings.push(finding(DATABASE_LAW, "agent-production-runtime/authority-invariant-reader", PATHS.taskState,
      "Runtime startup does not enforce the canonical task and Outbox data invariants."));
  }
  const outbox = sourceFor(context, PATHS.outbox);
  const outboxSql = preparedSql(outbox);
  const marker = outbox?.getVariableDeclaration("jobPathMarker")?.getInitializer();
  const markerCalls = (outbox?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .filter((call) => call.getExpression().getText() === "jobPathMarker").length;
  const receiptIdentity = sourceFor(context, PATHS.outboxReceipt)
    ?.getVariableDeclaration("assertReceiptIdentity")?.getText() ?? "";
  const authorityValidation = sourceFor(context, PATHS.authorityValidation)?.getText() ?? "";
  if (!outboxBoundaryValid(outboxSql, markerCalls, marker?.getText() ?? "",
    receiptIdentity, authorityValidation)) {
    findings.push(finding(DATABASE_LAW, "agent-production-runtime/outbox-job-boundary", PATHS.outbox,
      "Outbox job selection is not bound to one literal encoded path segment."));
  }
  const loopsText = sourceFor(context, PATHS.runtimeLoops)?.getFullText() ?? "";
  const providerText = sourceFor(context, PATHS.providerControl)?.getFullText() ?? "";
  const providerReceiptText = sourceFor(context, PATHS.providerReceipt)?.getFullText() ?? "";
  const outboxText = outbox?.getFullText() ?? "";
  if (!providerCooldownAuthorityValid(loopsText, providerText, providerReceiptText, outboxText)) {
    findings.push(finding(DATABASE_LAW, "agent-production-runtime/provider-cooldown-authority",
      PATHS.providerControl,
      "Provider cooldown must close claim and submit from the durable Outbox, reopen only from later Website server authority, and self-hash-validate live plus hydrated receipts."));
  }
  const proofSupport = sourceFor(context, PATHS.proofSupport);
  const proofSql = preparedSql(proofSupport);
  const proofPrefix = proofSupport?.getVariableDeclaration("sentProductionCheckpointPrefix")?.getInitializer();
  if (!proofBoundaryValid(proofSql, proofPrefix?.getText() ?? "")) {
    findings.push(finding(PROOF_LAW, "agent-production-runtime/proof-outbox-job-boundary", PATHS.proofSupport,
      "Runtime proof checkpoint selection is not bound to one literal encoded job path segment."));
  }
};
