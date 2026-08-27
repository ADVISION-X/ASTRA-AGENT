import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  RuntimeFailureImpact,
  RuntimeFailureKind,
  RuntimeRecovery,
  createRuntimeLogger,
  diagnoseRuntimeLog,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  type RuntimeLogOwner,
  type RuntimeOperation,
  type RuntimeRecovery as RuntimeRecoveryValue,
  type RuntimeStateInput,
} from "../../src/lib/runtime-logs/index.js";
import { executionFailure, failureCode } from "../../src/lib/typed-failure.js";

const digest = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const withRoot = <T>(name: string, run: (root: string) => T): T => {
  const root = mkdtempSync(path.join(tmpdir(), `runtime-log-matrix-${name}-`));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
};

const loggerFor = (root: string, name: string) => createRuntimeLogger({
  producer: "runtime-log-matrix",
  producerRunId: `matrix-${name}`,
  owner: "production-runtime",
  component: "failure-matrix",
  terminalEnabled: false,
  fileSink: { directoryPath: root, maxTotalBytes: 4 * 1024 * 1024 },
});

type FailureCase = Readonly<{
  name: string;
  code: string;
  operation: RuntimeOperation;
  owner: RuntimeLogOwner;
  responsibleOwner: RuntimeLogOwner;
  recovery: RuntimeRecoveryValue;
  kind: (typeof RuntimeFailureKind)[keyof typeof RuntimeFailureKind];
  state: Omit<RuntimeStateInput, "traceId">;
  nativeCause?: string;
  httpStatus?: number;
}>;

const failureCases: readonly FailureCase[] = [
  { name: "econnrefused", code: "FETCH_FAILED", nativeCause: "ECONNREFUSED", operation: "cloud.session-open", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.BACKOFF, kind: RuntimeFailureKind.TRANSPORT, state: { stateKey: "cloud.session", previous: null, current: "stale" } },
  { name: "econnreset", code: "FETCH_FAILED", nativeCause: "ECONNRESET", operation: "cloud.session-open", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.RETRY, kind: RuntimeFailureKind.TRANSPORT, state: { stateKey: "cloud.session", previous: null, current: "stale" } },
  { name: "etimedout", code: "PROVIDER_TIMEOUT", nativeCause: "ETIMEDOUT", operation: "gpt.child", owner: "gpt", responsibleOwner: "gpt", recovery: RuntimeRecovery.RETRY, kind: RuntimeFailureKind.TRANSPORT, state: { owner: "gpt", stateKey: "gpt.execution", previous: null, current: "failed" } },
  { name: "http-auth", code: "HTTP_401_UNAUTHORIZED", httpStatus: 401, operation: "cloud.session-open", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.REVIEW, kind: RuntimeFailureKind.AUTHENTICATION, state: { stateKey: "cloud.contract", previous: null, current: "blocked" } },
  { name: "business-reject", code: "CLAIM_BLOCKED", operation: "cloud.claim", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.BACKOFF, kind: RuntimeFailureKind.ADMISSION, state: { stateKey: "claim.admission", previous: null, current: "blocked" } },
  { name: "session-stale", code: "SESSION_STALE", operation: "cloud.session-open", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.RETRY, kind: RuntimeFailureKind.AUTHENTICATION, state: { stateKey: "cloud.session", previous: null, current: "stale" } },
  { name: "lease-stale", code: "LEASE_STALE", operation: "job.execute", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.REVIEW, kind: RuntimeFailureKind.ADMISSION, state: { stateKey: "job.lease", previous: null, current: "stale" } },
  { name: "fence-mismatch", code: "FENCE_HASH_MISMATCH", operation: "job.execute", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.REVIEW, kind: RuntimeFailureKind.CONTRACT, state: { stateKey: "job.lease", previous: null, current: "lost" } },
  { name: "target-drift", code: "BROWSER_TARGET_DRIFT", operation: "browser.command", owner: "browser-session", responsibleOwner: "browser-session", recovery: RuntimeRecovery.REVIEW, kind: RuntimeFailureKind.BROWSER, state: { owner: "browser-session", stateKey: "browser.target", previous: null, current: "drifted" } },
  { name: "mutation-unknown", code: "BROWSER_OUTCOME_UNKNOWN", operation: "browser.command", owner: "browser-session", responsibleOwner: "browser-session", recovery: RuntimeRecovery.REVIEW, kind: RuntimeFailureKind.BROWSER, state: { owner: "browser-session", stateKey: "browser.mutation", previous: null, current: "UNKNOWN", authorityRef: "browser-mutation:matrix-command", authorityHash: digest("matrix-command-unknown") } },
  { name: "provider-reject", code: "PROVIDER_REJECTED", operation: "gpt.child", owner: "gpt", responsibleOwner: "gpt", recovery: RuntimeRecovery.REVIEW, kind: RuntimeFailureKind.PROVIDER, state: { owner: "gpt", stateKey: "gpt.execution", previous: null, current: "review_required" } },
  { name: "checkpoint-failed", code: "CHECKPOINT_STORAGE_FAILED", operation: "job.checkpoint", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.RETRY, kind: RuntimeFailureKind.STORAGE, state: { stateKey: "job.checkpoint", previous: null, current: "failed" } },
  { name: "renew-failed", code: "LEASE_RENEW_TIMEOUT", nativeCause: "ETIMEDOUT", operation: "job.lease-renew", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.RETRY, kind: RuntimeFailureKind.TRANSPORT, state: { stateKey: "job.lease", previous: null, current: "stale" } },
  { name: "upload-failed", code: "UPLOAD_STORAGE_FAILED", operation: "result.upload", owner: "production-runtime", responsibleOwner: "production-runtime", recovery: RuntimeRecovery.RETRY, kind: RuntimeFailureKind.STORAGE, state: { owner: "outbox", stateKey: "outbox.delivery", previous: null, current: "failed", authorityRef: "outbox:matrix-upload", authorityHash: digest("matrix-upload-failed") } },
  { name: "website-not-consumed", code: "WEBSITE_RESULT_NOT_CONSUMED", operation: "website.result-consume", owner: "website", responsibleOwner: "website", recovery: RuntimeRecovery.RETRY, kind: RuntimeFailureKind.DEPENDENCY, state: { owner: "website", stateKey: "website.consume", previous: null, current: "failed" } },
];

assert.deepEqual(runtimeFailureFromError({
  error: new Error("customer@example.com private failure text"),
  responsibleOwner: "production-runtime",
}), {
  kind: RuntimeFailureKind.INTERNAL,
  code: "INTERNAL_FAILURE",
  responsibleOwner: "production-runtime",
  impact: RuntimeFailureImpact.BLOCKING,
  recovery: RuntimeRecovery.STOP,
});

const nestedTransport = executionFailure("recovery_pending", "CLOUD_TRANSPORT_UNAVAILABLE", {
  httpStatus: 503,
  cause: new Error("outer transport", {
    cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1"), { code: "ECONNREFUSED" }),
  }),
});
assert.deepEqual(runtimeFailureFromError({
  error: nestedTransport,
  code: failureCode(nestedTransport, "CLOUD_SESSION_OPEN_FAILED"),
  responsibleOwner: "production-runtime",
  recovery: RuntimeRecovery.RETRY,
}), {
  kind: RuntimeFailureKind.TRANSPORT,
  code: "CLOUD_TRANSPORT_UNAVAILABLE",
  responsibleOwner: "production-runtime",
  impact: RuntimeFailureImpact.BLOCKING,
  recovery: RuntimeRecovery.RETRY,
  nativeCause: "ECONNREFUSED",
  httpStatus: 503,
});
assert.equal(failureCode(new Error("customer@example.com private failure text"), "SAFE_FALLBACK"), "SAFE_FALLBACK");

withRoot("failure-code-shape", (root) => {
  const logger = loggerFor(root, "failure-code-shape");
  const span = requireRuntimeLogWrite(logger.startSpan({
    traceId: "failure-code-shape", operation: "job.durable-accept",
    typedIdentity: { kind: "job", jobId: "failure-code-shape" },
  }));
  assert.throws(() => span.terminal({
    outcome: "failed",
    failure: {
      kind: RuntimeFailureKind.INTERNAL,
      code: "customer@example.com",
      responsibleOwner: "production-runtime",
      impact: RuntimeFailureImpact.BLOCKING,
      recovery: RuntimeRecovery.STOP,
    },
  }), /RUNTIME_LOG_EVENT_SCHEMA_INVALID/u);
});

withRoot("state-noop", (root) => {
  const logger = loggerFor(root, "state-noop");
  requireRuntimeLogWrite(logger.emitState({
    traceId: "state-noop", stateKey: "cloud.session", previous: null, current: "connected",
  }));
  assert.throws(() => logger.emitState({
    traceId: "state-noop", stateKey: "cloud.session", previous: "connected", current: "connected",
  }), /RUNTIME_LOG_STATE_NOOP_FORBIDDEN/u);
  requireRuntimeLogWrite(logger.emitState({
    traceId: "producer:matrix-state-noop", owner: "app-shell",
    stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000,
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId: "producer:matrix-state-noop", owner: "app-shell",
    stateKey: "producer.alive", previous: "alive", current: "alive", freshForMs: 60_000,
  }));
});

for (const scenario of failureCases) withRoot(scenario.name, (root) => {
  const logger = loggerFor(root, scenario.name);
  const traceId = `trace-${scenario.name}`;
  requireRuntimeLogWrite(logger.emitState({
    traceId: `producer:${logger.producerRunId}`,
    owner: "app-shell",
    stateKey: "producer.alive",
    previous: null,
    current: "alive",
    freshForMs: 60_000,
  }));
  const success = requireRuntimeLogWrite(logger.startSpan({
    traceId,
    operation: "job.durable-accept",
    typedIdentity: { kind: "job", jobId: traceId },
  }));
  requireRuntimeLogWrite(success.terminal({ outcome: "success" }));
  requireRuntimeLogWrite(logger.emitState({
    traceId, stateKey: "job.lifecycle", previous: null, current: "accepted",
  }));
  const boundaryRequired = ["cloud.claim", "cloud.session-open", "job.execute", "job.terminal", "website.result-consume"].includes(scenario.operation);
  const boundaryId = boundaryRequired ? `boundary-${scenario.name}` : undefined;
  const span = requireRuntimeLogWrite(logger.startSpan({
    traceId,
    operation: scenario.operation,
    owner: scenario.owner,
    ...(boundaryId ? { boundaryId } : {}),
    typedIdentity: scenario.operation === "cloud.claim" || scenario.operation === "cloud.session-open" || scenario.operation === "website.result-consume"
      ? { kind: "request", requestId: boundaryId! }
      : scenario.operation === "browser.command"
        ? { kind: "browser-command", jobId: traceId, attemptId: "attempt-1", leaseVersion: 1, fenceHash: digest("fence"), pluginId: "plugin-1", commandId: `command-${scenario.name}` }
        : scenario.operation === "gpt.child"
          ? { kind: "gpt-call", jobId: traceId, attemptId: "attempt-1", pluginId: "plugin-1", stepId: "step-1", capabilityCallId: `call-${scenario.name}` }
          : scenario.operation === "job.checkpoint"
            ? { kind: "checkpoint", jobId: traceId, attemptId: "attempt-1", checkpointId: "checkpoint-1" }
          : { kind: "lease", jobId: traceId, attemptId: "attempt-1", leaseVersion: 1, fenceHash: digest("fence") },
  }));
  if (scenario.operation === "cloud.session-open") {
    const website = createRuntimeLogger({
      producer: "website",
      producerRunId: `website-${scenario.name}`,
      owner: "website",
      component: "website-v6-route",
      terminalEnabled: false,
      fileSink: { directoryPath: root, maxTotalBytes: 4 * 1024 * 1024 },
    });
    const websiteSpan = requireRuntimeLogWrite(website.startSpan({
      traceId,
      operation: "website.v6-request",
      boundaryId: boundaryId!,
      typedIdentity: { kind: "request", requestId: boundaryId! },
    }));
    requireRuntimeLogWrite(websiteSpan.terminal({ outcome: "success" }));
  }
  const error = new Error(scenario.code, scenario.nativeCause
    ? { cause: Object.assign(new Error(scenario.nativeCause), { code: scenario.nativeCause }) }
    : undefined);
  requireRuntimeLogWrite(span.terminal({
    outcome: scenario.recovery === RuntimeRecovery.REVIEW ? "review_required" : "failed",
    failure: runtimeFailureFromError({
      error,
      code: scenario.code,
      responsibleOwner: scenario.responsibleOwner,
      recovery: scenario.recovery,
      impact: RuntimeFailureImpact.BLOCKING,
      kind: scenario.kind,
      ...(scenario.httpStatus === undefined ? {} : { httpStatus: scenario.httpStatus }),
    }),
  }));
  const leaseAxisRequired = !["cloud.claim", "cloud.session-open", "website.result-consume", "browser.command", "gpt.child", "job.checkpoint"]
    .includes(scenario.operation);
  if (leaseAxisRequired && scenario.state.stateKey !== "job.lease") {
    requireRuntimeLogWrite(logger.emitState({
      traceId, stateKey: "job.lease", previous: null, current: "active",
    }));
  }
  requireRuntimeLogWrite(logger.emitState({ traceId, ...scenario.state } as RuntimeStateInput));
  const diagnosis = diagnoseRuntimeLog({ sources: [root], traceId, authorityResolver: () => "verified" });
  assert.equal(diagnosis.status, "DIAGNOSIS_COMPLETE", scenario.name);
  assert.equal(diagnosis.blockingRoots.length, 1, scenario.name);
  assert.ok(diagnosis.blockingRoots[0]?.eventId, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.operation, scenario.operation, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.code, scenario.code, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.responsibleOwner, scenario.responsibleOwner, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.kind, scenario.kind, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.owner, scenario.owner, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.impact, RuntimeFailureImpact.BLOCKING, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.recovery, scenario.recovery, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.nativeCause, scenario.nativeCause ?? null, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.httpStatus, scenario.httpStatus ?? null, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.causedByEventId, null, scenario.name);
  assert.deepEqual(diagnosis.recoveries, [scenario.recovery], scenario.name);
  assert.equal(diagnosis.lastSuccessfulActions[0]?.operation, "job.durable-accept", scenario.name);
  const stateOutputKey = scenario.state.stateKey === "browser.mutation" || scenario.state.stateKey === "outbox.delivery"
    ? `${scenario.state.stateKey}:${scenario.state.authorityRef ?? traceId}`
    : scenario.state.stateKey;
  assert.equal(diagnosis.currentStates[stateOutputKey]?.value, scenario.state.current, scenario.name);
  assert.equal(diagnosis.currentStates[stateOutputKey]?.owner, scenario.state.owner ?? "production-runtime", scenario.name);
  assert.equal(diagnosis.currentStates[stateOutputKey]?.fresh, true, scenario.name);
  assert.equal(diagnosis.currentStates[stateOutputKey]?.authorityRef, scenario.state.authorityRef ?? null, scenario.name);
  assert.equal(diagnosis.currentStates[stateOutputKey]?.authorityHash, scenario.state.authorityHash ?? null, scenario.name);
  assert.equal(diagnosis.mutationState, scenario.state.stateKey === "browser.mutation" ? "UNKNOWN" : null, scenario.name);
  assert.deepEqual(diagnosis.sideEffects, scenario.state.stateKey === "browser.mutation" ? [{
    authorityRef: scenario.state.authorityRef,
    authorityHash: scenario.state.authorityHash,
    state: scenario.state.current,
    owner: scenario.state.owner,
  }] : [], scenario.name);
  assert.deepEqual(diagnosis.openSpans, [], scenario.name);
  assert.deepEqual(diagnosis.findings, [], scenario.name);
  if (scenario.name === "econnrefused") {
    const missingWebsite = diagnoseRuntimeLog({
      sources: [logger.currentSegmentPath()!], traceId, authorityResolver: () => "verified",
    });
    assert.equal(missingWebsite.status, "DIAGNOSIS_INCOMPLETE");
    assert.ok(missingWebsite.findings.includes(`BOUNDARY_SOURCE_INCOMPLETE:${boundaryId}`));
  }
});

withRoot("active-source-layout", (root) => {
  const logger = loggerFor(root, "active-source-layout");
  requireRuntimeLogWrite(logger.emitState({
    traceId: "layout-trace", owner: "app-shell",
    stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000,
  }));
  writeFileSync(path.join(root, "workbench.jsonl"), "legacy unstructured line\n", "utf8");
  const clean = diagnoseRuntimeLog({ sources: [root], traceId: "layout-trace" });
  assert.equal(clean.status, "DIAGNOSIS_COMPLETE");
  assert.deepEqual(clean.findings, []);
  const invalidProducer = path.join(root, "invalid-producer");
  mkdirSync(invalidProducer);
  const invalidSegment = path.join(invalidProducer, "broken.jsonl");
  writeFileSync(invalidSegment, "not-json\n", "utf8");
  const invalid = diagnoseRuntimeLog({ sources: [root], traceId: "layout-trace" });
  assert.equal(invalid.status, "DIAGNOSIS_INCOMPLETE");
  assert.ok(invalid.findings.includes(`ACTIVE_SEGMENT_NAME_INVALID:${invalidSegment}`));
  assert.ok(invalid.findings.includes(`INVALID_JSONL_LINE:${invalidSegment}:1`));
});

withRoot("failure-causality", (root) => {
  const logger = loggerFor(root, "failure-causality");
  const traceId = "trace-failure-causality";
  requireRuntimeLogWrite(logger.emitState({
    traceId: `producer:${logger.producerRunId}`, owner: "app-shell",
    stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000,
  }));
  const rootSpan = requireRuntimeLogWrite(logger.startSpan({
    traceId, operation: "job.execute", boundaryId: "boundary-causality",
    typedIdentity: { kind: "lease", jobId: traceId, attemptId: "attempt-1", leaseVersion: 1, fenceHash: digest("fence") },
  }));
  const rootFailure = requireRuntimeLogWrite(rootSpan.terminal({
    outcome: "failed",
    failure: runtimeFailureFromError({
      error: new Error("EXECUTION_BLOCKED"), responsibleOwner: "production-runtime",
      code: "EXECUTION_BLOCKED",
      recovery: RuntimeRecovery.STOP, impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
  const cleanupSpan = requireRuntimeLogWrite(logger.startSpan({
    traceId, operation: "runtime.shutdown",
    typedIdentity: { kind: "producer", producerId: logger.producerRunId },
  }));
  requireRuntimeLogWrite(cleanupSpan.terminal({
    outcome: "failed",
    failure: runtimeFailureFromError({
      error: new Error("SHUTDOWN_FAILED"), responsibleOwner: "production-runtime",
      code: "SHUTDOWN_FAILED",
      recovery: RuntimeRecovery.REVIEW, impact: RuntimeFailureImpact.CLEANUP,
      causedByEventId: rootFailure.eventId,
    }),
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId, stateKey: "job.lifecycle", previous: null, current: "failed",
  }));
  requireRuntimeLogWrite(logger.emitState({
    traceId, stateKey: "job.lease", previous: null, current: "lost",
  }));
  const diagnosis = diagnoseRuntimeLog({ sources: [root], traceId });
  assert.equal(diagnosis.status, "DIAGNOSIS_COMPLETE");
  assert.equal(diagnosis.blockingRoots.length, 1);
  assert.equal(diagnosis.cleanupFailures.length, 1);
  assert.ok(diagnosis.cleanupFailures[0]?.eventId);
  assert.equal(diagnosis.cleanupFailures[0]?.operation, "runtime.shutdown");
  assert.equal(diagnosis.cleanupFailures[0]?.owner, "production-runtime");
  assert.equal(diagnosis.cleanupFailures[0]?.responsibleOwner, "production-runtime");
  assert.equal(diagnosis.cleanupFailures[0]?.kind, RuntimeFailureKind.INTERNAL);
  assert.equal(diagnosis.cleanupFailures[0]?.code, "SHUTDOWN_FAILED");
  assert.equal(diagnosis.cleanupFailures[0]?.nativeCause, null);
  assert.equal(diagnosis.cleanupFailures[0]?.impact, RuntimeFailureImpact.CLEANUP);
  assert.equal(diagnosis.cleanupFailures[0]?.recovery, RuntimeRecovery.REVIEW);
  assert.equal(diagnosis.cleanupFailures[0]?.causedByEventId, rootFailure.eventId);
  assert.deepEqual(diagnosis.consequentialFailures, []);
});

withRoot("empty-claim", (root) => {
  const logger = loggerFor(root, "empty-claim");
  requireRuntimeLogWrite(logger.emitState({ traceId: "producer:matrix-empty-claim", owner: "app-shell", stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000 }));
  const span = requireRuntimeLogWrite(logger.startSpan({ traceId: "empty-claim", operation: "cloud.claim", boundaryId: "claim-empty", typedIdentity: { kind: "request", requestId: "claim-empty" } }));
  requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
  requireRuntimeLogWrite(logger.emitState({ traceId: "empty-claim", stateKey: "claim.admission", previous: null, current: "eligible" }));
  const diagnosis = diagnoseRuntimeLog({ sources: [root], traceId: "empty-claim" });
  assert.equal(diagnosis.status, "DIAGNOSIS_COMPLETE");
  assert.deepEqual(diagnosis.blockingRoots, []);
  assert.deepEqual(diagnosis.recoveries, []);
  assert.equal(diagnosis.lastSuccessfulActions[0]?.operation, "cloud.claim");
  assert.equal(diagnosis.currentStates["claim.admission"]?.value, "eligible");
});

withRoot("authority-reconcile", (root) => {
  const logger = loggerFor(root, "authority-reconcile");
  requireRuntimeLogWrite(logger.emitState({ traceId: "producer:matrix-authority-reconcile", owner: "app-shell", stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000 }));
  const before = diagnoseRuntimeLog({ sources: [root], traceId: "authority-job", authorityResolver: () => "verified" });
  assert.equal(before.status, "DIAGNOSIS_INCOMPLETE");
  assert.ok(before.findings.includes("TRACE_NOT_FOUND:authority-job"));
  requireRuntimeLogWrite(logger.emitState({ traceId: "authority-job", stateKey: "job.lifecycle", previous: null, current: "recovery_pending", authorityRef: "authority:job", authorityHash: digest("authority-job"), reconciledFromAuthority: true }));
  const reconciled = diagnoseRuntimeLog({ sources: [root], traceId: "authority-job", authorityResolver: () => "verified" });
  assert.equal(reconciled.status, "DIAGNOSIS_COMPLETE");
  assert.equal(reconciled.currentStates["job.lifecycle"]?.value, "recovery_pending");
  const mismatch = diagnoseRuntimeLog({ sources: [root], traceId: "authority-job", authorityResolver: () => "mismatch" });
  assert.equal(mismatch.status, "DIAGNOSIS_INCOMPLETE");
  assert.ok(mismatch.findings.includes("AUTHORITY_STATE_MISMATCH:authority:job"));
});

withRoot("sink-capacity", (root) => {
  const logger = createRuntimeLogger({ producer: "capacity", producerRunId: "capacity-run", owner: "runtime-logs", component: "capacity", terminalEnabled: false, fileSink: { directoryPath: root, maxTotalBytes: 1 } });
  const write = logger.emitState({ traceId: "capacity", stateKey: "log.sink", previous: null, current: "ready" });
  assert.equal(write.ok, false);
  if (!write.ok) assert.equal(write.code, "RUNTIME_LOG_CAPACITY_BLOCKED");
  assert.equal(logger.getSinkState(), "capacity_blocked");
  assert.equal(logger.isWritable(), false);
});

const writeRecoveredRun = (root: string, producer: string, includeCheckpoint: boolean): string => {
  const logger = createRuntimeLogger({
    producer, producerRunId: "recovered-run", owner: "app-shell", component: "capacity-reconciliation",
    terminalEnabled: false, fileSink: { directoryPath: root, maxTotalBytes: 1024 * 1024 },
  });
  const producerTraceId = `producer:${logger.producerRunId}`;
  requireRuntimeLogWrite(logger.emitState({ traceId: producerTraceId, stateKey: "producer.lifecycle", previous: null, current: "starting" }));
  requireRuntimeLogWrite(logger.emitState({ traceId: "recovered-job", stateKey: "job.lifecycle", previous: null, current: "recovery_pending", authorityRef: "production-task:recovered-job", authorityHash: digest("task"), reconciledFromAuthority: true }));
  requireRuntimeLogWrite(logger.emitState({ traceId: "recovered-job", stateKey: "job.lease", previous: null, current: "stale", authorityRef: "production-lease:recovered-job", authorityHash: digest("lease"), reconciledFromAuthority: true }));
  if (includeCheckpoint) {
    requireRuntimeLogWrite(logger.emitState({ traceId: "recovered-job", stateKey: "job.checkpoint", previous: null, current: "persisted", authorityRef: "production-checkpoint:recovered-job", authorityHash: digest("checkpoint"), reconciledFromAuthority: true }));
  }
  requireRuntimeLogWrite(logger.emitState({ traceId: "recovered-job", stateKey: "job.lifecycle", previous: "recovery_pending", current: "failed", authorityRef: "production-task:recovered-job", authorityHash: digest("task-failed") }));
  requireRuntimeLogWrite(logger.emitState({ traceId: producerTraceId, stateKey: "producer.lifecycle", previous: "starting", current: "ready" }));
  requireRuntimeLogWrite(logger.emitState({ traceId: producerTraceId, stateKey: "producer.lifecycle", previous: "ready", current: "stopping" }));
  requireRuntimeLogWrite(logger.emitState({ traceId: producerTraceId, stateKey: "producer.lifecycle", previous: "stopping", current: "stopped" }));
  return logger.currentSegmentPath()!;
};

withRoot("capacity-protects-unreconciled-run", (root) => {
  const oldPath = writeRecoveredRun(root, "capacity-protected", false);
  const logger = createRuntimeLogger({
    producer: "capacity-protected", producerRunId: "current-run", owner: "runtime-logs", component: "capacity",
    terminalEnabled: false, fileSink: { directoryPath: root, maxTotalBytes: 1_500 },
  });
  const write = logger.emitState({ traceId: "current", stateKey: "log.sink", previous: null, current: "ready" });
  assert.equal(write.ok, false);
  assert.equal(existsSync(oldPath), true);
});

withRoot("capacity-deletes-reconciled-run", (root) => {
  const oldPath = writeRecoveredRun(root, "capacity-reconciled", true);
  const logger = createRuntimeLogger({
    producer: "capacity-reconciled", producerRunId: "current-run", owner: "runtime-logs", component: "capacity",
    terminalEnabled: false, fileSink: { directoryPath: root, maxTotalBytes: 1_500 },
  });
  const write = logger.emitState({ traceId: "current", stateKey: "log.sink", previous: null, current: "ready" });
  assert.equal(write.ok, true);
  assert.equal(existsSync(oldPath), false);
});

withRoot("boundary-retry", (root) => {
  const logger = loggerFor(root, "boundary-retry");
  requireRuntimeLogWrite(logger.emitState({ traceId: "producer:matrix-boundary-retry", owner: "app-shell", stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000 }));
  const identity = { kind: "lease" as const, jobId: "boundary-job", attemptId: "attempt-1", leaseVersion: 1, fenceHash: digest("fence") };
  requireRuntimeLogWrite(logger.emitState({ traceId: "boundary-job", stateKey: "job.lifecycle", previous: null, current: "completed" }));
  requireRuntimeLogWrite(logger.emitState({ traceId: "boundary-job", stateKey: "job.lease", previous: null, current: "absent" }));
  for (const boundaryId of ["claim-1", "claim-2"]) {
    const span = requireRuntimeLogWrite(logger.startSpan({ traceId: "boundary-job", operation: "job.execute", boundaryId, typedIdentity: identity }));
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
  }
  const diagnosis = diagnoseRuntimeLog({ sources: [root], traceId: "boundary-job" });
  assert.equal(diagnosis.status, "DIAGNOSIS_INCOMPLETE");
  assert.ok(diagnosis.findings.some((item) => item.startsWith("BOUNDARY_RETRY_MISMATCH:")));
});

process.stdout.write("[ACCEPTANCE] runtime-log-spine-failure-matrix PASS\n");
