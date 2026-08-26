import { Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";

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
const managedExecutionStartPath =
  "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution-start.ts";
const singleTabBrowserPath =
  "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts";
const concurrencyAcceptancePath =
  "src/capabilities/ai-input-gateway/acceptance/web-chat-concurrency.acceptance.ts";
const schedulerAcceptanceHelperPath =
  "src/capabilities/ai-input-gateway/acceptance/web-chat-scheduler-admission.acceptance-helper.ts";

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

const resolvesTo = (node: MorphNode | undefined, declaration: MorphNode | undefined): boolean => {
  if (!node || !declaration) return false;
  const symbol = node.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false)
    || (Node.isIdentifier(node)
      && node.getDefinitions().some((definition) => definition.getDeclarationNode() === declaration));
};

const requiredSource = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  repoPath: string,
): SourceFile | null => {
  const source = context.project.getSourceFile(resolveFromRepo(repoPath));
  if (source) return source;
  findings.push(createFinding({ evidenceMode: "static.ast",
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
  findings.push(createFinding({ evidenceMode: "static.ast", lawId, filePath, checkId, message }));
};

type SchedulerSources = {
  lease: SourceFile;
  ledger: SourceFile;
  managed: SourceFile;
  start: SourceFile;
  singleTab: SourceFile;
  acceptance: SourceFile;
  admissionAcceptance: SourceFile;
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
    managedExecutionStartPath,
    singleTabBrowserPath,
    concurrencyAcceptancePath,
    schedulerAcceptanceHelperPath,
  ] as const;
  const sources = paths.map((repoPath) =>
    requiredSource(context, findings, lawId, repoPath));
  if (sources.some((source) => source === null)) return null;
  return {
    lease: sources[0]!,
    ledger: sources[1]!,
    managed: sources[2]!,
    start: sources[3]!,
    singleTab: sources[4]!,
    acceptance: sources[5]!,
    admissionAcceptance: sources[6]!,
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

const inspectSchedulerLedgerValues = (
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
    "admission_ref",
    "priority_key",
    "WEB_CHAT_SUBMISSION_ADMISSION_DRIFT",
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
};

const inspectSchedulerAcceptanceValues = (
  sources: SchedulerSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const acceptanceValues = new Set([
    ...identifiers(sources.acceptance),
    ...literalTokens(sources.acceptance),
    ...identifiers(sources.admissionAcceptance),
    ...literalTokens(sources.admissionAcceptance),
  ]);
  for (const required of [
    "business capacity cannot be collapsed to the single physical Browser lane",
    "registerDeadProcessSubmissionTicket",
    "a dead-process ticket without a current Cloud grant must not block the same durable execution after a fresh current Cloud grant",
    "the same durable execution must receive a new waiter after dead-owner cleanup and fresh Cloud admission",
    "a live waiter cannot replace its current Cloud admission in place",
    "reverse async registration must not overtake the globally oldest claimable task",
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

const inspectSchedulerAdmissionStructure = (
  sources: SchedulerSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const waiterProperties = new Set(
    sources.ledger.getInterface("WaiterRow")?.getProperties().map((property) => property.getName()) ?? [],
  );
  const ledgerRegister = sources.ledger.getVariableDeclaration("registerWebChatSchedulerWaiter")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const leaseRegister = sources.lease.getVariableDeclaration("registerPendingWebChatSubmission")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const ledgerRegisterDeclaration = sources.ledger.getVariableDeclaration("registerWebChatSchedulerWaiter");
  const ledgerCall = leaseRegister?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => resolvesTo(call.getExpression(), ledgerRegisterDeclaration));
  const startExecution = sources.start.getVariableDeclaration("startActiveExecution")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const leaseRegisterDeclaration = sources.lease.getVariableDeclaration("registerPendingWebChatSubmission");
  const startCall = startExecution?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => resolvesTo(call.getExpression(), leaseRegisterDeclaration));
  const ledgerAdmissionArgument = ledgerCall?.getArguments()[3];
  const leaseAdmissionParameter = leaseRegister?.getParameters()[2];
  const startAdmissionArgument = startCall?.getArguments()[2];
  const startInputParameter = startExecution?.getParameters()[0];
  const startSourceAccess = Node.isPropertyAccessExpression(startAdmissionArgument)
    ? startAdmissionArgument.getExpression()
    : undefined;
  const startAdmissionBound = Node.isPropertyAccessExpression(startAdmissionArgument)
    && startAdmissionArgument.getName() === "submissionAdmission"
    && Node.isPropertyAccessExpression(startSourceAccess)
    && startSourceAccess.getName() === "source"
    && resolvesTo(startSourceAccess.getExpression(), startInputParameter);
  const structurallyBound = waiterProperties.has("admission_ref")
    && waiterProperties.has("priority_key")
    && ledgerRegister?.getParameters().some((parameter) => parameter.getName() === "submissionAdmission") === true
    && resolvesTo(ledgerAdmissionArgument, leaseAdmissionParameter)
    && startAdmissionBound;
  if (!structurallyBound) {
    push(
      findings,
      lawId,
      schedulerLedgerPath,
      "ai-input-gateway/cloud-admission-oldest-first-binding",
      "Scheduler AST must persist the owner-minted admission and business priority, thread it from managed execution, and order admitted submissions by priority_key before ticket.",
    );
  }
};

const inspectDurableFifo = (
  sources: SchedulerSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  inspectSchedulerLedgerValues(sources, findings, lawId);
  inspectSchedulerAcceptanceValues(sources, findings, lawId);
  inspectSchedulerAdmissionStructure(sources, findings, lawId);
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
