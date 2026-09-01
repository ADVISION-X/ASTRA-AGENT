import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { ProductionExecutor } from "../../src/lib/local-runtime/production/executor.js";
import { terminalSpanFailure } from "../../src/lib/local-runtime/production/runtime-logging.js";
import { startProductionRuntime } from "../../src/lib/local-runtime/production/runtime.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import {
  RuntimeFailureImpact,
  createRuntimeLogger,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  withRuntimeLogCause,
  type RuntimeSpanHandle,
} from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, HASH_B, task } from "./agent-production-runtime-fixtures.js";
import "./agent-production-runtime-recovery-contract.acceptance.js";
import "./agent-production-runtime-recovery-resume.acceptance.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-startup-"));
const previousCredentialPath = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = path.join(temporary, "missing-credential.json");
try {
  const browserAuthority = {
    readProductionRuntimeState: () => ({
      browserAuthorityState: "absent" as const,
      browserTargetState: "absent" as const,
    }),
  };
  const blockedShellDirectory = path.join(temporary, "blocked-shell");
  const crashOrphanDirectory = path.join(blockedShellDirectory, "generated-images", "crash-orphan-mutant");
  await mkdir(crashOrphanDirectory, { recursive: true });
  await writeFile(path.join(crashOrphanDirectory, "orphan.original"), "orphan", { mode: 0o600 });
  const blocked = await startProductionRuntime({
    dataDir: blockedShellDirectory,
    sourceHash: HASH_A,
    gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(blockedShellDirectory)),
    browserAuthority: browserAuthority as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-acceptance", owner: "app-shell", component: "production-runtime-acceptance",
      terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
  });
  assert.equal(await readFile(path.join(crashOrphanDirectory, "orphan.original"), "utf8"), "orphan",
    "startup must not erase a potentially recoverable generated-image artifact");
  assert.equal(blocked.readHealth().shellState, "ready");
  assert.equal(blocked.readHealth().cloudState, "contract_blocked");
  assert.equal(blocked.readHealth().executionState, "blocked");
  await blocked.close();
} finally {
  if (previousCredentialPath === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = previousCredentialPath;
  await rm(temporary, { recursive: true, force: true });
}

const remoteClaimLogTemporary = await mkdtemp(path.join(tmpdir(), "agent-remote-claim-log-"));
try {
  const logger = createRuntimeLogger({
    producer: "agent-remote-claim-log", owner: "production-runtime", component: "production-claim",
    terminalEnabled: false, fileSink: { directoryPath: path.join(remoteClaimLogTemporary, "runtime-logs") },
  });
  const span = requireRuntimeLogWrite(logger.startSpan({
    traceId: "producer:remote-claim", boundaryId: "claim:remote-column", owner: "production-runtime",
    component: "production-claim", operation: "cloud.claim",
    typedIdentity: { kind: "request", requestId: "claim:remote-column" },
  }));
  const terminal = terminalSpanFailure(
    span,
    executionFailure("failed", "COLUMN", { httpStatus: 500 }),
    null,
    "CLAIM_REQUEST_FAILED",
    undefined,
    "website",
  );
  assert.equal(terminal.failure?.code, "COLUMN");
  assert.equal(terminal.failure?.httpStatus, 500);
  assert.equal(terminal.failure?.responsibleOwner, "website");
} finally {
  await rm(remoteClaimLogTemporary, { recursive: true, force: true });
}

const pluginFailureTemporary = await mkdtemp(path.join(tmpdir(), "agent-plugin-failure-code-"));
try {
  const pluginFailureLogger = createRuntimeLogger({
    producer: "agent-plugin-failure-acceptance", owner: "production-runtime", component: "executor",
    terminalEnabled: false, fileSink: { directoryPath: path.join(pluginFailureTemporary, "runtime-logs") },
  });
  const pluginFailureStore = new ProductionRuntimeStore(pluginFailureTemporary);
  const executor = new ProductionExecutor(
    pluginFailureStore, pluginFailureLogger,
    {
      dataDir: pluginFailureTemporary, sourceHash: HASH_A,
      gpt: {} as never, evidenceStore: {} as never, browserAuthority: {} as never,
    },
  );
  const terminalizePluginFailure = Reflect.get(executor, "terminalizePluginFailure") as
    (span: RuntimeSpanHandle, error: unknown) => never;
  const startPluginSpan = (stepId: string) => requireRuntimeLogWrite(pluginFailureLogger.startSpan({
    traceId: "job:plugin-failure-code", owner: "product-plugin", component: "public-knowledge-article-pipeline",
    operation: "plugin.execute",
    typedIdentity: {
      kind: "plugin-step", jobId: "job:plugin-failure-code", attemptId: "attempt:plugin-failure-code",
      pluginId: "public-knowledge-article-pipeline", stepId,
    },
  }));

  assert.throws(
    () => terminalizePluginFailure.call(
      executor, startPluginSpan("direct-product-failure"),
      executionFailure("failed", "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID"),
    ),
    /PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID/u,
  );

  const childSpan = requireRuntimeLogWrite(pluginFailureLogger.startSpan({
    traceId: "job:plugin-failure-code", owner: "gpt", component: "gpt-child",
    operation: "gpt.child",
    typedIdentity: {
      kind: "gpt-call", jobId: "job:plugin-failure-code", attemptId: "attempt:plugin-failure-code",
      pluginId: "public-knowledge-article-pipeline", pluginVersion: 1, stepId: "corpus_research",
      capabilityCallId: "call:corpus_research",
    },
  }));
  const childTerminal = requireRuntimeLogWrite(childSpan.terminal({
    outcome: "failed",
    failure: runtimeFailureFromError({
      error: executionFailure("failed", "GPT_CHILD_FAILED"), code: "GPT_CHILD_FAILED",
      responsibleOwner: "gpt", impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
  assert.throws(
    () => terminalizePluginFailure.call(
      executor, startPluginSpan("consequential-product-failure"),
      withRuntimeLogCause(executionFailure("failed", "GPT_CHILD_FAILED"), childTerminal.eventId),
    ),
    /GPT_CHILD_FAILED/u,
  );

  const dispatchFailureTask = task({
    jobId: "job:plugin-primary-with-cleanup-failure",
    productId: "payment_screenshot_observation",
    actionId: "observe",
    materialRefs: [{
      material_id: "material:plugin-primary-payment", ordinal: 0, role: "payment_screenshot",
      display_name: "payment.png", object_ref: "object:plugin-primary-payment", sha256: HASH_A,
      bytes: 10, media_type: "image/png", storage_class: "private_owner_scoped",
      owner_scope_hash: HASH_B, trust_class: "transport_evidence", may_issue_instruction: false,
    }, {
      material_id: "material:plugin-primary-contract", ordinal: 1, role: "result_contract",
      display_name: "contract.json", object_ref: "object:plugin-primary-contract", sha256: HASH_B,
      bytes: 10, media_type: "application/json", storage_class: "private_owner_scoped",
      owner_scope_hash: HASH_A, trust_class: "instruction", may_issue_instruction: true,
    }],
    extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
  });
  const dispatchAttemptId = "attempt:plugin-primary-with-cleanup-failure";
  executor.accept(dispatchFailureTask, dispatchAttemptId);
  const gptChildTools = Reflect.get(executor, "gptChildTools") as Record<string, unknown>;
  let settleCalls = 0;
  Reflect.set(gptChildTools, "createExecution", () => ({
    tools: {
      attemptId: dispatchAttemptId,
      readContinuationExact: async () => null,
      readCallFacts: async () => {
        throw executionFailure("failed", "PAYMENT_OBSERVATION_PROVIDER_FAILED");
      },
      execute: async () => { throw new Error("UNREACHABLE_GPT_CHILD_EXECUTION"); },
    },
    continuationRef: () => null,
    settle: async () => {
      settleCalls += 1;
      throw new Error("BROWSER_TARGET_CLOSE_FAILED");
    },
  }));
  await assert.rejects(
    executor.execute(
      dispatchFailureTask,
      [],
      {
        attempt_id: dispatchAttemptId,
        device_id: "device:plugin-primary-with-cleanup-failure",
        lease_version: 1,
        execution_fence_hash: HASH_A,
        control_manifest_hash: HASH_B,
        max_provider_turns: 1,
        provider_turns_used: 0,
        expires_at_monotonic: performance.now() + 10_000,
        command_ttl_ms: 1_000,
        abort_signal: new AbortController().signal,
      },
      "span:plugin-primary-with-cleanup-failure",
      async () => { throw new Error("UNREACHABLE_PLUGIN_COMPLETE"); },
    ),
    (error: unknown) => {
      assert.equal(
        typedExecutionFailure(error)?.code,
        "PAYMENT_OBSERVATION_PROVIDER_FAILED",
      );
      return true;
    },
  );
  assert.equal(settleCalls, 1, "the primary-plus-cleanup path must execute lifecycle settlement exactly once");

  const pluginLogEvents = (await readFile(pluginFailureLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>);
  const pluginFailureEvents = pluginLogEvents
    .filter((event) => event.kind === "span.terminal" && event.operation === "plugin.execute");
  assert.equal(pluginFailureEvents.length, 3);
  assert.deepEqual(pluginFailureEvents.map((event) => {
    const failure = event.failure as Readonly<Record<string, unknown>>;
    return [failure.code, failure.impact, failure.causedByEventId ?? null];
  }), [
    ["PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID", RuntimeFailureImpact.BLOCKING, null],
    ["PLUGIN_EXECUTION_FAILED", RuntimeFailureImpact.CONSEQUENTIAL, childTerminal.eventId],
    ["PAYMENT_OBSERVATION_PROVIDER_FAILED", RuntimeFailureImpact.BLOCKING, null],
  ]);
  const cleanupEvents = pluginLogEvents.filter((event) => {
    const failure = event.failure as Readonly<Record<string, unknown>> | undefined;
    return event.kind === "error" && failure?.code === "GPT_BROWSER_LIFECYCLE_FAILED";
  });
  assert.equal(cleanupEvents.length, 1);
  const cleanupFailure = cleanupEvents[0]!.failure as Readonly<Record<string, unknown>>;
  assert.equal(cleanupFailure.impact, RuntimeFailureImpact.CLEANUP);
  assert.equal(cleanupFailure.causedByEventId, pluginFailureEvents[2]!.eventId);
  pluginFailureStore.close();
} finally {
  await rm(pluginFailureTemporary, { recursive: true, force: true });
}

const runtimeSource = await readFile(
  new URL("../../src/lib/local-runtime/production/runtime-claim.ts", import.meta.url), "utf8",
);
assert.doesNotMatch(runtimeSource, /handleClaimFailure/u);
assert.match(runtimeSource, /error instanceof ProductionRuntimeBoundaryError/u);
assert.match(runtimeSource, /material\.checkpointSeq \+ 1/u);
assert.match(runtimeSource, /RUNTIME_RECOVERY_REQUIRED:/u);
