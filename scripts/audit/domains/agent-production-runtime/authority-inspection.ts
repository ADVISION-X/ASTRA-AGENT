import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const DATABASE_LAW = "LAW-AGENT-PRODUCTION-RUNTIME-005-V13";
const PROOF_LAW = "LAW-AGENT-PRODUCTION-RUNTIME-008-V16";
const ROOT = "src/lib/local-runtime/production";
const PATHS = {
  authority: `${ROOT}/store-authority-reader.ts`, ledger: `${ROOT}/store-ledger.ts`,
  outbox: `${ROOT}/store-outbox.ts`, taskState: `${ROOT}/store-task-state.ts`,
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
  const taskState = sourceFor(context, PATHS.taskState)?.getClass("ProductionStoreTaskState");
  const checkpointCalls = callsIn(taskState?.getMethod("readCheckpoint"));
  const leaseCalls = callsIn(taskState?.getMethod("readLease"));
  const ledgerCalls = callsIn(sourceFor(context, PATHS.ledger)
    ?.getClass("ProductionRuntimeStore")?.getMethod("assertStartupDataIntegrity"));
  const authorityCalls = callsIn(sourceFor(context, PATHS.authority));
  if (!checkpointCalls.has("productionCheckpointAuthorityFromRow")
    || !leaseCalls.has("productionLeaseAuthorityFromRow")
    || !authorityCalls.has("productionCheckpointAuthorityFromRow")
    || !authorityCalls.has("productionLeaseAuthorityFromRow")
    || !ledgerCalls.has("stateInvariantFailureCount")) {
    findings.push(finding(DATABASE_LAW, "agent-production-runtime/authority-invariant-reader", PATHS.taskState,
      "Runtime readers and startup do not share the exact checkpoint and lease validators."));
  }
  const outbox = sourceFor(context, PATHS.outbox);
  const outboxSql = preparedSql(outbox);
  const marker = outbox?.getVariableDeclaration("jobPathMarker")?.getInitializer();
  const markerCalls = (outbox?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .filter((call) => call.getExpression().getText() === "jobPathMarker").length;
  if (outboxSql.includes("path like") || (outboxSql.match(/instr\(path,\?\)>0/gu)?.length ?? 0) < 5
    || markerCalls < 5 || !marker?.getText().includes("encodeURIComponent(jobId)")) {
    findings.push(finding(DATABASE_LAW, "agent-production-runtime/outbox-job-boundary", PATHS.outbox,
      "Outbox job selection is not bound to one literal encoded path segment."));
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
