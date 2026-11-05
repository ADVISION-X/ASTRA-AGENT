import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RuntimeFailureImpact, RuntimeFailureKind, createRuntimeLogger, diagnoseRuntimeLog,
  requireRuntimeLogWrite, runtimeFailureFromError, type RuntimeLogOwner, type RuntimeOperation } from "../../src/lib/runtime-logs/index.js";
import type { RuntimeTypedIdentity } from "../../src/lib/runtime-logs/runtime-identity-contract.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const digest = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value).digest("hex")}`;
type Scenario = Readonly<{ name: string; code: string; operation: RuntimeOperation; owner: RuntimeLogOwner;
  kind: (typeof RuntimeFailureKind)[keyof typeof RuntimeFailureKind]; nativeCause?: string; httpStatus?: number; identity?: RuntimeTypedIdentity }>;
const browserIdentity: RuntimeTypedIdentity = { kind: "browser-command", jobId: "job-browser", attemptId: "attempt-1",
  leaseVersion: 1, fenceHash: digest("fence"), commandId: "command-browser", capabilityCallId: "browser.dom.click.v1",
  pluginStepId: "step-browser", childCapabilityId: "submit_exact_gpt_turn_once", actionOrdinal: 1 };
const scenarios: readonly Scenario[] = [
  { name: "transport", code: "FETCH_FAILED", operation: "outbox.flush", owner: "outbox", kind: RuntimeFailureKind.TRANSPORT, nativeCause: "ECONNRESET" },
  { name: "authentication", code: "SESSION_STALE", operation: "gpt.child", owner: "gpt", kind: RuntimeFailureKind.AUTHENTICATION },
  { name: "contract", code: "FENCE_HASH_MISMATCH", operation: "job.checkpoint", owner: "production-runtime", kind: RuntimeFailureKind.CONTRACT },
  { name: "storage", code: "CHECKPOINT_STORAGE_FAILED", operation: "job.checkpoint", owner: "production-runtime", kind: RuntimeFailureKind.STORAGE },
  { name: "provider", code: "PROVIDER_REJECTED", operation: "gpt.child", owner: "gpt", kind: RuntimeFailureKind.PROVIDER, httpStatus: 409 },
  { name: "browser", code: "BROWSER_COMMAND_RECEIPT_MISSING", operation: "browser.command", owner: "browser-session", kind: RuntimeFailureKind.BROWSER, identity: browserIdentity },
];
const directories: string[] = [];
const loggerFor = (name: string, owner: RuntimeLogOwner) => {
  const directory = mkdtempSync(join(tmpdir(), `log-matrix-${name}-`)); directories.push(directory);
  return { directory, logger: createRuntimeLogger({ producer: "agent", producerRunId: name, owner,
    component: "failure-matrix", terminalEnabled: false, fileSink: { directoryPath: directory, maxTotalBytes: 1_000_000 } }) };
};
try {
  for (const scenario of scenarios) {
    const { directory, logger } = loggerFor(scenario.name, scenario.owner);
    const traceId = scenario.identity && "jobId" in scenario.identity ? scenario.identity.jobId : `job-${scenario.name}`;
    const span = requireRuntimeLogWrite(logger.startSpan({ traceId, operation: scenario.operation,
      typedIdentity: scenario.identity ?? { kind: "job", jobId: traceId } }));
    requireRuntimeLogWrite(span.terminal({ outcome: "failed", failure: runtimeFailureFromError({
      error: new Error(scenario.nativeCause ?? scenario.code), code: scenario.code, responsibleOwner: scenario.owner,
      kind: scenario.kind, impact: RuntimeFailureImpact.BLOCKING,
      ...(scenario.httpStatus === undefined ? {} : { httpStatus: scenario.httpStatus }) }) }));
    const diagnosis = diagnoseRuntimeLog({ sources: [directory], traceId });
    assert.deepEqual(diagnosis.blockingRoots.map(row => row.code), [scenario.code]);
    assert.equal(diagnosis.blockingRoots[0]?.kind, scenario.kind); assert.equal(diagnosis.blockingRoots[0]?.responsibleOwner, scenario.owner);
    assert.equal("recovery" in diagnosis.blockingRoots[0]!, false); assert.equal("currentStates" in diagnosis, false);
  }
  const { directory, logger } = loggerFor("causal", "production-runtime"), traceId = "job-causal";
  const terminalRefs: string[] = [];
  for (const checkpointId of ["first", "repeated"]) {
    const span = requireRuntimeLogWrite(logger.startSpan({ traceId, operation: "job.checkpoint",
      typedIdentity: { kind: "checkpoint", jobId: traceId, attemptId: "attempt-1", checkpointId } }));
    terminalRefs.push(requireRuntimeLogWrite(span.terminal({ outcome: "failed", failure: runtimeFailureFromError({
      error: new Error("CHECKPOINT_STORAGE_FAILED"), code: "CHECKPOINT_STORAGE_FAILED", responsibleOwner: "production-runtime",
      impact: RuntimeFailureImpact.BLOCKING }) })).eventId);
  }
  const cleanup = requireRuntimeLogWrite(logger.startSpan({ traceId, operation: "job.lease-release",
    typedIdentity: { kind: "job-attempt", jobId: traceId, attemptId: "attempt-1" } }));
  requireRuntimeLogWrite(cleanup.terminal({ outcome: "failed", failure: runtimeFailureFromError({ error: new Error("LEASE_RELEASE_FAILED"),
    code: "LEASE_RELEASE_FAILED", responsibleOwner: "production-runtime", impact: RuntimeFailureImpact.CLEANUP, causedByEventId: terminalRefs[0]! }) }));
  const diagnosis = diagnoseRuntimeLog({ sources: [directory], traceId });
  assert.deepEqual(diagnosis.blockingRoots.map(row => row.code), ["CHECKPOINT_STORAGE_FAILED"]);
  assert.equal(diagnosis.blockingRoots[0]?.count, 2); assert.deepEqual(diagnosis.blockingRoots[0]?.eventRefs, terminalRefs);
  assert.deepEqual(diagnosis.cleanupFailures.map(row => row.code), ["LEASE_RELEASE_FAILED"]);
  const wal = loggerFor("wal", "browser-session");
  for (const state of ["PREPARED", "DISPATCHED"] as const) requireRuntimeLogWrite(wal.logger.emitEvent({ traceId: "job-browser",
    operation: "browser.command", code: `BROWSER_MUTATION_${state}`, typedIdentity: browserIdentity,
    authorityRef: "browser-mutation:command-browser", authorityHash: digest(state) }));
  const walDiagnosis = diagnoseRuntimeLog({ sources: [wal.directory], traceId: "job-browser",
    authorityResolver: (_ref, hash) => hash === digest("DISPATCHED") ? "verified" : "mismatch" });
  assert.equal(walDiagnosis.observedEvents.at(-1)?.code, "BROWSER_MUTATION_DISPATCHED");
  assert.equal("mutationState" in walDiagnosis, false); assert.equal("recoveries" in walDiagnosis, false);
  for (const nativeCode of ["NO_LAYOUT_BOX", "SUBMIT_BUTTON_DISABLED", "COMPOSER_DOM_DISABLED"]) {
    const error = new Error("OUTER", { cause: new Error("MIDDLE", { cause: Object.assign(new Error("native"), { code: nativeCode }) }) });
    const failure = runtimeFailureFromError({ error, code: "BROWSER_POSTCONDITION_FAILED", responsibleOwner: "browser-session" });
    assert.equal(failure.nativeCause, nativeCode);
  }
  for (const invalid of ["ARBITRARY_NATIVE", "pointer hint NO_LAYOUT_BOX", "NO_LAYOUT_BOX_EXTRA"]) {
    const failure = runtimeFailureFromError({ error: Object.assign(new Error(invalid), { code: invalid }),
      code: "BROWSER_POSTCONDITION_FAILED", responsibleOwner: "browser-session" });
    assert.equal(failure.nativeCause, undefined);
  }
  const cyclic = new Error("NO_LAYOUT_BOX"); Object.defineProperty(cyclic, "cause", { value: cyclic });
  assert.equal(runtimeFailureFromError({ error: cyclic, code: "BROWSER_POSTCONDITION_FAILED", responsibleOwner: "browser-session" }).nativeCause, "NO_LAYOUT_BOX");
} finally { for (const directory of directories) rmSync(directory, { recursive: true, force: true }); }
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-003-V1", evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:7", "summary"],
  locator: "acceptance:runtime-log:failure-matrix-golden", observedValue: "typed failures preserve their Owner, identity and causal terminal event" });
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-003-V1", evidenceMode: "exam.property",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:3", "forbidden:4", "forbidden:6", "forbidden:7", "summary"],
  locator: "acceptance:runtime-log:failure-matrix-properties", observedValue: "nested native causes, exact closed codes, cycle protection and WAL authority variants exercised" });
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-003-V1", evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "forbidden:5", "forbidden:6", "forbidden:7", "summary"],
  locator: "acceptance:runtime-log:producer-state-machine", observedValue: "duplicate blocking terminals remain causal evidence; cleanup and unknown dispatch do not fabricate recovery" });
console.log("runtime log failure matrix exercised");
