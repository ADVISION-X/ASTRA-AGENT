import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { ProductionExecutor } from "../../src/lib/local-runtime/production/executor.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
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
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import type { BrowserExecutionArtifact } from "../../src/lib/browser/browser-authority-api.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { serializeTerminalFailure } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { HASH_A, HASH_B, resultFor, task, validDeviceCredential } from
  "./agent-production-runtime-fixtures.js";
import { buildProductTask } from "./product-plugin-test-runtime.js";
import { productionRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { assertProductionStartupPreflight } from
  "./agent-production-runtime-startup-preflight.acceptance-support.js";
import "./agent-production-runtime-recovery-contract.acceptance.js";

await assertProductionStartupPreflight();

const firstCheckpointCrashTemporary = await mkdtemp(
  path.join(tmpdir(), "agent-production-first-checkpoint-crash-"),
);
try {
  const store = new ProductionRuntimeStore(firstCheckpointCrashTemporary);
  const acceptedTask = task({
    jobId: "job:first-checkpoint-crash", productId: "bazi_ai_full_analysis", actionId: "produce",
  });
  store.acceptTask(acceptedTask, "attempt:first-checkpoint-crash");
  const pendingWriteId = "restart-preserves-current-attempt-write";
  store.enqueue({
    idempotency_key: pendingWriteId,
    kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${acceptedTask.job_id}/artifacts/result`,
    method: "PUT",
    headers: {},
    body: Buffer.from("result"),
  });
  assert.equal(store.readTask(acceptedTask.job_id)?.current_reason, "LEASE_GRANTED");
  assert.equal(store.readOutboxAuthority(pendingWriteId)?.state, "pending",
    "restart must preserve an unsent current-attempt write until Website authority decides its fate");
  store.markExecuting(acceptedTask.job_id);
  assert.equal(store.readTask(acceptedTask.job_id)?.current_reason, "EXECUTING");

  const ordinaryFailure = task({
    jobId: "job:ordinary-absent-lease", productId: "bazi_ai_full_analysis", actionId: "produce",
  });
  const ordinaryAttemptId = "attempt:ordinary-absent-lease";
  store.acceptTask(ordinaryFailure, ordinaryAttemptId);
  store.markExecuting(ordinaryFailure.job_id);
  store.recordAttemptFailure(ordinaryFailure.job_id, ordinaryAttemptId,
    serializeTerminalFailure(executionFailure("failed", "PROVIDER_REJECTED")));
  assert.equal(store.readTask(ordinaryFailure.job_id)?.current_reason, "PROVIDER_REJECTED");
  store.close();
} finally {
  await rm(firstCheckpointCrashTemporary, { recursive: true, force: true });
}

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
  const corruptDataDirectory = path.join(temporary, "corrupt-continuation");
  await mkdir(corruptDataDirectory, { recursive: true });
  const corruptStore = new ProductionRuntimeStore(corruptDataDirectory);
  corruptStore.close();
  const corruptDatabase = new Database(path.join(corruptDataDirectory, "production-runtime.sqlite"));
  corruptDatabase.exec("create table production_continuations(forbidden integer not null)");
  corruptDatabase.close();
  await assert.rejects(startProductionRuntime({
    dataDir: corruptDataDirectory, sourceHash: HASH_A, gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(corruptDataDirectory)),
    browserAuthority: browserAuthority as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-corrupt-data", owner: "production-runtime", component: "startup-integrity",
      terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
  }), /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u);

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

const bindingMismatchTemporary = await mkdtemp(path.join(tmpdir(), "agent-session-binding-mismatch-"));
const bindingMismatchCredentialPath = path.join(bindingMismatchTemporary, "device-credential.json");
const bindingMismatchOriginalCredentialPath = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
const bindingMismatchOriginalFetch = globalThis.fetch;
let bindingMismatchRuntime: Awaited<ReturnType<typeof startProductionRuntime>> | null = null;
const bindingMismatchRequestPaths: string[] = [];
try {
  await writeFile(bindingMismatchCredentialPath, JSON.stringify(validDeviceCredential), { mode: 0o600 });
  process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = bindingMismatchCredentialPath;
  globalThis.fetch = (async (input: string | URL | Request) => {
    bindingMismatchRequestPaths.push(new URL(input instanceof Request ? input.url : input).pathname);
    return new Response(JSON.stringify({
      ok: false,
      error: {
        code: "AI_SESSION_BINDING_MISMATCH",
        message: "Worker session binding rejected.",
        status: 409,
        request_id: "request:binding-mismatch",
      },
    }), { status: 409, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  const dataDir = path.join(bindingMismatchTemporary, "runtime");
  await mkdir(dataDir);
  const historyStore = new ProductionRuntimeStore(dataDir);
  const historyTask = task({ jobId: "job:historical-terminal-new-attempt",
    productId: "payment_screenshot_observation", actionId: "observe" });
  historyStore.acceptTask(historyTask, "attempt:historical-terminal");
  const historicalResult = { ...resultFor(historyTask),
    evidence_refs: [`art-${"a".repeat(64)}`] };
  historyStore.stageResult(historyTask.job_id, historicalResult);
  for (const [key, receipt] of [["payload", HASH_A], ["envelope", HASH_B]] as const) {
    historyStore.enqueue({ idempotency_key: `artifact:historical-terminal:${key}`, kind: "artifact",
      path: `/internal/ai-production/v6/jobs/${historyTask.job_id}/artifacts/${key}`,
      method: "PUT", headers: {}, body: Buffer.from(key) });
    historyStore.markOutboxSent(`artifact:historical-terminal:${key}`, { receipt_hash: receipt });
  }
  const historicalPayloadHash = hashCanonical(historicalResult);
  historyStore.enqueue({ idempotency_key: "terminal:historical-terminal", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${historyTask.job_id}/terminal`,
    method: "POST", headers: {}, body: JSON.stringify({
      schema_version: "xuanxue-ai-terminal-cas.v6", job_id: historyTask.job_id,
      terminal_status: "completed", payload_hash: historicalPayloadHash, failure: null,
      worker_session_id: "session:historical-terminal",
      worker_session_epoch: 1,
      result_object_receipts: [HASH_A, HASH_B],
    }) });
  historyStore.markOutboxSent("terminal:historical-terminal", {
    schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: historyTask.job_id,
    terminal_status: "completed", payload_hash: historicalPayloadHash, failure: null,
    first_terminal: true, device_id: "device:historical-terminal", device_epoch: 1,
    worker_session_id: "session:historical-terminal",
    worker_session_epoch: 1,
    runtime_attestation_receipt_hash: HASH_A,
  });
  historyStore.acceptTask(historyTask, "attempt:website-authorized-next");
  historyStore.close();
  bindingMismatchRuntime = await startProductionRuntime({
    dataDir,
    sourceHash: HASH_A,
    gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(dataDir)),
    browserAuthority: {
      readProductionRuntimeState: () => ({
        browserAuthorityState: "absent" as const,
        browserTargetState: "absent" as const,
      }),
    } as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-session-binding-mismatch", owner: "production-runtime", component: "production-session",
      terminalEnabled: false, fileSink: { directoryPath: path.join(bindingMismatchTemporary, "runtime-logs") },
    }),
  });
  const health = bindingMismatchRuntime.readHealth();
  assert.equal(health.shellState, "ready");
  assert.equal(health.cloudState, "contract_blocked");
  assert.equal(health.executionState, "blocked");
  assert.equal(health.claimAdmissionState, "blocked");
  assert.equal(health.controlContractVersion, 34,
    "blocked diagnostics must retain only the consumer contract version needed for exact comparison");
  assert.equal(health.lastErrorCode, "AI_SESSION_BINDING_MISMATCH");
  await bindingMismatchRuntime.close();
  bindingMismatchRuntime = null;
  assert.deepEqual(bindingMismatchRequestPaths, ["/internal/ai-production/v6/sessions/open"],
    "a deterministic session binding 409 must not create a worker or heartbeat handle that reopens on shutdown");
} finally {
  if (bindingMismatchRuntime) await bindingMismatchRuntime.close();
  globalThis.fetch = bindingMismatchOriginalFetch;
  if (bindingMismatchOriginalCredentialPath === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = bindingMismatchOriginalCredentialPath;
  await rm(bindingMismatchTemporary, { recursive: true, force: true });
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
    runtimeTransportFailure("COLUMN", 500),
    null,
    "CLAIM_REQUEST_FAILED",
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
  let browserArtifactBindCalls = 0;
  let browserArtifactReleaseCalls = 0;
  const providerAliasName = "payment-0123456789ab.png";
  let providerAliasPath: string | null = null;
  const executor = new ProductionExecutor(
    pluginFailureStore, pluginFailureLogger,
    {
      dataDir: pluginFailureTemporary, sourceHash: HASH_A,
      gpt: {} as never, evidenceStore: {} as never,
      providerRateLimitControl: {} as never,
      browserAuthority: {
        bindExecutionArtifacts: async (input: Readonly<{ artifacts: readonly BrowserExecutionArtifact[] }>) => {
          browserArtifactBindCalls += 1;
          const artifact = input.artifacts[0]!;
          const conflictPath = path.join(path.dirname(artifact.localPath), "conflict.png");
          await mkdir(conflictPath);
          await assert.rejects(artifact.materializeProviderPath("conflict.png"),
            /PRODUCTION_MATERIAL_UPLOAD_ALIAS_INVALID/u,
            "an alien same-name entry must fail closed without a copy fallback");
          providerAliasPath = await artifact.materializeProviderPath(providerAliasName);
          assert.equal(await artifact.materializeProviderPath(providerAliasName), providerAliasPath,
            "the exact same-inode provider alias must be idempotent");
          const [source, alias] = await Promise.all([lstat(artifact.localPath), lstat(providerAliasPath)]);
          assert.deepEqual([alias.dev, alias.ino, alias.size], [source.dev, source.ino, source.size]);
          return { release: async () => {
            browserArtifactReleaseCalls += 1;
            await Promise.all(input.artifacts.map((item) => item.releaseProviderPaths()));
          } };
        },
      } as never,
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

  const dispatchPlugin = Reflect.get(executor, "dispatchPlugin") as (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
  const parentTask = task({ jobId: "job:article-parent", productId: "bazi_ai_full_analysis", actionId: "produce" });
  const parentAttemptId = "attempt:article-parent-final", parentResult = resultFor(parentTask);
  pluginFailureStore.acceptTask(parentTask, "attempt:article-parent-superseded"); pluginFailureStore.acceptTask(parentTask, parentAttemptId);
  pluginFailureStore.completeTask(parentTask.job_id, parentResult);
  const translationTask = {
    ...buildProductTask(productionRoutePolicy("localization_article_translation", "article_translation"),
      { parameters: { target_locale: "en-US", source_resource_id: "resource:article-parent", source_version: "v1",
        source_sha256: HASH_A, policy_version: "localization-policy.v1" } }), parent_task_ref: parentTask.job_id,
    parent_result_ref: parentResult.result_payload_ref, parent_result_hash: parentResult.result_payload_hash,
  };
  const continuationLease = {
    attempt_id: "attempt:article-translation", device_id: "device:article-translation", lease_version: 1,
    execution_fence_hash: HASH_A, capability_manifest_hash: HASH_B, max_provider_turns: 1, provider_turns_used: 0,
    result_revision: 0, prior_result_rejection: null, expires_at_monotonic: performance.now() + 10_000,
    command_ttl_ms: 1_000, abort_signal: new AbortController().signal,
  };
  const continuationInput = (currentTask: typeof translationTask) => ({ task: currentTask, materials: [],
    lease: continuationLease, span: startPluginSpan("article-parent-binding"), complete: async () => {
      throw new Error("UNREACHABLE_PARENT_COMPLETE"); }, uploadGeneratedImage: async () => { throw new Error("UNREACHABLE_PARENT_IMAGE_UPLOAD"); } });
  await assert.rejects(dispatchPlugin.call(executor, continuationInput({ ...translationTask, parent_task_ref: "job:missing-article-parent" })), /PRODUCTION_PARENT_RESULT_BINDING_MISSING/u);
  await assert.rejects(dispatchPlugin.call(executor, continuationInput({ ...translationTask, parent_result_hash: `sha256:${"c".repeat(64)}` })), /PRODUCTION_PARENT_RESULT_BINDING_INVALID/u);
  let capturedContinuationParent: unknown = null; const gptChildTools = Reflect.get(executor, "gptChildTools") as Record<string, unknown>;
  Reflect.set(gptChildTools, "createExecution", (input: Readonly<Record<string, unknown>>) => {
    capturedContinuationParent = input.providerContinuationParent; throw new Error("PARENT_BINDING_CAPTURED");
  });
  await assert.rejects(dispatchPlugin.call(executor, continuationInput(translationTask)), /PARENT_BINDING_CAPTURED/u);
  assert.deepEqual(capturedContinuationParent, { jobId: parentTask.job_id });
  capturedContinuationParent = "UNEXPECTED_PARENT";
  const staticCatalogRoot = task({ jobId: "job:static-catalog-zh-HK-root", productId: "localization_static_catalog", actionId: "produce_locale_catalog", extra: { parameters: { target_locale: "zh-HK" } } });
  await assert.rejects(dispatchPlugin.call(executor, continuationInput(staticCatalogRoot as typeof translationTask)),
    /PARENT_BINDING_CAPTURED/u);
  assert.equal(capturedContinuationParent, undefined);

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
      stepId: "corpus_research",
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
  const materialDirectory = path.join(pluginFailureTemporary, "materials");
  await mkdir(materialDirectory);
  const paymentPath = path.join(materialDirectory, "payment.png");
  const contractPath = path.join(materialDirectory, "contract.json");
  await writeFile(paymentPath, "0123456789");
  await writeFile(contractPath, "abcdefghij");
  const localMaterials = dispatchFailureTask.material_refs.map((material) => ({
    ...material,
    local_path: material.material_id === "material:plugin-primary-payment" ? paymentPath : contractPath,
  }));
  executor.accept(dispatchFailureTask, dispatchAttemptId);
  let settleCalls = 0;
  Reflect.set(gptChildTools, "createExecution", () => ({
    tools: {
      jobId: dispatchFailureTask.job_id,
      attemptId: dispatchAttemptId,
      readConfirmedSubmit: async () => {
        throw executionFailure("failed", "PAYMENT_OBSERVATION_PROVIDER_FAILED");
      },
      execute: async () => {
        throw executionFailure("failed", "PAYMENT_OBSERVATION_PROVIDER_FAILED");
      },
    },
    settle: async () => {
      settleCalls += 1;
      throw new Error("BROWSER_TARGET_CLOSE_FAILED");
    },
  }));
  await assert.rejects(
    executor.execute(
      dispatchFailureTask,
      localMaterials,
      {
        attempt_id: dispatchAttemptId,
        device_id: "device:plugin-primary-with-cleanup-failure",
        lease_version: 1,
        execution_fence_hash: HASH_A,
        capability_manifest_hash: HASH_B,
        max_provider_turns: 1,
        provider_turns_used: 0,
        result_revision: 0,
        prior_result_rejection: null,
        expires_at_monotonic: performance.now() + 10_000,
        command_ttl_ms: 1_000,
        abort_signal: new AbortController().signal,
      },
      "span:plugin-primary-with-cleanup-failure",
      async () => { throw new Error("UNREACHABLE_PLUGIN_COMPLETE"); },
      async () => { throw new Error("UNREACHABLE_IMAGE_UPLOAD"); },
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
  assert.equal(browserArtifactBindCalls, 1,
    "Runtime production execution must invoke the Browser public task-local material binding");
  assert.equal(browserArtifactReleaseCalls, 1,
    "Runtime must release the Browser artifact binding after failure and lifecycle settlement");
  assert.ok(providerAliasPath);
  await assert.rejects(lstat(providerAliasPath!), /ENOENT/u,
    "Runtime must remove its provider alias when Browser releases the execution binding");

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
    ["GPT_CHILD_FAILED", RuntimeFailureImpact.CONSEQUENTIAL, childTerminal.eventId],
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
assert.doesNotMatch(runtimeSource, /checkpointSeq|latestCheckpoint|\/checkpoints/u);
assert.doesNotMatch(runtimeSource, /ATTEMPT_ENDED:/u);

for (const evidenceMode of ["exam.golden", "exam.property"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-002-V8",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
    locator: `acceptance:agent-production-runtime:credential:${evidenceMode}`,
    observedValue: "credential format failures returned exact typed codes, extra legacy fields failed closed without writes, and valid credentials read exactly; a deterministic session binding 409 preserved the consumer contract version, kept Shell ready and execution blocked, and issued exactly one session-open request with no worker or heartbeat handle",
  });
}
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-006-V36",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
    locator: `acceptance:agent-production-runtime:storage-inventory:${evidenceMode}`,
    observedValue: "read-only storage inventory preserved owned data reported exact orphan denominator rejected symlinks and blocked claim before credential without deleting any target",
  });
}
