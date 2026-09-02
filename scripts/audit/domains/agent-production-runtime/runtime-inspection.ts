import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V29";
const PATHS = {
  executor: "src/lib/local-runtime/production/executor.ts",
  childTools: "src/lib/local-runtime/production/production-gpt-child-tools.ts",
  childBrowser: "src/lib/local-runtime/production/production-gpt-browser-lifecycle.ts",
  childFacts: "src/lib/local-runtime/production/production-gpt-call-facts.ts",
  evidenceWriter: "src/lib/local-runtime/production/gpt-evidence-writer.ts",
  artifactReader: "src/lib/local-runtime/production/gpt-artifact-reader.ts",
  evidenceFact: "src/lib/local-runtime/production/production-gpt-evidence-fact.ts",
  completedResult: "src/lib/local-runtime/production/production-gpt-completed-result.ts",
  continuationReadback: "src/lib/local-runtime/production/production-gpt-continuation-readback.ts",
  store: "src/lib/local-runtime/production/store-foundation.ts",
  taskState: "src/lib/local-runtime/production/store-task-state.ts",
  cloudReconciliation: "src/lib/local-runtime/production/cloud-reconciliation-client.ts",
  transport: "src/lib/local-runtime/production/transport-protocol.ts",
  runtimeClaim: "src/lib/local-runtime/production/runtime-claim.ts",
  faultPreservation: "src/lib/local-runtime/production/runtime-claim-fault-preservation.ts",
  cloudClient: "src/lib/local-runtime/production/cloud-client.ts",
  outbox: "src/lib/local-runtime/production/store-outbox.ts",
  runtimeLoops: "src/lib/local-runtime/production/runtime-loops.ts",
  permanentRevocation: "src/lib/local-runtime/production/runtime-permanent-revocation.ts",
  typedFailure: "src/lib/typed-failure.ts",
} as const;

const finding = (checkId: string, filePath: string, message: string,
  evidenceMode: "static.ast" | "static.contract" = "static.ast"): InspectorFinding => createFinding({
  evidenceMode, lawId: LAW_ID, clauseId: `${LAW_ID.toLowerCase()}-requirement`,
  checkId, filePath, message,
});
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");

const inspectTaskStore = (store: string, taskState: string, findings: InspectorFinding[]): void => {
  for (const required of ['ProductionTaskStatus = "failed" | "completed"',
    "status text not null check(status in ('failed','completed'))", "PRODUCTION_EMPTY_CUTOVER_REQUIRED"])
    if (!store.includes(required)) findings.push(finding("agent-production-runtime/binary-task-store",
      PATHS.store, `Binary task store is missing ${required}.`));
  for (const forbidden of ["create table production_steps", "writeGptTurnCheckpoint", "readGptTurnCheckpoint"])
    if (store.includes(forbidden)) findings.push(finding("agent-production-runtime/global-gpt-checkpoint-retired",
      PATHS.store, `Production store retains retired global GPT checkpoint token ${forbidden}.`));
  for (const required of ["readGptContinuationForOriginJob", "turnMarker",
    "json_extract(provider_json,'$.prior_turn_marker')=?", "readGptContinuationForFrontier",
    "frontier_ref=?", "origin_provider_json", "origin_checkpoint_json", "continuationFromRow"])
    if (!taskState.includes(required)) findings.push(finding("agent-production-runtime/attempt-bound-continuation-read",
      PATHS.taskState, `Continuation recovery must use the Product's exact current-attempt marker; missing ${required}.`));
  for (const required of ["migrateContinuationFrontierSchema",
    "alter table production_continuations add column frontier_ref",
    "production_continuations_frontier_ref_unique", "origin_provider_json=provider_json"])
    if (!store.includes(required)) findings.push(finding("agent-production-runtime/frontier-in-place-migration",
      PATHS.store, `Continuation frontier migration is missing ${required}.`));
};

const inspectChildRuntime = (
  executor: string, childRuntime: string, findings: InspectorFinding[],
): void => {
  for (const required of ["submission-locator", "agent-gpt-submission-locator.v1",
    "readSubmissionLocatorArtifact", 'call.child === "reconcile_gpt_turn_submission"'])
    if (!childRuntime.includes(required)) findings.push(finding("agent-production-runtime/submission-locator-replay",
      PATHS.childTools, `Exact-call submission locator recovery is missing ${required}.`));
  for (const token of ["runTurn", "GptTurnExecutor", "GPT_TURN_FLOW", "resumePoint", "reconcileOnly"])
    if (`${executor}\n${childRuntime}`.includes(token)) findings.push(finding(
      "agent-production-runtime/central-turn-owner-retired", PATHS.executor,
      `Shared runtime retains retired GPT turn token ${token}.`));
  for (const required of ["ProductionGptChildTools", "this.gpt.execute(intent", "runAtomicStep(",
    'mutationMode: "readback"', "sessionKey", "productStepId", "callId", "childCapabilityId", "inputHash",
    "readCallFacts", "gptExactCallIdentityHash", "readExactCallMutationFact", "readExactCallEvidence",
    "exactCallIdentityHash", "readContinuationExact", "lookupKind", "prior_turn_marker",
    "readGptContinuationForFrontier", "readTextCheckpointArtifact", "readRecordRef",
    "yieldForProviderWait", 'mode: "normal-provider-wait"', 'mode: "recovery"'])
    if (!childRuntime.includes(required)) findings.push(finding("agent-production-runtime/one-child-transport",
      PATHS.childTools, `Child transport is missing ${required}.`));
  if (childRuntime.includes("readContinuationForTurn")) findings.push(finding(
    "agent-production-runtime/old-continuation-read-retired", PATHS.childTools,
    "The old turn-only continuation read surface must be physically absent."));
  if (!executor.includes("gpt: gptExecution.tools") || executor.includes("runTurn:")) findings.push(finding(
    "agent-production-runtime/product-child-interface", PATHS.executor,
    "Executor must inject only ProductGptTools, never a shared turn runner."));
};

const inspectPostSubmit = (sources: Readonly<{
  typedFailure: string; runtimeClaim: string; faultPreservation: string; cloudClient: string;
}>, findings: InspectorFinding[]): void => {
  const recovery = Object.values(sources).join("\n");
  for (const required of ["PostSubmitReadbackFault", "postSubmitReadbackReceipt",
    'reasonCode: "POST_SUBMIT_READBACK_FAULT"', "confirmedSubmit"])
    if (!recovery.includes(required)) findings.push(finding("agent-production-runtime/post-submit-same-attempt-release",
      PATHS.runtimeClaim, `Confirmed-submit readback recovery is missing ${required}.`));
  for (const required of ["input.causeCode !== code", "Number.isFinite(terminalAt)",
    "Number.isFinite(readbackDeadlineAt)", "readbackDeadlineAt <= terminalAt",
    "SHA256_PATTERN.test(input.exactCallIdentityHash)", "input.evidenceRef.trim().length === 0",
    "SHA256_PATTERN.test(input.evidenceHash)"])
    if (!sources.typedFailure.includes(required)) findings.push(finding(
      "agent-production-runtime/post-submit-receipt-closure", PATHS.typedFailure,
      `Confirmed-submit receipt closure is missing ${required}.`));
  for (const forbidden of ["POST_SUBMIT_READBACK_TRANSIENT_CODES", "Date.now() >= readbackDeadlineAt"])
    if (sources.typedFailure.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/post-submit-no-eligibility-gate", PATHS.typedFailure,
      `Confirmed-submit recovery retains forbidden eligibility gate ${forbidden}.`));
};

const inspectWebsiteAttemptPolicy = (source: string, findings: InspectorFinding[]): void => {
  for (const forbidden of ["accepted_attempt_limit", "RECOVERY_PARKED", "rearm_eligible", "retry_not_before"])
    if (source.includes(forbidden)) findings.push(finding("agent-production-runtime/website-attempt-policy-not-consumed",
      PATHS.transport, `AGENT consumes forbidden Website retry-policy field ${forbidden}.`, "static.contract"));
  if (/accepted_attempt_count\s*[<>]=?\s*\d/u.test(source)
    || /accepted_attempt_count[\s\S]{0,80}\.max\(\d+\)/u.test(source)) findings.push(finding(
    "agent-production-runtime/website-owned-attempt-budget", PATHS.cloudReconciliation,
    "AGENT may consume accepted_attempt_count only as a nonnegative fact, never as a claim, retry or parking gate."));
};

const inspectOutbox = (sources: Readonly<{
  store: string; outbox: string; runtimeLoops: string; permanentRevocation: string;
}>, findings: InspectorFinding[]): void => {
  const { store, outbox, runtimeLoops, permanentRevocation } = sources;
  for (const required of ["OUTBOX_TRANSIENT_RETRY_DELAY_MS = 5_000",
    "OUTBOX_LOW_FREQUENCY_RETRY_DELAY_MS = 3_600_000",
    "const retryDelay =", "const nextDeliveryAt = new Date(Date.parse(timestamp) + retryDelay(error)).toISOString()"])
    if (!outbox.includes(required)) findings.push(finding("agent-production-runtime/outbox-finite-redelivery",
      PATHS.outbox, `Outbox same-intent finite redelivery is missing ${required}.`));
  for (const forbidden of ["OUTBOX_STALE_RETIRE_CODES", "retireStaleOutbox", "delete from production_outbox"])
    if (outbox.includes(forbidden)) findings.push(finding("agent-production-runtime/outbox-no-local-terminal-rejection",
      PATHS.outbox, `Outbox retains a local terminal-delivery branch ${forbidden}.`));
  for (const required of ["PERMANENT_REVOCATION_REASON", "settlePermanentlyRevokedJob",
    "set last_error=?,next_delivery_at=null where path like ?"])
    if (!outbox.includes(required)) findings.push(finding("agent-production-runtime/exact-revocation-outbox-settlement",
      PATHS.outbox, `Exact Website revocation settlement is missing ${required}.`));
  for (const required of ["deferOutboxReconciliation", "blockedJobIds",
    "settleInactivePermanentAuthorizationRevocation"])
    if (!runtimeLoops.includes(required)) findings.push(finding("agent-production-runtime/job-local-status-reconciliation",
      PATHS.runtimeLoops, `Job-local status reconciliation is missing ${required}.`));
  for (const required of ['remote.current_reason?.code === "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED"',
    "readBrowserReconciliationScope", "settlePermanentlyRevokedJob"])
    if (!permanentRevocation.includes(required)) findings.push(finding(
      "agent-production-runtime/website-proven-revocation-only", PATHS.permanentRevocation,
      `Permanent revocation proof is missing ${required}.`));
  const settlement = outbox.slice(outbox.indexOf("public settlePermanentlyRevokedJob"),
    outbox.indexOf("public deliverOutbox"));
  if (settlement.includes("sent_at=")) findings.push(finding(
    "agent-production-runtime/revocation-no-fake-delivery", PATHS.outbox,
    "Permanent revocation must not fabricate Outbox delivery or receipt evidence."));
  if (!store.includes('state: "pending" | "delivered"') || !store.includes("restoreOutboxDeliverySchedule"))
    findings.push(finding("agent-production-runtime/outbox-unfinished-liveness", PATHS.store,
      "Every non-revoked undelivered Outbox intent must remain pending with a finite delivery schedule."));
  if (!store.includes("last_error<>'PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED'")) findings.push(finding(
    "agent-production-runtime/revocation-survives-restart", PATHS.store,
    "Startup must not restore delivery for an exactly revoked Outbox intent."));
};

export const inspectSharedProductionRuntime = (
  context: InspectorContext, findings: InspectorFinding[],
): void => {
  const executor = read(context, PATHS.executor);
  const childRuntime = [PATHS.childTools, PATHS.childBrowser, PATHS.childFacts, PATHS.evidenceWriter,
    PATHS.artifactReader, PATHS.evidenceFact, PATHS.completedResult, PATHS.continuationReadback]
    .map((path) => read(context, path)).join("\n");
  const store = read(context, PATHS.store);
  const runtimeClaim = read(context, PATHS.runtimeClaim);
  inspectChildRuntime(executor, childRuntime, findings);
  inspectPostSubmit({ typedFailure: read(context, PATHS.typedFailure), runtimeClaim,
    faultPreservation: read(context, PATHS.faultPreservation), cloudClient: read(context, PATHS.cloudClient) }, findings);
  inspectTaskStore(store, read(context, PATHS.taskState), findings);
  inspectWebsiteAttemptPolicy([read(context, PATHS.cloudReconciliation),
    read(context, PATHS.transport), runtimeClaim].join("\n"), findings);
  inspectOutbox({ store, outbox: read(context, PATHS.outbox),
    runtimeLoops: read(context, PATHS.runtimeLoops),
    permanentRevocation: read(context, PATHS.permanentRevocation) }, findings);
};
