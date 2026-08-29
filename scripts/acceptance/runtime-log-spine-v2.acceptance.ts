import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  RuntimeFailureImpact,
  RuntimeFailureKind,
  createRuntimeLogger,
  diagnoseRuntimeLog,
  redactRuntimeLogRecord,
  requireRuntimeLogWrite,
  runtimeEventIntegrityValid,
  runtimeFailureFromError,
} from "../../src/lib/runtime-logs/index.js";
import type { RuntimeLogEventV2 } from "../../src/lib/runtime-logs/runtime-event-contract.js";

const digest = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const root = mkdtempSync(path.join(tmpdir(), "runtime-log-v2-"));
const logger = createRuntimeLogger({
  producer: "agent",
  producerRunId: "runtime-log-v2-acceptance",
  owner: "app-shell",
  component: "acceptance",
  terminalEnabled: false,
  fileSink: { directoryPath: root, maxTotalBytes: 2_000_000 },
});

const producerTrace = `producer:${logger.producerRunId}`;
requireRuntimeLogWrite(logger.emitEvent({
  traceId: producerTrace,
  operation: "runtime.start",
  code: "PRODUCER_STARTED",
  typedIdentity: { kind: "producer", producerId: logger.producerRunId },
}));

const traceId = "job-runtime-log-v2";
const rootSpan = requireRuntimeLogWrite(logger.startSpan({
  traceId,
  owner: "product-plugin",
  component: "public-knowledge-article-pipeline",
  operation: "plugin.execute",
  typedIdentity: {
    kind: "plugin-step",
    jobId: traceId,
    attemptId: "attempt-1",
    pluginId: "public-knowledge-article-pipeline",
    stepId: "article.compose",
  },
}));

const browserIdentity = (commandId: string, actionOrdinal: number) => ({
  kind: "browser-command" as const,
  jobId: traceId,
  attemptId: "attempt-1",
  leaseVersion: 1,
  fenceHash: digest("fence"),
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 14,
  commandId,
  capabilityCallId: "browser.dom.click.v1",
  pluginStepId: "article.compose",
  childCapabilityId: "submit_exact_gpt_turn_once",
  actionOrdinal,
});

const emitMutation = (
  commandId: string,
  actionOrdinal: number,
  outcome: "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED",
): void => {
  requireRuntimeLogWrite(logger.emitEvent({
    traceId,
    owner: "browser-session",
    component: "browser-mutation-wal",
    operation: "browser.command",
    code: `BROWSER_MUTATION_${outcome}`,
    typedIdentity: browserIdentity(commandId, actionOrdinal),
    authorityRef: `browser-mutation:${commandId}`,
    authorityHash: digest(`${commandId}:${outcome}`),
    visibility: "TRACE",
  }));
};

const confirmed = requireRuntimeLogWrite(logger.startSpan({
  traceId,
  parentSpanId: rootSpan.spanId,
  owner: "browser-session",
  component: "exact-target",
  operation: "browser.command",
  typedIdentity: browserIdentity("command-confirmed", 1),
}));
emitMutation("command-confirmed", 1, "PREPARED");
emitMutation("command-confirmed", 1, "DISPATCHED");
emitMutation("command-confirmed", 1, "CONFIRMED");
requireRuntimeLogWrite(confirmed.terminal({
  outcome: "succeeded",
  authorityRef: "browser-mutation:command-confirmed",
  authorityHash: digest("command-confirmed:CONFIRMED"),
}));

const rejected = requireRuntimeLogWrite(logger.startSpan({
  traceId,
  parentSpanId: rootSpan.spanId,
  owner: "browser-session",
  component: "exact-target",
  operation: "browser.command",
  typedIdentity: browserIdentity("command-rejected", 2),
}));
emitMutation("command-rejected", 2, "PREPARED");
emitMutation("command-rejected", 2, "DISPATCHED");
emitMutation("command-rejected", 2, "REJECTED");
const rejectedTerminal = requireRuntimeLogWrite(rejected.terminal({
  outcome: "failed",
  authorityRef: "browser-mutation:command-rejected",
  authorityHash: digest("command-rejected:REJECTED"),
  failure: runtimeFailureFromError({
    error: new Error("BROWSER_POSTCONDITION_FAILED"),
    code: "BROWSER_POSTCONDITION_FAILED",
    kind: RuntimeFailureKind.BROWSER,
    responsibleOwner: "browser-session",
    impact: RuntimeFailureImpact.BLOCKING,
  }),
}));
assert.deepEqual(rejected.terminal({ outcome: "succeeded" }), {
  ok: false,
  code: "DUPLICATE_SPAN_TERMINAL",
  emergencyProjected: false,
});

requireRuntimeLogWrite(rootSpan.terminal({
  outcome: "failed",
  failure: runtimeFailureFromError({
    error: new Error("PLUGIN_EXECUTION_FAILED"),
    code: "PLUGIN_EXECUTION_FAILED",
    responsibleOwner: "product-plugin",
    impact: RuntimeFailureImpact.CONSEQUENTIAL,
    causedByEventId: rejectedTerminal.eventId,
  }),
}));

requireRuntimeLogWrite(logger.emitEvent({
  traceId: producerTrace,
  operation: "runtime.shutdown",
  code: "PRODUCER_STOPPED",
  typedIdentity: { kind: "producer", producerId: logger.producerRunId },
}));

const events = readFileSync(logger.currentSegmentPath()!, "utf8").trim().split("\n")
  .map((line) => JSON.parse(line) as RuntimeLogEventV2);
assert.ok(events.every(runtimeEventIntegrityValid));
assert.ok(events.every((event, index) => event.producerSeq === index + 1));
assert.ok(events.every((event) => !("stateKey" in event) && !("recovery" in event)));
assert.deepEqual([...new Set(events.map((event) => event.kind))].sort(), ["event", "span.started", "span.terminal"]);
const lastEvent = events.at(-1);
assert.equal(lastEvent?.kind, "event");
assert.equal(lastEvent?.kind === "event" ? lastEvent.code : null, "PRODUCER_STOPPED");

const latestAuthority = new Map<string, string>([
  ["browser-mutation:command-confirmed", digest("command-confirmed:CONFIRMED")],
  ["browser-mutation:command-rejected", digest("command-rejected:REJECTED")],
]);
const diagnosis = diagnoseRuntimeLog({
  sources: [root],
  traceId,
  authorityResolver: (authorityRef, authorityHash) => latestAuthority.get(authorityRef) === authorityHash
    ? "verified" : "mismatch",
});
assert.equal(diagnosis.status, "DIAGNOSIS_COMPLETE");
assert.deepEqual(diagnosis.blockingRoots.map((failure) => failure.code), ["BROWSER_POSTCONDITION_FAILED"]);
assert.deepEqual(diagnosis.consequentialFailures.map((failure) => failure.code), ["PLUGIN_EXECUTION_FAILED"]);
assert.equal(diagnosis.openSpans.length, 0);
assert.deepEqual(diagnosis.atomicSteps.map((step) => step.observedOutcome), ["CONFIRMED", "REJECTED"]);
assert.deepEqual(diagnosis.atomicSteps.map((step) => step.dispatch), ["dispatched", "dispatched"]);
assert.deepEqual(diagnosis.atomicSteps.map((step) => step.postcondition), ["passed", "failed"]);
assert.equal("currentStates" in diagnosis, false);
assert.equal("recoveries" in diagnosis, false);
assert.equal("mutationState" in diagnosis, false);

const redacted = redactRuntimeLogRecord({
  code: "SAFE_CODE",
  prompt: "secret prompt",
  evidenceRef: "/private/evidence/path",
  nested: { token: "secret-token" },
});
assert.equal(redacted.prompt, "[REDACTED]");
assert.equal(redacted.evidenceRef, "[REDACTED_UNSAFE]");
assert.equal(redacted.nested.token, "[REDACTED]");

const capacityRoot = mkdtempSync(path.join(tmpdir(), "runtime-log-capacity-"));
const capacityLogger = createRuntimeLogger({
  producer: "agent",
  producerRunId: "capacity-run",
  owner: "runtime-logs",
  component: "capacity",
  terminalEnabled: false,
  fileSink: { directoryPath: capacityRoot, maxTotalBytes: 1 },
});
const capacityWrite = capacityLogger.emitEvent({
  traceId: "producer:capacity-run",
  operation: "runtime.start",
  code: "PRODUCER_STARTED",
  typedIdentity: { kind: "producer", producerId: "capacity-run" },
});
assert.equal(capacityWrite.ok, false);
if (!capacityWrite.ok) assert.equal(capacityWrite.code, "RUNTIME_LOG_CAPACITY_BLOCKED");
assert.equal(capacityLogger.isWritable(), false);

process.stdout.write("runtime log spine V2 acceptance: PASS\n");
