import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  RuntimeFailureImpact,
  RuntimeFailureKind,
  createRuntimeLogger,
  diagnoseRuntimeLog,
  discoverRuntimeLogScope,
  redactRuntimeLogRecord,
  requireRuntimeLogWrite,
  runtimeEventIntegrityValid,
  runtimeFailureFromError,
} from "../../src/lib/runtime-logs/index.js";
import type { RuntimeLogEventV2, RuntimeSpanFailureEvent, RuntimeSpanTerminalEvent } from
  "../../src/lib/runtime-logs/runtime-event-contract.js";
import { shouldProjectRuntimeEvent } from "../../src/lib/runtime-logs/sinks.js";
import { BrowserRuntimeLogEmitter } from "../../src/lib/browser/infrastructure/browser-runtime-log-emitter.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { emitBrowserCommandDiagnostic } from "../../src/lib/browser/exact-target/browser-command-runtime-logging.js";
import { permit } from "./local-browser-terminal-fixture.js";

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
assert.equal(diagnosis.blockingRoots[0]?.count, 1);
assert.deepEqual(diagnosis.blockingRoots[0]?.eventRefs, [diagnosis.blockingRoots[0]?.eventId]);
assert.equal(diagnosis.blockingRoots[0]?.firstSeenAt, diagnosis.blockingRoots[0]?.lastSeenAt);


const exerciseCrossRunMutationTerminal = (): void => {
  const directory = mkdtempSync(path.join(tmpdir(), "runtime-log-cross-run-"));
  const previous = createRuntimeLogger({ producer: "agent", producerRunId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    owner: "browser-session", component: "browser-mutation-wal", terminalEnabled: false,
    fileSink: { directoryPath: directory, maxTotalBytes: 2_000_000 } });
  const current = createRuntimeLogger({ producer: "agent", producerRunId: "00000000-0000-4000-8000-000000000001",
    owner: "browser-session", component: "browser-mutation-wal", terminalEnabled: false,
    fileSink: { directoryPath: directory, maxTotalBytes: 2_000_000 } });
  for (const writer of [previous, current]) requireRuntimeLogWrite(writer.emitEvent({
    traceId: `producer:${writer.producerRunId}`, operation: "runtime.start", code: "PRODUCER_STARTED",
    typedIdentity: { kind: "producer", producerId: writer.producerRunId } }));
  const commandIds = ["reconnect-confirmed", "reconnect-rejected", "reconnect-missing"];
  const expected = new Map<string, string>();
  for (const [ordinal, commandId] of commandIds.entries()) {
    const typedIdentity = browserIdentity(commandId, ordinal + 10);
    requireRuntimeLogWrite(previous.startSpan({ traceId, operation: "browser.command", typedIdentity }));
    for (const outcome of ["PREPARED", "DISPATCHED"]) requireRuntimeLogWrite(previous.emitEvent({
      traceId, operation: "browser.command", code: `BROWSER_MUTATION_${outcome}`, typedIdentity,
      authorityRef: `browser-mutation:${commandId}`, authorityHash: digest(`${commandId}:${outcome}`) }));
    const outcome = ordinal === 0 ? "CONFIRMED" : ordinal === 1 ? "REJECTED" : null;
    if (outcome) requireRuntimeLogWrite(current.emitEvent({ traceId, operation: "browser.command",
      code: `BROWSER_MUTATION_${outcome}`, typedIdentity,
      authorityRef: `browser-mutation:${commandId}`, authorityHash: digest(`${commandId}:${outcome}`) }));
    expected.set(`browser-mutation:${commandId}`, digest(`${commandId}:${outcome ?? "DISPATCHED"}`));
  }
  const resolver = (ref: string, hash: `sha256:${string}`) => expected.get(ref) === hash ? "verified" as const : "mismatch" as const;
  const recovered = diagnoseRuntimeLog({ sources: [directory], traceId, authorityResolver: resolver });
  assert.equal(recovered.status, "DIAGNOSIS_INCOMPLETE", "recovered WAL must not fabricate old span terminals");
  assert.deepEqual(recovered.atomicSteps.map(step => step.observedOutcome), ["CONFIRMED", "REJECTED", "DISPATCHED"]);
  assert.deepEqual(recovered.atomicSteps.map(step => step.postcondition), ["passed", "failed", "pending_reconciliation"]);
  assert.ok(recovered.atomicSteps.every(step => step.terminalEventId === null));
  assert.equal(recovered.openSpans.length, 3);
  assert.equal(recovered.interruptedSpans.length, 0);
  assert.ok(recovered.findings.includes(`PRODUCER_STALE:${previous.producerRunId}`));
  requireRuntimeLogWrite(previous.emitEvent({ traceId, operation: "runtime.shutdown", code: "PRODUCER_STOPPED",
    typedIdentity: { kind: "producer", producerId: previous.producerRunId } }));
  const interrupted = diagnoseRuntimeLog({ sources: [directory], traceId, authorityResolver: resolver });
  assert.equal(interrupted.interruptedSpans.length, 3);
  assert.deepEqual(interrupted.atomicSteps.map(step => step.observedOutcome), ["CONFIRMED", "REJECTED", "DISPATCHED"]);
  assert.ok(recovered.atomicSteps.every(step => step.authorityHash === expected.get(step.authorityRef!)));
  assert.equal(recovered.findings.some(finding => finding.startsWith("AUTHORITY_CROSS_RUN_ORDER_UNPROVEN:")), false);
  assert.equal(recovered.findings.some(finding => finding.startsWith("AUTHORITY_HASH_MISMATCH:")), false);
  const unverified = diagnoseRuntimeLog({ sources: [directory], traceId });
  assert.ok(unverified.findings.some(finding => finding.startsWith("AUTHORITY_REF_UNVERIFIED:")), "terminal still requires durable authority readback");
  requireRuntimeLogWrite(current.emitEvent({ traceId, operation: "browser.command", code: "BROWSER_MUTATION_REJECTED",
    typedIdentity: browserIdentity(commandIds[0]!, 10), authorityRef: `browser-mutation:${commandIds[0]}`, authorityHash: digest("conflicting-terminal") }));
  const conflict = diagnoseRuntimeLog({ sources: [directory], traceId, authorityResolver: resolver });
  assert.equal(conflict.status, "DIAGNOSIS_INCOMPLETE");
  assert.ok(conflict.findings.includes(`AUTHORITY_TERMINAL_CONFLICT:browser-mutation:${commandIds[0]}`));
};
exerciseCrossRunMutationTerminal();

const discovered = discoverRuntimeLogScope({ sources: [root] });
assert.deepEqual(discovered, { status: "SELECTED", selectedTraceId: traceId,
  candidates: [traceId], completeness: "COMPLETE" });
assert.deepEqual(discoverRuntimeLogScope({ sources: [path.join(root, "missing")] }), {
  status: "SOURCE_UNAVAILABLE", selectedTraceId: null, candidates: [], completeness: "DIAGNOSIS_INCOMPLETE",
});
const segmentPath = logger.currentSegmentPath()!;
const corruptedLines = readFileSync(segmentPath, "utf8").trim().split("\n");
const corrupted = JSON.parse(corruptedLines.at(-1)!) as RuntimeLogEventV2;
corruptedLines[corruptedLines.length - 1] = JSON.stringify({ ...corrupted, eventHash: digest("corrupt") });
writeFileSync(segmentPath, `${corruptedLines.join("\n")}\n`, "utf8");
assert.equal(discoverRuntimeLogScope({ sources: [root] }).completeness, "DIAGNOSIS_INCOMPLETE");

const terminalEvent = events.find((event): event is RuntimeSpanFailureEvent =>
  event.kind === "span.terminal" && event.failure?.code === "BROWSER_POSTCONDITION_FAILED")!;
const traceBlockingEvent: RuntimeSpanFailureEvent = {
  ...terminalEvent,
  producerRunId: "runtime-log-projection-acceptance",
  visibility: "TRACE",
  traceId: "trace-blocking-command",
};
assert.equal(shouldProjectRuntimeEvent(traceBlockingEvent, "FLOW"), true,
  "a first blocking Browser failure must remain visible outside TRACE mode");
const traceConsequentialEvent: RuntimeSpanFailureEvent = {
  ...traceBlockingEvent,
  traceId: "trace-consequential-command",
  failure: { ...traceBlockingEvent.failure!, impact: RuntimeFailureImpact.CONSEQUENTIAL },
};
assert.equal(shouldProjectRuntimeEvent(traceConsequentialEvent, "FLOW"), false,
  "a consequential TRACE event must not bypass normal terminal visibility");
assert.equal(shouldProjectRuntimeEvent(terminalEvent, "FLOW"), true);
assert.equal(shouldProjectRuntimeEvent(terminalEvent, "FLOW"), false);
assert.equal(shouldProjectRuntimeEvent(terminalEvent, "TRACE"), true);
const changedFailure: RuntimeSpanTerminalEvent = { ...terminalEvent,
  outcome: "failed", failure: { ...terminalEvent.failure!, code: "BROWSER_TARGET_NOT_INTERACTIVE" } };
assert.equal(shouldProjectRuntimeEvent(changedFailure, "FLOW"), true);

const secondInvocation: RuntimeSpanFailureEvent = { ...terminalEvent, spanId: "second-independent-invocation" };
assert.equal(shouldProjectRuntimeEvent(secondInvocation, "FLOW"), true, "same job/code with a new atomic span must be visible");
assert.equal(shouldProjectRuntimeEvent(secondInvocation, "FLOW"), false, "a resident invocation retransmission is suppressed");
for (let index = 0; index < 4096; index += 1) {
  assert.equal(shouldProjectRuntimeEvent({ ...secondInvocation, spanId: `eviction-invocation-${index}` }, "FLOW"), true);
}
assert.equal(shouldProjectRuntimeEvent(secondInvocation, "FLOW"), true, "eviction permits redisplay without persistent deduplication");
assert.equal(shouldProjectRuntimeEvent(secondInvocation, "TRACE"), true);

const redacted = redactRuntimeLogRecord({
  code: "SAFE_CODE",
  prompt: "secret prompt",
  evidenceRef: "/private/evidence/path",
  nested: { token: "secret-token" },
});
assert.equal(redacted.prompt, "[REDACTED]");
assert.equal(redacted.evidenceRef, "[REDACTED_UNSAFE]");
assert.equal(redacted.nested.token, "[REDACTED]");

const browserFailureRoot = mkdtempSync(path.join(tmpdir(), "runtime-log-browser-native-code-"));
const browserFailureLogger = createRuntimeLogger({
  producer: "agent",
  producerRunId: "browser-native-code-run",
  owner: "browser-session",
  component: "browser-infrastructure",
  terminalEnabled: false,
  fileSink: { directoryPath: browserFailureRoot },
});
new BrowserRuntimeLogEmitter(browserFailureLogger, () => 7)
  .failure("BROWSER_DOM_CANDIDATE_MISSING", "command-handler");
new BrowserRuntimeLogEmitter(browserFailureLogger, () => 7)
  .failure("BROWSER_DEVTOOLS_CONFLICT", "extension-runtime", "CHROME_DEBUGGER_CANCELED_BY_USER");
emitBrowserCommandDiagnostic(browserFailureLogger, permit("stage-readback"), "target-resolution");
const browserFailureEvents = readFileSync(browserFailureLogger.currentSegmentPath()!, "utf8").trim().split("\n")
  .map((line) => JSON.parse(line) as RuntimeLogEventV2);
assert.equal(browserFailureEvents.length, 3, "controlled command stage is one event, while command-handler remains suppressed");
const stageEvent = browserFailureEvents.find(event => event.kind === "event" && event.code === "BROWSER_COMMAND_DIAGNOSTIC_TARGET_RESOLUTION");
assert(stageEvent?.kind === "event");
assert.equal(stageEvent.typedIdentity.kind, "browser-command");
assert.equal(stageEvent.typedIdentity.kind === "browser-command" ? stageEvent.typedIdentity.commandId : null, "stage-readback");
assert.equal(browserFailureEvents.filter(event => event.kind === "span.terminal" && event.failure).length, 1);
const browserFailureTerminal = browserFailureEvents.find((event) => event.kind === "span.terminal");
assert.equal(browserFailureTerminal?.kind, "span.terminal");
assert.equal(browserFailureTerminal?.kind === "span.terminal"
  ? browserFailureTerminal.failure?.code : null, "BROWSER_DEVTOOLS_CONFLICT");
assert.notEqual(browserFailureTerminal?.kind === "span.terminal"
  ? browserFailureTerminal.failure?.code : null, "BROWSER_INFRASTRUCTURE_FAILED");
assert.equal(browserFailureTerminal?.kind === "span.terminal"
  ? browserFailureTerminal.failure?.nativeCause : null, "CHROME_DEBUGGER_CANCELED_BY_USER");

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
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-001-V7", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"], locator: "acceptance:runtime-log:single-spine-golden", observedValue: "single structured spine recorded full JSONL while terminal projection deduplicated unchanged events" });
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-001-V7", evidenceMode: "exam.property", clauses: ["forbidden:0","forbidden:1","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"], locator: "acceptance:runtime-log:lifecycle-property-matrix", observedValue: "integrity redaction writer capacity authority readability scope discovery and projection variants rejected unsafe states" });
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-001-V7", evidenceMode: "exam.state-machine", clauses: ["forbidden:1","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","forbidden:7","forbidden:8","forbidden:9","summary"], locator: "acceptance:runtime-log:diagnosis-state-machine", observedValue: "started terminal causal aggregation scope discovery and terminal state-change projection exercised" });
