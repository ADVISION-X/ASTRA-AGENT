import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { assertProductionStartupPreflight, assertSessionBindingMismatchStartup } from "./agent-production-runtime-startup-preflight.acceptance-support.js";
import { HASH_A, HASH_B,
  attemptFailureFirstFact, resultFor, stageResultForAcceptance, task } from "./agent-production-runtime-fixtures.js";
import { buildProductTask } from "./product-plugin-test-runtime.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { ProductionExecutor } from "../../src/lib/local-runtime/production/executor.js";
import { productionRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { startProductionRuntime } from "../../src/lib/local-runtime/production/runtime.js";
import { GrassEyeWorkbench } from "../../src/lib/local-runtime/workbench.js";
import { assertShutdownFailureOutcomes } from "./agent-production-runtime-session-rotation-support.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { terminalSpanFailure } from "../../src/lib/local-runtime/production/runtime-logging.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { executionFailure, executionFailureMetadata, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { createRuntimeLogger, requireRuntimeLogWrite, RuntimeFailureImpact, runtimeFailureFromError,
  withRuntimeLogCause, type RuntimeSpanHandle } from "../../src/lib/runtime-logs/index.js";
import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import type { BrowserExecutionArtifact } from "../../src/lib/browser/browser-authority-api.js";

await assertProductionStartupPreflight();
await assertSessionBindingMismatchStartup();
await assertShutdownFailureOutcomes();

const shutdownDirectory = await mkdtemp(path.join(tmpdir(), "runtime-drain-"));
try {
  for (const scenario of ["blocked-stop", "empty-stop", "blocked-replacement", "late-init-stop", "late-retry-error"] as const) {
    const dataDir = path.join(shutdownDirectory, scenario); await mkdir(dataDir);
    const store = new ProductionRuntimeStore(dataDir);
    const candidate = task({ jobId: "old-pending", productId: "bazi_ai_full_analysis", actionId: "produce" });
    if (scenario !== "empty-stop") {
      store.acceptTask(candidate, "attempt:old");
      store.enqueue({ idempotency_key: "old:outbox", kind: "artifact", method: "PUT", headers: {}, body: "result",
        path: `/internal/ai-production/v6/jobs/${candidate.job_id}/artifacts/result` });
    }
    const before = store.taskAuthorities(); store.close();
    const logger = createRuntimeLogger({ producer: "blocked-stop-acceptance", owner: "production-runtime",
      component: "production-runtime", terminalEnabled: false, fileSink: { directoryPath: path.join(dataDir, "logs") } });
    let browserClosed = 0, httpClosed = 0;
    const browser = { hasUnresolvedBrowserMutation: () => false, verifyRuntimeTaskProvenance: () => {},
      readProductionRuntimeState: () => ({ browserAuthorityState: "absent", browserTargetState: "absent" }),
      shutdown: async () => { browserClosed++; } };
    const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(dataDir));
    const gpt = createGptAbilityGroup(), stop = new AbortController();
    if (scenario.startsWith("blocked") || scenario === "empty-stop") {
      if (scenario !== "blocked-replacement") stop.abort();
      const oldCredential = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
      process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = path.join(dataDir, "fixture-missing-credential");
      try {
        const runtime = await startProductionRuntime({ dataDir, sourceHash: HASH_A, gpt, evidenceStore,
          browserAuthority: browser as never, runtimeLogger: logger, stopSignal: stop.signal });
        if (scenario === "blocked-stop") {
          const closing = runtime.close(); assert.equal(closing, runtime.close());
          await assert.rejects(closing, /RUNTIME_SHUTDOWN_INCOMPLETE/u);
        } else await runtime.close();
      } finally {
        if (oldCredential === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
        else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = oldCredential;
      }
      if (scenario === "empty-stop") {
        const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n").map(row => JSON.parse(row));
        assert.equal(events.filter(event => event.failure?.impact === RuntimeFailureImpact.BLOCKING).length, 0);
      }
    } else {
      const lifecycle = new GrassEyeWorkbench({ dataDir });
      Reflect.set(lifecycle, "assembly", { dataDir, runtimeLogger: logger, browserAuthority: browser,
        gptAbilityGroup: gpt, evidenceStore });
      const previousHash = process.env.GRASSEYE_SOURCE_FINGERPRINT;
      process.env.GRASSEYE_SOURCE_FINGERPRINT = HASH_A;
      try {
        let initialize: Promise<void>;
        if (scenario === "late-retry-error") {
          const database = new Database(path.join(dataDir, "production-runtime.sqlite"));
          database.exec("create table production_forbidden(extra integer)"); database.close();
          Reflect.set(lifecycle, "productionRuntime", { blocked: true, close: async () => {} });
          initialize = Reflect.get(lifecycle, "retryBlockedRuntime").call(lifecycle);
          Reflect.set(lifecycle, "retryPromise", initialize);
        } else initialize = lifecycle.init();
        const closing = lifecycle.shutdown(async () => { httpClosed++; });
        if (scenario === "late-init-stop") await initialize;
        else await assert.rejects(initialize, /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u);
        await assert.rejects(closing, /WORKBENCH_SHUTDOWN_INCOMPLETE/u);
        assert.equal(browserClosed, 1); assert.equal(httpClosed, 1);
      } finally {
        if (previousHash === undefined) delete process.env.GRASSEYE_SOURCE_FINGERPRINT;
        else process.env.GRASSEYE_SOURCE_FINGERPRINT = previousHash;
      }
    }
    if (scenario !== "late-retry-error") {
      const reopened = new ProductionRuntimeStore(dataDir);
      assert.deepEqual(reopened.taskAuthorities(), before);
      assert.equal(reopened.pendingOutboxCount(), scenario === "empty-stop" ? 0 : 1);
      reopened.close();
    }
  }
} finally { await rm(shutdownDirectory, { recursive: true, force: true }); }
const directory = await mkdtemp(path.join(tmpdir(), "runtime-startup-contract-"));
const oldCredential = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
try {
  const data = path.join(directory, "durable-accept");
  await mkdir(data);
  const store = new ProductionRuntimeStore(data);
  const current = task({ jobId: "job:startup-original", productId: "bazi_ai_full_analysis", actionId: "produce" });
  store.acceptTask(current, "attempt:original");
  store.enqueue({ idempotency_key: "intent:original", kind: "artifact", method: "PUT", headers: {}, body: "result",
    path: `/internal/ai-production/v6/jobs/${current.job_id}/artifacts/result` });
  store.close();
  const restarted = new ProductionRuntimeStore(data);
  assert.equal(restarted.readTask(current.job_id)?.current_attempt_id, "attempt:original");
  assert.equal(restarted.readOutboxAuthority("intent:original")?.state, "pending");
  restarted.markExecuting(current.job_id);
  const failure = attemptFailureFirstFact("attempt:original", serializeTerminalFailure(executionFailure("failed", "PROVIDER_REJECTED")));
  restarted.recordAttemptFailure(current.job_id, "attempt:original", failure);
  assert.equal(restarted.readTask(current.job_id)?.current_reason, "PROVIDER_REJECTED");
  restarted.close();

  process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = path.join(directory, "missing-credential.json");
  const logger = (component: string) => createRuntimeLogger({ producer: "startup-acceptance", owner: "production-runtime",
    component, terminalEnabled: false, fileSink: { directoryPath: path.join(directory, "logs", component) } });
  const runtimeOptions = (dataDir: string) => ({ dataDir, sourceHash: HASH_A, gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(dataDir)),
    browserAuthority: { hasUnresolvedBrowserMutation: () => false,
      readProductionRuntimeState: () => ({ browserAuthorityState: "absent", browserTargetState: "absent" }) } as never,
    runtimeLogger: logger("startup") });
  const corrupt = path.join(directory, "forbidden-schema");
  await mkdir(corrupt);
  new ProductionRuntimeStore(corrupt).close();
  const database = new Database(path.join(corrupt, "production-runtime.sqlite"));
  database.exec("create table production_continuations(forbidden integer not null)");
  database.close();
  await assert.rejects(startProductionRuntime(runtimeOptions(corrupt)), /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u);
  const blockedData = path.join(directory, "orphan-gate");
  const orphan = path.join(blockedData, "generated-images", "unowned", "original.bytes");
  await mkdir(path.dirname(orphan), { recursive: true });
  await writeFile(orphan, "unowned-provider-bytes");
  const blocked = await startProductionRuntime(runtimeOptions(blockedData));
  assert.equal(await readFile(orphan, "utf8"), "unowned-provider-bytes");
  assert.equal(blocked.readHealth().shellState, "ready");
  assert.equal(blocked.readHealth().cloudState, "contract_blocked");
  assert.equal(blocked.readHealth().executionState, "blocked");
  await blocked.close();

  const logs = logger("transport");
  const span = requireRuntimeLogWrite(logs.startSpan({ traceId: "trace:remote", boundaryId: "boundary:remote",
    owner: "production-runtime", component: "transport", operation: "cloud.claim", typedIdentity: { kind: "request", requestId: "request:remote" } }));
  const terminal = terminalSpanFailure(span, runtimeTransportFailure("COLUMN", 500), null, "CLAIM_REQUEST_FAILED");
  assert.equal(terminal.failure?.code, "COLUMN");
  assert.equal(terminal.failure?.httpStatus, 500);
  assert.equal(terminal.failure?.responsibleOwner, "website");

  await mkdir(path.join(directory, "executor"));
  const executorStore = new ProductionRuntimeStore(path.join(directory, "executor"));
  const executorLogger = logger("executor");
  let bound = 0, released = 0, alias: string | null = null;
  const executor = new ProductionExecutor(executorStore, executorLogger, { dataDir: path.join(directory, "executor"),
    sourceHash: HASH_A, gpt: {} as never, evidenceStore: {} as never, providerRateLimitControl: {} as never,
    browserAuthority: { bindExecutionArtifacts: async (input: { artifacts: readonly BrowserExecutionArtifact[] }) => {
      bound += 1;
      const artifact = input.artifacts[0]!;
      const conflict = path.join(path.dirname(artifact.localPath), "blocked-alias.png");
      await mkdir(conflict);
      await assert.rejects(artifact.materializeProviderPath("blocked-alias.png"), /PRODUCTION_MATERIAL_UPLOAD_ALIAS_INVALID/u);
      alias = await artifact.materializeProviderPath("provider-alias.png");
      assert.equal(await artifact.materializeProviderPath("provider-alias.png"), alias);
      const [original, linked] = await Promise.all([lstat(artifact.localPath), lstat(alias)]);
      assert.deepEqual([original.dev, original.ino, original.size], [linked.dev, linked.ino, linked.size]);
      return { release: async () => { released += 1;
        await Promise.all(input.artifacts.map((item) => item.releaseProviderPaths())); } };
    } } as never });
  const parent = task({ jobId: "job:completed-parent", productId: "bazi_ai_full_analysis", actionId: "produce" });
  const parentResult = resultFor(parent);
  executorStore.acceptTask(parent, "attempt:parent-current");
  const reader = Reflect.get(executor, "readContinuationParent") as (...args: unknown[]) => unknown;
  const relation = { parent_task_ref: parent.job_id, parent_result_ref: parentResult.result_payload_ref,
    parent_result_hash: parentResult.result_payload_hash };
  assert.throws(() => reader.call(executor, relation, "provider_continuation"), /PRODUCTION_PARENT_RESULT_BINDING_INVALID/u);
  (Reflect.get(executorStore, "database") as Database.Database).prepare(
    "update production_tasks set status='completed',result_json=?,current_reason=null where job_id=?").run(JSON.stringify(parentResult), parent.job_id);
  assert.equal((reader.call(executor, relation, "provider_continuation") as { current_attempt_id: string }).current_attempt_id,
    "attempt:parent-current");
  for (const wrong of [{ ...relation, parent_task_ref: "job:absent" }, { ...relation, parent_result_ref: "ref:wrong" },
    { ...relation, parent_result_hash: HASH_A }]) assert.throws(() => reader.call(executor, wrong, "provider_continuation"));
  assert.equal(reader.call(executor, {}, "provider_continuation"), null);
  assert.throws(() => executorStore.acceptTask(parent, "attempt:changed"), /PRODUCTION_TASK_IDENTITY_CONFLICT/u);

  const pluginSpan = (stepId: string) => requireRuntimeLogWrite(executorLogger.startSpan({ traceId: "trace:executor",
    owner: "product-plugin", component: "payment-screenshot-observation", operation: "plugin.execute",
    typedIdentity: { kind: "plugin-step", jobId: "job:executor", attemptId: "attempt:executor",
      pluginId: "payment-screenshot-observation", stepId } }));
  const terminalize = Reflect.get(executor, "terminalizePluginFailure") as (span: RuntimeSpanHandle, error: unknown) => never;
  assert.throws(() => terminalize.call(executor, pluginSpan("typed-primary"), executionFailure("failed", "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID")), /PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID/u);
  const browserFailure = executionFailure("failed", "BROWSER_COMMAND_ADMISSION_SUSPENDED", { metadata: { browserEffect: {
    effectScope: "provider_effect", childCapabilityId: "submit_exact_gpt_turn_once", browserOutcome: "CONFIRMED", providerEffectIdentityHash: HASH_B } } });
  assert.throws(() => terminalize.call(executor, pluginSpan("effect-fact"), browserFailure), (error: unknown) =>
    error === browserFailure && executionFailureMetadata(error)?.browserEffect?.providerEffectIdentityHash === HASH_B);
  const child = requireRuntimeLogWrite(executorLogger.startSpan({ traceId: "trace:executor", owner: "gpt", component: "gpt-child",
    operation: "gpt.child", typedIdentity: { kind: "gpt-call", jobId: "job:executor", attemptId: "attempt:executor",
      stepId: "observe", capabilityCallId: "call:observe" } }));
  const childTerminal = requireRuntimeLogWrite(child.terminal({ outcome: "failed", failure: runtimeFailureFromError({
    error: executionFailure("failed", "GPT_CHILD_FAILED"), code: "GPT_CHILD_FAILED", responsibleOwner: "gpt", impact: RuntimeFailureImpact.BLOCKING }) }));
  assert.throws(() => terminalize.call(executor, pluginSpan("child-cause"), withRuntimeLogCause(executionFailure("failed", "GPT_CHILD_FAILED"), childTerminal.eventId)), /GPT_CHILD_FAILED/u);
  const causalSpan = requireRuntimeLogWrite(executorLogger.startSpan({ traceId: "trace:executor", owner: "gpt", component: "gpt-child",
    operation: "gpt.child", typedIdentity: { kind: "gpt-call", jobId: "job:executor", attemptId: "attempt:executor", stepId: "observe", capabilityCallId: "call:causal" } }));
  const nativeCause = runtimeTransportFailure("LOCALIZATION_SOURCE_READ_FAILED", 503, Object.assign(new Error("reset"), { code: "ECONNRESET" }));
  const causalTerminal = requireRuntimeLogWrite(causalSpan.terminal({ outcome: "failed",
    failure: runtimeFailureFromError({ error: nativeCause, code: nativeCause.code, responsibleOwner: "gpt" }) }));
  const causalFailure = withRuntimeLogCause(executionFailure("failed", "RESULT_SETTLED_UNUSABLE", {
    cause: Object.assign(new Error(nativeCause.code, { cause: nativeCause.cause }), { code: "ECONNRESET", httpStatus: 503 }),
    metadata: { mutationOutcome: "confirmed", settledResultPayloadHash: HASH_A,
      evidence: { evidenceRef: "browser-mutation:causal", evidenceHash: HASH_A },
      browserEffect: { effectScope: "provider_effect", childCapabilityId: "submit_exact_gpt_turn_once",
        browserOutcome: "CONFIRMED", providerEffectIdentityHash: HASH_B } },
  }), causalTerminal.eventId);
  assert.equal(serializeTerminalFailure(causalFailure).code, "RESULT_SETTLED_UNUSABLE");
  assert.throws(() => terminalize.call(executor, pluginSpan("settled-cause"), causalFailure), /RESULT_SETTLED_UNUSABLE/u);
  const paymentFixture = buildProductTask(productionRoutePolicy("payment_screenshot_observation", "observe"), {
    parameters: { observation_schema_version: "payment-screenshot-observation-v1" } });
  const { request_hash: _requestHash, ...paymentRequest } = paymentFixture;
  const payment = task({ jobId: paymentFixture.job_id, productId: paymentFixture.product_id,
    actionId: paymentFixture.action_id, materialRefs: paymentFixture.material_refs, extra: paymentRequest });
  const local = path.join(directory, "materials");
  await mkdir(local);
  const materials = await Promise.all(payment.material_refs.map(async (material) => {
    const local_path = path.join(local, material.display_name);
    await writeFile(local_path, "0123456789");
    return { ...material, local_path };
  }));
  executor.accept(payment, "attempt:payment");
  let settlements = 0;
  Reflect.set(Reflect.get(executor, "gptChildTools"), "createExecution", () => ({ tools: {
    jobId: payment.job_id, attemptId: "attempt:payment", readConfirmedSubmit: async () => {
      throw executionFailure("failed", "PAYMENT_OBSERVATION_PROVIDER_FAILED"); }, execute: async () => {
      throw executionFailure("failed", "PAYMENT_OBSERVATION_PROVIDER_FAILED"); } }, settle: async () => {
      settlements += 1; throw new Error("BROWSER_TARGET_CLOSE_FAILED"); } }));
  await assert.rejects(executor.execute(payment, materials, { attempt_id: "attempt:payment", device_id: "device:test",
    lease_version: 1, execution_fence_hash: HASH_A, capability_manifest_hash: HASH_B, max_provider_turns: 1, provider_turns_used: 0,
    result_revision: 0, prior_result_rejection: null, delivery_priority_replay_grant: null,
    expires_at_monotonic: performance.now() + 10000, command_ttl_ms: 1000, abort_signal: new AbortController().signal },
  "span:test", async () => { throw new Error("UNREACHABLE_COMPLETE"); }, async () => { throw new Error("UNREACHABLE_IMAGE"); }),
  (error: unknown) => typedExecutionFailure(error)?.code === "PAYMENT_OBSERVATION_PROVIDER_FAILED");
  assert.deepEqual([bound, released, settlements], [1, 1, 1]);
  assert.ok(alias);
  await assert.rejects(lstat(alias!), /ENOENT/u);
  const events = (await readFile(executorLogger.currentSegmentPath()!, "utf8")).trim().split("\n").map((row) => JSON.parse(row));
  const failures = events.filter((event) => event.kind === "span.terminal" && event.operation === "plugin.execute");
  assert.deepEqual(failures.map((event) => [event.failure.code, event.failure.impact, event.failure.causedByEventId ?? null]), [
    ["PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID", RuntimeFailureImpact.BLOCKING, null],
    ["BROWSER_COMMAND_ADMISSION_SUSPENDED", RuntimeFailureImpact.BLOCKING, null],
    ["GPT_CHILD_FAILED", RuntimeFailureImpact.CONSEQUENTIAL, childTerminal.eventId],
    ["RESULT_SETTLED_UNUSABLE", RuntimeFailureImpact.CONSEQUENTIAL, causalTerminal.eventId],
    ["PAYMENT_OBSERVATION_PROVIDER_FAILED", RuntimeFailureImpact.BLOCKING, null] ]);
  assert.equal(failures[3].failure.nativeCause, "ECONNRESET"); assert.equal(failures[3].failure.httpStatus, 503);
  const cleanup = events.filter((event) => event.kind === "error" && event.failure?.code === "GPT_BROWSER_LIFECYCLE_FAILED");
  assert.equal(cleanup.length, 1);
  assert.equal(cleanup[0].failure.impact, RuntimeFailureImpact.CLEANUP);
  assert.equal(cleanup[0].failure.causedByEventId, failures.at(-1).eventId);
  // Exercise the real Product dispatch/finally and outer Executor after admission clears staged_result.
  const browser = Reflect.get(executor, "browserAuthority");
  let lateReleases = 0;
  Reflect.set(browser, "bindExecutionArtifacts", async () => ({ release: async () => {
    lateReleases++;
    throw executionFailure("failed", "LATE_ARTIFACT_RELEASE_FAILED");
  } }));
  for (const mode of ["staged", "completed", "post-product", "log-failure", "foreign-attempt", "foreign-payload"] as const) {
    const releasesBefore = lateReleases;
    const candidate = task({ jobId: `job:executor-${mode}`, productId: payment.product_id, actionId: payment.action_id,
      materialRefs: payment.material_refs, extra: { ...paymentRequest, job_id: `job:executor-${mode}` } });
    executor.accept(candidate, "attempt:late");
    let decorations = 0, settledAfterComplete = false, completedCallback = false;
    const userTurnId = "11111111-1111-4111-8111-111111111111";
    const canonicalConversationUrl = "https://chatgpt.com/c/original";
    const children: string[] = [];
    Reflect.set(Reflect.get(executor, "gptChildTools"), "createExecution", () => ({ tools: {
      jobId: candidate.job_id, attemptId: "attempt:late",
      readConfirmedSubmit: async (call: { input: { promptHash: string } }) => ({
        value: { status: "CONFIRMED", promptHash: call.input.promptHash, mutationSent: true, userTurnId },
        artifactRefs: [], effectReceipt: { effectScope: "provider_effect", outcome: "CONFIRMED",
          providerEffectIdentityHash: HASH_A, mutationOutcome: "confirmed", terminalAt: new Date().toISOString() },
      }),
      execute: async (call: { child: string; input: Record<string, unknown> }) => {
        children.push(call.child);
        if (call.child === "get_submitted_gpt_conversation_url") {
          assert.equal(call.input.submitCallId, "turn-submit");
          assert.equal(call.input.providerEffectIdentityHash, HASH_A);
          return { value: { canonicalConversationUrl, userTurnId }, artifactRefs: [] };
        }
        assert.equal(call.child, "checkpoint_gpt_text_response");
        assert.equal(call.input.canonicalConversationUrl, canonicalConversationUrl);
        assert.equal(call.input.userTurnId, userTurnId);
        return { value: { semanticText: JSON.stringify({ schema_version: "payment-screenshot-observation-v1" }),
          rawDomHash: HASH_A, semanticTextHash: HASH_B }, artifactRefs: ["artifact:original"] };
      },
    }, readProviderEffectReadbackProof: () => null,
    decorateSettledResultFailure: (error: unknown) => { decorations++; return error; }, settle: async () => {
      settledAfterComplete = completedCallback; throw executionFailure("failed", "LATE_GPT_SETTLE_FAILED");
    } }));
    const originalCleanupLog = Reflect.get(executor, "logBrowserCleanup");
    const originalDispatch = Reflect.get(executor, "dispatchPlugin");
    if (mode === "post-product") Reflect.set(executor, "dispatchPlugin", async (input: unknown) => {
      await originalDispatch.call(executor, input); throw executionFailure("failed", "LATE_PRODUCT_FINALIZER_FAILED");
    });
    if (mode === "log-failure") Reflect.set(executor, "logBrowserCleanup", () => { throw new Error("LATE_LOG_FAILED"); });
    const execution = executor.execute(candidate, materials, { attempt_id: "attempt:late", device_id: "device:test",
      lease_version: 1, execution_fence_hash: HASH_A, capability_manifest_hash: HASH_B, max_provider_turns: 1, provider_turns_used: 0,
      result_revision: 0, prior_result_rejection: null, delivery_priority_replay_grant: null,
      expires_at_monotonic: performance.now() + 10000, command_ttl_ms: 1000, abort_signal: new AbortController().signal },
    "span:test", async () => {
      const envelope = resultFor(candidate);
      stageResultForAcceptance(executorStore, candidate.job_id, "attempt:late", envelope);
      if (mode !== "staged") executorStore.completeTask(candidate.job_id, envelope);
      if (mode === "foreign-attempt") (Reflect.get(executorStore, "database") as Database.Database).prepare(
        "update production_tasks set current_attempt_id='attempt:foreign' where job_id=?").run(candidate.job_id);
      if (mode === "foreign-payload") (Reflect.get(executorStore, "database") as Database.Database).prepare(
        "update production_tasks set result_json=? where job_id=?").run(JSON.stringify({ ...envelope, execution_receipt_hash: HASH_B }), candidate.job_id);
      completedCallback = true; return envelope;
    }, async () => { throw new Error("UNREACHABLE_IMAGE"); });
    if (mode.startsWith("foreign-")) await assert.rejects(execution, (error: unknown) => error instanceof AggregateError
      && typedExecutionFailure(error.cause)?.code === "LATE_GPT_SETTLE_FAILED"
      && typedExecutionFailure(error.errors[0])?.code === "LATE_ARTIFACT_RELEASE_FAILED");
    else assert.deepEqual((await execution).result, resultFor(candidate), "late cleanup/log errors preserve this invocation's original result");
    assert.equal(settledAfterComplete, true); assert.equal(decorations, 0, "cleanup cannot classify a new Product rejection");
    assert.deepEqual(children, ["get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response"]);
    assert.equal(lateReleases - releasesBefore, 1, "the original artifact lease must release exactly once even on late errors");
    if (mode !== "staged" && !mode.startsWith("foreign-")) assert.equal(executorStore.readTask(candidate.job_id)?.staged_result, null);
    Reflect.set(executor, "logBrowserCleanup", originalCleanupLog);
    Reflect.set(executor, "dispatchPlugin", originalDispatch);
    const lateEvents = (await readFile(executorLogger.currentSegmentPath()!, "utf8")).trim().split("\n").map(row => JSON.parse(row))
      .filter(event => event.traceId === candidate.job_id && event.operation === "plugin.execute");
    assert.equal(lateEvents.filter(event => event.kind === "span.started").length, 1);
    assert.equal(lateEvents.filter(event => event.kind === "span.terminal").length, 1,
      "a healthy logger closes the original plugin span exactly once on absorbed late errors");
    if (mode === "post-product") {
      assert.equal(lateEvents.at(-1).failure.code, "LATE_PRODUCT_FINALIZER_FAILED");
      assert.equal(lateEvents.at(-1).failure.impact, RuntimeFailureImpact.BLOCKING);
      assert.equal(lateEvents.at(-1).failure.causedByEventId, undefined,
        "an earlier independent Product finalizer fault cannot be caused by a later artifact release fault");
    }
    assert.equal(executorStore.readTask(candidate.job_id)?.attempt_failure, null);
  }
  executorStore.close();
} finally {
  if (oldCredential === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = oldCredential;
  await rm(directory, { recursive: true, force: true });
}
for (const evidenceMode of ["exam.golden", "exam.property"] as const) emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-002-V12", evidenceMode, clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
  locator: `acceptance:agent-production-runtime:credential:${evidenceMode}`,
  observedValue: "Original preflight and session-binding tests rejected typed credential/version failures before mutation, retained the long-lived credential, and kept blocked Shell healthy." });
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-006-V48", evidenceMode, clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
  locator: `acceptance:agent-production-runtime:storage-inventory:${evidenceMode}`,
  observedValue: "Read-only inventory returned exact ownership/orphan bytes and rejected symlinks; startup preserved recoverable bytes and blocked execution without cleanup." });
