import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  RuntimeFailureImpact,
  RuntimeFailureKind,
  createRuntimeLogger,
  diagnoseRuntimeLog,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  type RuntimeLogOwner,
  type RuntimeOperation,
} from "../../src/lib/runtime-logs/index.js";
import type { RuntimeTypedIdentity } from "../../src/lib/runtime-logs/runtime-identity-contract.js";

const digest = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type Scenario = Readonly<{
  name: string;
  code: string;
  operation: RuntimeOperation;
  owner: RuntimeLogOwner;
  kind: (typeof RuntimeFailureKind)[keyof typeof RuntimeFailureKind];
  nativeCause?: string;
  httpStatus?: number;
  identity?: RuntimeTypedIdentity;
}>;

const scenarios: readonly Scenario[] = [
  { name: "transport", code: "FETCH_FAILED", operation: "outbox.flush", owner: "outbox", kind: RuntimeFailureKind.TRANSPORT, nativeCause: "ECONNRESET" },
  { name: "authentication", code: "SESSION_STALE", operation: "gpt.child", owner: "gpt", kind: RuntimeFailureKind.AUTHENTICATION },
  { name: "contract", code: "FENCE_HASH_MISMATCH", operation: "job.checkpoint", owner: "production-runtime", kind: RuntimeFailureKind.CONTRACT },
  { name: "storage", code: "CHECKPOINT_STORAGE_FAILED", operation: "job.checkpoint", owner: "production-runtime", kind: RuntimeFailureKind.STORAGE },
  { name: "provider", code: "PROVIDER_REJECTED", operation: "gpt.child", owner: "gpt", kind: RuntimeFailureKind.PROVIDER, httpStatus: 409 },
  {
    name: "browser",
    code: "BROWSER_COMMAND_RECEIPT_MISSING",
    operation: "browser.command",
    owner: "browser-session",
    kind: RuntimeFailureKind.BROWSER,
    identity: {
      kind: "browser-command",
      jobId: "job-browser",
      attemptId: "attempt-1",
      leaseVersion: 1,
      fenceHash: digest("fence"),
      pluginId: "plugin",
      commandId: "command-browser",
      capabilityCallId: "browser.dom.click.v1",
      pluginStepId: "step-browser",
      childCapabilityId: "submit_exact_gpt_turn_once",
      actionOrdinal: 1,
    },
  },
];

for (const scenario of scenarios) {
  const root = mkdtempSync(path.join(tmpdir(), `runtime-log-matrix-${scenario.name}-`));
  const traceId = scenario.identity && "jobId" in scenario.identity ? scenario.identity.jobId : `job-${scenario.name}`;
  const logger = createRuntimeLogger({
    producer: "agent",
    producerRunId: `matrix-${scenario.name}`,
    owner: scenario.owner,
    component: "failure-matrix",
    terminalEnabled: false,
    fileSink: { directoryPath: root, maxTotalBytes: 1_000_000 },
  });
  const span = requireRuntimeLogWrite(logger.startSpan({
    traceId,
    operation: scenario.operation,
    typedIdentity: scenario.identity ?? { kind: "job", jobId: traceId },
  }));
  requireRuntimeLogWrite(span.terminal({
    outcome: "failed",
    failure: runtimeFailureFromError({
      error: new Error(scenario.nativeCause ?? scenario.code),
      code: scenario.code,
      responsibleOwner: scenario.owner,
      kind: scenario.kind,
      impact: RuntimeFailureImpact.BLOCKING,
      ...(scenario.httpStatus === undefined ? {} : { httpStatus: scenario.httpStatus }),
    }),
  }));
  const diagnosis = diagnoseRuntimeLog({ sources: [root], traceId });
  assert.deepEqual(diagnosis.blockingRoots.map((failure) => failure.code), [scenario.code], scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.kind, scenario.kind, scenario.name);
  assert.equal(diagnosis.blockingRoots[0]?.responsibleOwner, scenario.owner, scenario.name);
  assert.equal("recovery" in diagnosis.blockingRoots[0]!, false, scenario.name);
  assert.equal("currentStates" in diagnosis, false, scenario.name);
}

const causeRoot = mkdtempSync(path.join(tmpdir(), "runtime-log-cause-matrix-"));
const causeLogger = createRuntimeLogger({
  producer: "agent",
  producerRunId: "cause-matrix",
  owner: "production-runtime",
  component: "failure-matrix",
  terminalEnabled: false,
  fileSink: { directoryPath: causeRoot, maxTotalBytes: 1_000_000 },
});
const causeTrace = "job-cause-matrix";
const blocking = requireRuntimeLogWrite(causeLogger.startSpan({
  traceId: causeTrace,
  operation: "job.checkpoint",
  typedIdentity: { kind: "checkpoint", jobId: causeTrace, attemptId: "attempt-1", checkpointId: "failure" },
}));
const blockingTerminal = requireRuntimeLogWrite(blocking.terminal({
  outcome: "failed",
  failure: runtimeFailureFromError({
    error: new Error("CHECKPOINT_STORAGE_FAILED"),
    code: "CHECKPOINT_STORAGE_FAILED",
    responsibleOwner: "production-runtime",
    impact: RuntimeFailureImpact.BLOCKING,
  }),
}));
const cleanup = requireRuntimeLogWrite(causeLogger.startSpan({
  traceId: causeTrace,
  operation: "job.lease-release",
  typedIdentity: { kind: "job-attempt", jobId: causeTrace, attemptId: "attempt-1" },
}));
requireRuntimeLogWrite(cleanup.terminal({
  outcome: "failed",
  failure: runtimeFailureFromError({
    error: new Error("LEASE_RELEASE_FAILED"),
    code: "LEASE_RELEASE_FAILED",
    responsibleOwner: "production-runtime",
    impact: RuntimeFailureImpact.CLEANUP,
    causedByEventId: blockingTerminal.eventId,
  }),
}));
const causeDiagnosis = diagnoseRuntimeLog({ sources: [causeRoot], traceId: causeTrace });
assert.deepEqual(causeDiagnosis.blockingRoots.map((failure) => failure.code), ["CHECKPOINT_STORAGE_FAILED"]);
assert.deepEqual(causeDiagnosis.cleanupFailures.map((failure) => failure.code), ["LEASE_RELEASE_FAILED"]);

const walRoot = mkdtempSync(path.join(tmpdir(), "runtime-log-wal-matrix-"));
const walLogger = createRuntimeLogger({
  producer: "agent",
  producerRunId: "wal-matrix",
  owner: "browser-session",
  component: "browser-mutation-wal",
  terminalEnabled: false,
  fileSink: { directoryPath: walRoot, maxTotalBytes: 1_000_000 },
});
const walIdentity = scenarios.at(-1)!.identity!;
for (const outcome of ["PREPARED", "DISPATCHED"] as const) {
  requireRuntimeLogWrite(walLogger.emitEvent({
    traceId: "job-browser",
    operation: "browser.command",
    code: `BROWSER_MUTATION_${outcome}`,
    typedIdentity: walIdentity,
    authorityRef: "browser-mutation:command-browser",
    authorityHash: digest(outcome),
  }));
}
const walDiagnosis = diagnoseRuntimeLog({
  sources: [walRoot],
  traceId: "job-browser",
  authorityResolver: (_ref, authorityHash) => authorityHash === digest("DISPATCHED") ? "verified" : "mismatch",
});
assert.equal(walDiagnosis.observedEvents.at(-1)?.code, "BROWSER_MUTATION_DISPATCHED");
assert.equal("mutationState" in walDiagnosis, false);
assert.equal("recoveries" in walDiagnosis, false);

process.stdout.write("runtime log spine failure matrix acceptance: PASS\n");
