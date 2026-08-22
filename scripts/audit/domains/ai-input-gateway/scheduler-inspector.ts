import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const concurrencyLeasePath =
  "src/capabilities/ai-input-gateway/runtime/web-chat-concurrency-lease.ts";
const schedulerLedgerPath =
  "src/capabilities/ai-input-gateway/runtime/web-chat-scheduler-ledger.ts";
const managedExecutionPath =
  "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts";
const singleTabBrowserPath =
  "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts";
const concurrencyAcceptancePath =
  "src/capabilities/ai-input-gateway/acceptance/web-chat-concurrency.acceptance.ts";

const identifiers = (source: SourceFile): Set<string> => new Set(
  source.getDescendantsOfKind(SyntaxKind.Identifier)
    .map((node) => node.compilerNode.escapedText.toString()),
);

const literalTokens = (source: SourceFile): Set<string> => {
  const separators = new Set([
    " ", "\n", "\r", "\t", "(", ")", ",", ";", "'", '"', "`", ".", "=",
  ]);
  const literals = [
    ...source.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .map((node) => node.getLiteralText()),
  ];
  const tokens = [...literals];
  for (const literal of literals) {
    let current = "";
    for (const character of literal) {
      if (!separators.has(character)) {
        current += character;
        continue;
      }
      if (current) tokens.push(current);
      current = "";
    }
    if (current) tokens.push(current);
  }
  return new Set(tokens);
};

const requiredSource = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  repoPath: string,
): SourceFile | null => {
  const source = context.project.getSourceFile(resolveFromRepo(repoPath));
  if (source) return source;
  findings.push(createFinding({
    lawId,
    filePath: repoPath,
    checkId: "ai-input-gateway/source-present",
    message: `${repoPath} must exist in the audit project.`,
  }));
  return null;
};

const push = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ lawId, filePath, checkId, message }));
};

type SchedulerSources = {
  lease: SourceFile;
  ledger: SourceFile;
  managed: SourceFile;
  singleTab: SourceFile;
  acceptance: SourceFile;
};

const loadSchedulerSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): SchedulerSources | null => {
  const paths = [
    concurrencyLeasePath,
    schedulerLedgerPath,
    managedExecutionPath,
    singleTabBrowserPath,
    concurrencyAcceptancePath,
  ] as const;
  const sources = paths.map((repoPath) =>
    requiredSource(context, findings, lawId, repoPath));
  if (sources.some((source) => source === null)) return null;
  return {
    lease: sources[0]!,
    ledger: sources[1]!,
    managed: sources[2]!,
    singleTab: sources[3]!,
    acceptance: sources[4]!,
  };
};

const inspectSubmissionGate = (
  sources: SchedulerSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const leaseIds = identifiers(sources.lease);
  const acceptanceIds = identifiers(sources.acceptance);
  for (const required of [
    "registerPendingWebChatSubmission",
    "pendingWebChatSubmissionCount",
    "acquireWebChatBrowserPatrolLease",
  ]) {
    if (leaseIds.has(required) && acceptanceIds.has(required)) continue;
    push(
      findings,
      lawId,
      concurrencyLeasePath,
      "ai-input-gateway/submission-priority-patrol",
      `Submission-priority patrol must implement and execute ${required}.`,
    );
  }
  if (
    !identifiers(sources.managed).has("releasePendingSubmission")
    || !identifiers(sources.singleTab).has("acquireWebChatBrowserPatrolLease")
  ) {
    push(
      findings,
      lawId,
      managedExecutionPath,
      "ai-input-gateway/submission-priority-patrol",
      "Managed execution must release the pending-submission gate only after durable submit proof, and ordinary patrol must use that gate.",
    );
  }
};

const inspectDurableFifo = (
  sources: SchedulerSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const ledgerValues = new Set([
    ...identifiers(sources.ledger),
    ...literalTokens(sources.ledger),
  ]);
  for (const required of [
    "registerWebChatSchedulerWaiter",
    "isNextWebChatSubmissionWaiter",
    "isNextWebChatPatrolWaiter",
    "scheduler_waiters",
    "scheduler_sequence",
    "ticket",
  ]) {
    if (ledgerValues.has(required)) continue;
    push(
      findings,
      lawId,
      schedulerLedgerPath,
      "ai-input-gateway/durable-fifo-scheduler",
      `Durable web-chat scheduler must contain ${required}.`,
    );
  }
  const acceptanceValues = new Set([
    ...identifiers(sources.acceptance),
    ...literalTokens(sources.acceptance),
  ]);
  for (const required of [
    "business capacity cannot be collapsed to the single physical Browser lane",
    "registerRestartableSubmissionTicket",
    "restart must rebind the same oldest durable submission ticket",
    "firstSubmission",
    "secondSubmission",
    "a newer durable submission ticket must not overtake the oldest ticket",
    "firstPatrolPromise",
    "secondPatrolPromise",
    "durable patrol tickets must preserve FIFO admission",
  ]) {
    if (acceptanceValues.has(required)) continue;
    push(
      findings,
      lawId,
      concurrencyAcceptancePath,
      "ai-input-gateway/durable-fifo-scheduler",
      `Concurrency acceptance must prove ${required}.`,
    );
  }
};

export const inspectSubmissionPriorityPatrol = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = loadSchedulerSources(context, findings, lawId);
  if (!sources) return;
  inspectSubmissionGate(sources, findings, lawId);
  inspectDurableFifo(sources, findings, lawId);
};
