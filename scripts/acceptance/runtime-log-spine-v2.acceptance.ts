import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrowserMutationStore,
  resolveStoredBrowserMutationAuthority,
} from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  createRuntimeLogger,
  diagnoseRuntimeLog,
  requireRuntimeLogWrite,
  runtimeEventIntegrityValid,
  runtimeFailureFromError,
  runtimeLogEventShapeValid,
  type RuntimeLogEventV2,
} from "../../src/lib/runtime-logs/index.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const digest = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const root = mkdtempSync(path.join(tmpdir(), "runtime-log-spine-v2-"));

try {
  const logger = createRuntimeLogger({
    producer: "runtime-log-acceptance",
    producerRunId: "runtime-log-acceptance-run",
    owner: "production-runtime",
    component: "production-runtime",
    terminalEnabled: false,
    fileSink: { directoryPath: root, maxTotalBytes: 1_048_576 },
  });
  requireRuntimeLogWrite(logger.emitState({
    traceId: "producer:runtime-log-acceptance-run",
    owner: "app-shell",
    stateKey: "producer.alive",
    previous: null,
    current: "alive",
    freshForMs: 60_000,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "producer:runtime-log-acceptance-run",
    owner: "app-shell",
    stateKey: "producer.alive",
    previous: "alive",
    current: "alive",
    freshForMs: 60_000,
  }));
  const rootSpanWrite = logger.startSpan({
    traceId: "job-atomic-log",
    boundaryId: "claim-batch-1",
    operation: "job.execute",
    typedIdentity: {
      kind: "lease", jobId: "job-atomic-log", attemptId: "attempt-1",
      leaseVersion: 1, fenceHash: digest("fence"),
    },
  });
  assert.equal(rootSpanWrite.ok, true);
  if (rootSpanWrite.ok) assert.ok("event" in rootSpanWrite && !("value" in rootSpanWrite));
  const rootSpan = requireRuntimeLogWrite(rootSpanWrite);
  const materialSpan = requireRuntimeLogWrite(logger.startSpan({
    traceId: "job-atomic-log",
    parentSpanId: rootSpan.spanId,
    operation: "material.download-verify",
    typedIdentity: { kind: "job-attempt", jobId: "job-atomic-log", attemptId: "attempt-1" },
  }));
  requireRuntimeLogWrite(materialSpan.terminal({
    outcome: "success",
    authorityRef: "acceptance:materials",
    authorityHash: digest("materials"),
  }));
  const childSpan = requireRuntimeLogWrite(logger.startSpan({
    traceId: "job-atomic-log",
    parentSpanId: rootSpan.spanId,
    owner: "gpt",
    component: "gpt-child",
    operation: "gpt.child",
    typedIdentity: {
      kind: "gpt-call", jobId: "job-atomic-log", attemptId: "attempt-1", pluginId: "plugin-1",
      stepId: "step-1", capabilityCallId: "call-1",
    },
  }));
  const childFailure = requireRuntimeLogWrite(childSpan.terminal({
    outcome: "failed",
    authorityRef: "acceptance:gpt-proof",
    authorityHash: digest("gpt-proof"),
    failure: runtimeFailureFromError({
      error: new Error("PROVIDER_TIMEOUT", { cause: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }) }),
      code: "PROVIDER_TIMEOUT",
      responsibleOwner: "gpt",
      recovery: RuntimeRecovery.RETRY,
      impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
  requireRuntimeLogWrite(rootSpan.terminal({
    outcome: "failed",
    failure: runtimeFailureFromError({
      error: new Error("JOB_FAILED_AFTER_GPT"),
      code: "JOB_FAILED_AFTER_GPT",
      responsibleOwner: "production-runtime",
      recovery: RuntimeRecovery.RETRY,
      impact: RuntimeFailureImpact.CONSEQUENTIAL,
      causedByEventId: childFailure.eventId,
    }),
  }));
  assert.deepEqual(rootSpan.terminal({ outcome: "success" }), {
    ok: false, code: "DUPLICATE_SPAN_TERMINAL", emergencyProjected: false,
  });

  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", stateKey: "job.lifecycle", previous: null, current: "accepted",
    authorityRef: "acceptance:job-store", authorityHash: digest("job-accepted"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", stateKey: "job.lifecycle", previous: "accepted", current: "running",
    authorityRef: "acceptance:job-store", authorityHash: digest("job-running"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", stateKey: "job.lifecycle", previous: "running", current: "recovery_pending",
    authorityRef: "acceptance:job-store", authorityHash: digest("job-recovery"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", stateKey: "job.lease", previous: null, current: "stale",
    authorityRef: "acceptance:lease-store", authorityHash: digest("lease-stale"), reconciledFromAuthority: true,
  }));
  const browserAtomicSpan = requireRuntimeLogWrite(logger.startSpan({
    traceId: "job-atomic-log",
    operation: "browser.command",
    owner: "browser-session",
    component: "exact-target",
    typedIdentity: {
      kind: "browser-command", jobId: "job-atomic-log", attemptId: "attempt-1",
      leaseVersion: 1, fenceHash: digest("fence"), pluginId: "plugin-1", commandId: "atomic-command",
      capabilityCallId: "browser.dom.click.v1", pluginStepId: "report_translation:candidate_a",
      childCapabilityId: "open_gpt_model_selector_v2", actionOrdinal: 5,
    },
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", owner: "browser-session", component: "browser-mutation-wal",
    stateKey: "browser.mutation", previous: null, current: "PREPARED",
    authorityRef: "browser-mutation:atomic-command", authorityHash: digest("browser-prepared"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", owner: "browser-session", component: "browser-mutation-wal",
    stateKey: "browser.mutation", previous: "PREPARED", current: "DISPATCHED",
    authorityRef: "browser-mutation:atomic-command", authorityHash: digest("browser-dispatched"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", owner: "browser-session", component: "browser-mutation-wal",
    stateKey: "browser.mutation", previous: "DISPATCHED", current: "CONFIRMED",
    authorityRef: "browser-mutation:atomic-command", authorityHash: digest("browser-confirmed"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(browserAtomicSpan.terminal({ outcome: "success" }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", owner: "browser-session", component: "browser-mutation-wal",
    stateKey: "browser.mutation", previous: null, current: "PREPARED",
    authorityRef: "acceptance:browser-wal:second", authorityHash: digest("browser-second-prepared"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", owner: "browser-session", component: "browser-mutation-wal",
    stateKey: "browser.mutation", previous: "PREPARED", current: "DISPATCHED",
    authorityRef: "acceptance:browser-wal:second", authorityHash: digest("browser-second-dispatched"), reconciledFromAuthority: true,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "job-atomic-log", owner: "browser-session", component: "browser-mutation-wal",
    stateKey: "browser.mutation", previous: "DISPATCHED", current: "REJECTED",
    authorityRef: "acceptance:browser-wal:second", authorityHash: digest("browser-second-confirmed"), reconciledFromAuthority: true,
  }));

  const segmentPath = logger.currentSegmentPath();
  assert.ok(segmentPath);
  const original = readFileSync(segmentPath!, "utf8");
  const emitted = original.trim().split("\n").map((line) => JSON.parse(line) as RuntimeLogEventV2);
  assert.ok(emitted.every(runtimeLogEventShapeValid));
  assert.ok(emitted.every(runtimeEventIntegrityValid));
  assert.deepEqual(emitted.map((event) => event.producerSeq), emitted.map((_event, index) => index + 1));
  assert.deepEqual([...new Set(emitted.map((event) => event.type))].sort(), ["SPAN", "STATE"]);

  const diagnosis = diagnoseRuntimeLog({
    sources: [root],
    traceId: "job-atomic-log",
    now: new Date(),
    authorityResolver: () => "verified",
  });
  assert.equal(diagnosis.status, "DIAGNOSIS_COMPLETE");
  assert.equal(diagnosis.lastSuccessfulActions[0]?.operation, "browser.command");
  assert.equal(diagnosis.blockingRoots[0]?.operation, "gpt.child");
  assert.equal(diagnosis.blockingRoots[0]?.code, "PROVIDER_TIMEOUT");
  assert.equal(diagnosis.blockingRoots[0]?.nativeCause, "ETIMEDOUT");
  assert.equal(diagnosis.blockingRoots[0]?.responsibleOwner, "gpt");
  assert.deepEqual(diagnosis.recoveries, ["retry"]);
  assert.equal(diagnosis.mutationState, null);
  assert.deepEqual(diagnosis.sideEffects.map((effect) => effect.state), ["CONFIRMED", "REJECTED"]);
  assert.deepEqual(diagnosis.atomicSteps.map((step) => ({
    identity: [step.pluginStepId, step.childCapabilityId, step.actionOrdinal, step.commandId],
    phases: [step.precondition, step.dispatch, step.postcondition, step.terminalState],
    authorityRef: step.authorityRef,
  })), [{
    identity: ["report_translation:candidate_a", "open_gpt_model_selector_v2", 5, "atomic-command"],
    phases: ["passed", "dispatched", "passed", "CONFIRMED"],
    authorityRef: "browser-mutation:atomic-command",
  }]);
  assert.equal(diagnosis.currentStates["job.lifecycle"]?.value, "recovery_pending");
  assert.equal(diagnosis.currentStates["job.lifecycle"]?.fresh, true);
  assert.deepEqual(diagnosis.findings, []);

  const singleFileDiagnosis = diagnoseRuntimeLog({
    sources: [segmentPath!],
    traceId: "job-atomic-log",
    authorityResolver: () => "verified",
  });
  assert.equal(singleFileDiagnosis.status, "DIAGNOSIS_COMPLETE");
  assert.equal(singleFileDiagnosis.sources[0]?.files, 1);

  const mutationStore = new BrowserMutationStore(root);
  mutationStore.prepare({
    commandId: "authority-command", ownerPluginId: "plugin-1", jobId: "job-atomic-log",
    attemptId: "attempt-1", leaseVersion: 1, executionFenceHash: digest("fence"),
    pluginStepId: "step-1", childCapabilityId: "open_gpt_model_selector_v2", actionOrdinal: 1,
    flowVersion: "gpt-turn-flow.v3", stepIndex: 3, effectScope: "target_local",
    targetRef: "target-1", documentRef: "document-1", actionId: "action-1",
    positivePostconditionHash: digest("positive"), negativePostconditionHash: digest("negative"),
    requestHash: digest("request"), payloadHash: digest("payload"),
  });
  const mutationHash = mutationStore.authorityHash("authority-command");
  assert.equal(resolveStoredBrowserMutationAuthority(
    root, "browser-mutation:authority-command", mutationHash,
  ), "verified");
  mutationStore.close();

  const missingSource = diagnoseRuntimeLog({
    sources: [root, path.join(root, "missing-source")],
    traceId: "job-atomic-log",
    authorityResolver: () => "verified",
  });
  assert.equal(missingSource.status, "DIAGNOSIS_INCOMPLETE");
  assert.ok(missingSource.findings.some((item) => item.startsWith("SOURCE_UNAVAILABLE:")));

  assert.throws(() => createRuntimeLogger({
    producer: "runtime-log-acceptance",
    producerRunId: "runtime-log-acceptance-run",
    owner: "production-runtime",
    component: "production-runtime",
    terminalEnabled: false,
    fileSink: { directoryPath: root, maxTotalBytes: 1_048_576 },
  }), /RUNTIME_LOG_PRODUCER_RUN_MULTI_WRITER/u);

  for (const runId of ["cross-run-a", "cross-run-b"]) {
    const crossRun = createRuntimeLogger({
      producer: "cross-run",
      producerRunId: runId,
      owner: "production-runtime",
      component: "production-runtime",
      terminalEnabled: false,
      fileSink: { directoryPath: root, maxTotalBytes: 1_048_576 },
    });
    requireRuntimeLogWrite(crossRun.emitState({
      traceId: `producer:${runId}`,
      owner: "app-shell",
      stateKey: "producer.alive",
      previous: null,
      current: "alive",
      freshForMs: 60_000,
    }));
    requireRuntimeLogWrite(crossRun.emitState({
      traceId: "cross-run-job",
      stateKey: "job.lifecycle",
      previous: null,
      current: runId === "cross-run-a" ? "accepted" : "running",
    }));
  }
  const crossRunDiagnosis = diagnoseRuntimeLog({ sources: [root], traceId: "cross-run-job" });
  assert.equal(crossRunDiagnosis.currentStates["job.lifecycle"]?.value, "UNKNOWN_ORDER");
  assert.ok(crossRunDiagnosis.findings.includes("STATE_CROSS_RUN_ORDER_UNRESOLVED:job.lifecycle"));

  const oldAuthorityRun = createRuntimeLogger({
    producer: "reconciliation-producer", producerRunId: "reconciliation-old", owner: "production-runtime",
    component: "production-runtime", terminalEnabled: false,
    fileSink: { directoryPath: root, maxTotalBytes: 1_048_576 },
  });
  requireRuntimeLogWrite(oldAuthorityRun.emitState({
    traceId: "reconciliation-job", stateKey: "job.lifecycle", previous: null, current: "recovery_pending",
    authorityRef: "production-task:reconciliation-job", authorityHash: digest("reconciliation-job"),
  }));
  const currentAuthorityRun = createRuntimeLogger({
    producer: "reconciliation-producer", producerRunId: "reconciliation-current", owner: "production-runtime",
    component: "production-runtime", terminalEnabled: false,
    fileSink: { directoryPath: root, maxTotalBytes: 1_048_576 },
  });
  requireRuntimeLogWrite(currentAuthorityRun.emitState({
    traceId: "producer:reconciliation-current", owner: "app-shell",
    stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000,
  }));
  const pendingReconciliation = diagnoseRuntimeLog({
    sources: [root], traceId: "reconciliation-job", authorityResolver: () => "verified",
  });
  assert.equal(pendingReconciliation.status, "DIAGNOSIS_INCOMPLETE");
  assert.equal(pendingReconciliation.currentStates["job.lifecycle"]?.value, "UNKNOWN_STALE");
  assert.ok(pendingReconciliation.findings.includes(
    "AUTHORITY_RECONCILIATION_PENDING:production-task:reconciliation-job",
  ));

  const stale = diagnoseRuntimeLog({
    sources: [root],
    traceId: "job-atomic-log",
    now: new Date(Date.now() + 120_000),
    authorityResolver: () => "verified",
  });
  assert.equal(stale.status, "DIAGNOSIS_INCOMPLETE");
  assert.equal(stale.currentStates["job.lifecycle"]?.value, "recovery_pending");
  assert.equal(stale.currentStates["job.lifecycle"]?.fresh, true);
  assert.equal(stale.currentStates["producer.alive:runtime-log-acceptance"]?.value, "UNKNOWN_STALE");
  assert.ok(stale.findings.some((item) => item.startsWith("PRODUCER_STALE:")));

  writeFileSync(segmentPath!, original.replace('"producerSeq":1', '"producerSeq":2'));
  const corrupted = diagnoseRuntimeLog({
    sources: [root],
    traceId: "job-atomic-log",
    authorityResolver: () => "verified",
  });
  assert.equal(corrupted.status, "DIAGNOSIS_INCOMPLETE");
  assert.ok(corrupted.findings.some((item) => item.startsWith("EVENT_HASH_INVALID:")
    || item.startsWith("PRODUCER_CHAIN_START_INVALID:")));
} finally {
  rmSync(root, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] runtime-log-spine-v2 PASS\n");
for (const [lawId, modes] of [
  ["LAW-RUNTIME-LOG-SPINE-001-V4", ["exam.golden", "exam.property", "exam.state-machine"]],
  ["LAW-RUNTIME-LOG-SPINE-002-V4", ["exam.property"]],
  ["LAW-RUNTIME-LOG-SPINE-003-V5", ["exam.golden", "exam.property", "exam.state-machine"]],
] as const) {
  for (const evidenceMode of modes) emitQualityProofObservation({
    passed: true,
    findings: [],
    lawId,
    evidenceMode,
    clauses: ["forbidden:0", "summary"],
    locator: "acceptance:runtime-log-spine:v2",
    observedValue: "strict SPAN/STATE chain, causal roots, freshness, authority link and corruption fail-close verified",
  });
}
