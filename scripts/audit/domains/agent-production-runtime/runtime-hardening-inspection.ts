import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

export type RuntimeHardeningPaths = Readonly<{
  pluginContract: string;
  executor: string;
  evidence: string;
  cloudClient: string;
  response: string;
  typedFailure: string;
  runtimeLogging: string;
  transport: string;
  contract: string;
  runtime: string;
  gptExecutor: string;
  blueprint: string;
  mutationCheckId: string;
  gptExecutorMutationTokens: readonly string[];
  evidenceMutationTokens: readonly string[];
}>;

const read = (context: InspectorContext, repoPath: string): string =>
  readFileSync(resolve(context.sealedRoot, repoPath), "utf8");

const pushFinding = (
  findings: InspectorFinding[],
  lawId: string,
  checkId: string,
  filePath: string,
  message: string,
): void => {
  findings.push(createFinding({
    evidenceMode: "static.ast",
    lawId,
    clauseId: `${lawId.toLowerCase()}-requirement`,
    checkId,
    filePath,
    message,
  }));
};

const inspectRequiredTokens = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  paths: RuntimeHardeningPaths,
): void => {
  const required: ReadonlyArray<Readonly<{ path: string; checkId: string; tokens: readonly string[] }>> = [
    { path: paths.pluginContract, checkId: "strict-result-parser", tokens: ["readonly parseResult:"] },
    { path: paths.executor, checkId: "strict-result-parser", tokens: ["authorized.plugin.parseResult"] },
    { path: paths.evidence, checkId: "strict-result-parser", tokens: ["safeProjection", "appendRecord", "readRecordRef", "EVIDENCE_READBACK_FAILED"] },
    { path: paths.cloudClient, checkId: "result-receipt-binding", tokens: ["plugin.parseResult", "uploadGeneratedImage", "execution_receipt_hash", "evidence_refs"] },
    { path: paths.response, checkId: "generated-image-bytes", tokens: ["downloadAuthenticatedMedia", "sharp(original", ".resize(1200, 630", ".webp(", "metadata.exif", "metadata.xmp", "GPT_GENERATED_IMAGE_READBACK_INVALID"] },
    { path: paths.typedFailure, checkId: "typed-failure-chain", tokens: ["typedExecutionFailure", "httpStatus", "cause"] },
    { path: paths.runtimeLogging, checkId: "typed-failure-chain", tokens: ["typedExecutionFailure(error)?.code", "causedByEventId"] },
    { path: paths.transport, checkId: "typed-failure-chain", tokens: ["executionFailure(", "httpStatus"] },
    { path: paths.contract, checkId: "completion-only", tokens: ["z.literal(\"completed\")", "failure: z.null()"] },
    { path: "src/lib/local-runtime/production/runtime-state.ts", checkId: "bounded-attempt-decision", tokens: ["max_provider_turns"] },
    { path: "src/lib/local-runtime/production/store-foundation.ts", checkId: "binary-task-state", tokens: [
      "ProductionTaskStatus = \"failed\" | \"completed\"", "status text not null check(status in ('failed','completed'))",
      "PRODUCTION_EMPTY_CUTOVER_REQUIRED",
    ] },
    { path: "src/lib/local-runtime/production/store-task-state.ts", checkId: "attempt-failure-receipt", tokens: [
      "PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE", "current_reason", "production_attempt_failures",
    ] },
    { path: paths.gptExecutor, checkId: paths.mutationCheckId, tokens: paths.gptExecutorMutationTokens },
    { path: paths.evidence, checkId: paths.mutationCheckId, tokens: paths.evidenceMutationTokens },
    { path: paths.blueprint, checkId: "local-agent-process-owner", tokens: ["AGENT 始终运行在用户本地 Mac", "不授予网站 AGENT 进程"] },
    { path: "src/lib/local-runtime/production/cloud-reconciliation-client.ts", checkId: "business-admission-reconciliation", tokens: ["business_admission_receipt", "business_consumer_error", "V6_BUSINESS_ADMISSION_AUTHORITY_INVALID"] },
  ];
  for (const entry of required) {
    const source = read(context, entry.path);
    for (const token of entry.tokens) if (!source.includes(token)) pushFinding(
      findings, lawId, `agent-production-runtime/${entry.checkId}`, entry.path,
      `V5 hardening boundary is missing ${token}.`,
    );
  }
  const runtime = read(context, paths.runtime);
  for (const forbidden of [
    "FINAL_FAILED", "recovery_pending", "review_required", "RETRY_FROM_CHECKPOINT", "RECONCILE_ONLY",
  ]) {
    if (runtime.includes(forbidden)) pushFinding(
      findings, lawId, "agent-production-runtime/failed-task-terminal-retired", paths.runtime,
      `Active runtime still contains retired task terminal token ${forbidden}.`,
    );
  }
};

const inspectForensicsProjection = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  evidencePath: string,
): void => {
  const executor = read(context, evidencePath);
  const projectionStart = executor.indexOf("const safeProjection");
  const projectionEnd = executor.indexOf("const generatedImageArtifacts", projectionStart);
  const projection = projectionStart >= 0 && projectionEnd > projectionStart
    ? executor.slice(projectionStart, projectionEnd) : "";
  for (const forbidden of ["raw_url", "selector", "prompt", "local_path", "html"]) {
    if (!projection || projection.toLocaleLowerCase("en-US").includes(forbidden)) pushFinding(
      findings, lawId, "agent-production-runtime/forensics-safe-projection", evidencePath,
      `Forensics evidence projection is missing or contains forbidden field ${forbidden}.`,
    );
  }
};

const inspectFailurePolicy = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  paths: RuntimeHardeningPaths,
): void => {
  if (read(context, paths.transport).includes("retryable")) pushFinding(
    findings, lawId, "agent-production-runtime/typed-failure-chain", paths.transport,
    "The production transport reintroduced a retryable boolean beside the typed failure chain.",
  );
  const runtime = read(context, paths.runtime);
  for (const forbiddenTerminal of ["BROWSER_", "GPT_", "EVIDENCE_", "BROWSER_POSTCONDITION_FAILED"]) {
    if (runtime.includes(`terminalCodes = new Set([\n    \"${forbiddenTerminal}`)) pushFinding(
      findings, lawId, "agent-production-runtime/recoverable-failure-terminal-forbidden", paths.runtime,
      `Recoverable page/runtime failure ${forbiddenTerminal} must not enter the terminal-code set.`,
    );
  }
};

const inspectPerJobFailureIsolation = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const loopsPath = "src/lib/local-runtime/production/runtime-loops.ts";
  const loops = read(context, loopsPath);
  const flushStart = loops.indexOf("export const flushOutboxWithLog");
  const flushEnd = loops.indexOf("const requestClaimBatch", flushStart);
  const flush = flushStart >= 0 && flushEnd > flushStart ? loops.slice(flushStart, flushEnd) : "";
  for (const token of [
    "state.store.pendingOutbox()",
    "state.store.readOutboxAuthority(write.idempotency_key)",
    "outcome: \"failed\"",
  ]) {
    if (!flush.includes(token)) pushFinding(findings, lawId,
      "agent-production-runtime/per-job-outbox-isolation", loopsPath,
      `Outbox flusher is missing per-job failure isolation token ${token}.`);
  }
  if (!flush || /\bthrow\b/u.test(flush)) pushFinding(findings, lawId,
    "agent-production-runtime/per-job-outbox-isolation", loopsPath,
    "One Outbox delivery failure must be logged on that job without escaping the shared flusher.");

  const outboxPath = "src/lib/local-runtime/production/store-outbox.ts";
  const outbox = read(context, outboxPath);
  for (const token of [
    "OUTBOX_RETRY_DELAY_MS = 5_000",
    "recordDeliveryFailure",
    "next_delivery_at",
    "OUTBOX_STALE_RETIRE_CODES",
    "this.retireStaleOutbox(idempotencyKey, code)",
  ]) if (!outbox.includes(token)) pushFinding(findings, lawId,
    "agent-production-runtime/bounded-outbox-delivery", outboxPath,
    `Outbox delivery is missing bounded retry token ${token}.`);

  const foundationPath = "src/lib/local-runtime/production/store-foundation.ts";
  const foundation = read(context, foundationPath);
  for (const token of [
    "last_error text", "next_delivery_at text", 'state: "pending" | "delivered" | "failed"',
  ]) if (!foundation.includes(token)) pushFinding(findings, lawId,
    "agent-production-runtime/durable-outbox-authority", foundationPath,
    `Outbox authority is missing required delivery fact ${token}.`);
  for (const forbidden of ["delivery_attempt_count", "delivery_parked_at", '"parked"']) {
    if (foundation.includes(forbidden) || outbox.includes(forbidden)) pushFinding(findings, lawId,
      "agent-production-runtime/outbox-second-verdict-forbidden", foundationPath,
      `Outbox authority still contains retired second-verdict token ${forbidden}.`);
  }

  const ledgerPath = "src/lib/local-runtime/production/store-ledger.ts";
  const ledger = read(context, ledgerPath);
  for (const token of ["this.terminalTaskConsistent(task, terminal)",
    "task.status === \"completed\" && jobOutbox.some", "admissionPending"]) {
    if (!ledger.includes(token)) pushFinding(findings, lawId,
      "agent-production-runtime/per-job-ledger-isolation", ledgerPath,
      `Ledger is missing job-scoped consistency token ${token}.`);
  }
};

export const inspectRuntimeHardening = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  paths: RuntimeHardeningPaths,
): void => {
  inspectRequiredTokens(context, findings, lawId, paths);
  inspectForensicsProjection(context, findings, lawId, paths.evidence);
  inspectFailurePolicy(context, findings, lawId, paths);
  inspectPerJobFailureIsolation(context, findings, lawId);
};
