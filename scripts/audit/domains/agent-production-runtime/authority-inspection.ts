import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const DATABASE_LAW = "LAW-AGENT-PRODUCTION-RUNTIME-005-V31";
const PROOF_LAW = "LAW-AGENT-PRODUCTION-RUNTIME-008-V35";
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
  if (outboxSql.includes("path like") || !outboxSql.includes("instr(path,?)>0")
    || markerCalls < 1 || !marker?.getText().includes("encodeURIComponent(jobId)")
    || !receiptIdentity.includes("decodeURIComponent(pathJobId) !== jobId")
    || !authorityValidation.includes("decodeURIComponent(encoded)")) {
    findings.push(finding(DATABASE_LAW, "agent-production-runtime/outbox-job-boundary", PATHS.outbox,
      "Outbox job selection is not bound to one literal encoded path segment."));
  }
  const loopsText = sourceFor(context, PATHS.runtimeLoops)?.getFullText() ?? "";
  const providerText = sourceFor(context, PATHS.providerControl)?.getFullText() ?? "";
  const providerReceiptText = sourceFor(context, PATHS.providerReceipt)?.getFullText() ?? "";
  const outboxText = outbox?.getFullText() ?? "";
  if (!loopsText.includes("state.providerRateLimitControl.canRequestClaimAuthority()")
    || !loopsText.includes("state.providerRateLimitControl.observeWebsiteAuthority")
    || !providerText.includes("this.store.hasUndeliveredProviderCooldown()")
    || !providerText.includes("Date.parse(input.serverNow) < Date.parse(latestIncidentServerNow)")
    || !providerText.includes('this.store.latestProviderCooldownClearance() === "confirmed_absent"')
    || !providerText.includes('`${incidentRequestId}_not_cleared`')
    || providerText.includes("Date.now()")
    || outboxText.includes("Date.parse(receipt.cooldown_until) >")
    || !outboxText.includes("parseLocalProviderCooldownReceipt(local.body_blob, response)")
    || !outboxText.includes("latestProviderCooldownClearance()")
    || !outboxText.includes("clearance')='confirmed_absent'")
    || !providerReceiptText.includes("receiptHash !== hashCanonical(core)")) {
    findings.push(finding(DATABASE_LAW, "agent-production-runtime/provider-cooldown-authority",
      PATHS.providerControl,
      "Provider cooldown must close claim and submit from the durable Outbox, reopen only from later Website server authority, and self-hash-validate live plus hydrated receipts."));
  }
  const proofSupport = sourceFor(context, PATHS.proofSupport);
  const proofSql = preparedSql(proofSupport);
  const proofPrefix = proofSupport?.getVariableDeclaration("sentProductionCheckpointPrefix")?.getInitializer();
  if (proofSql.includes("path like") || !proofSql.includes("instr(path,?)>0")
    || !proofPrefix?.getText().includes("encodeURIComponent(jobId)")) {
    findings.push(finding(PROOF_LAW, "agent-production-runtime/proof-outbox-job-boundary", PATHS.proofSupport,
      "Runtime proof checkpoint selection is not bound to one literal encoded job path segment."));
  }
};
