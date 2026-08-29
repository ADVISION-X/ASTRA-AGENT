import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { GPT_TURN_FLOW_VERSION, createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore, resolveStoredProductionAuthority } from "../../src/lib/local-runtime/production/store.js";
import { createGptTurnState } from "../../src/lib/local-runtime/production/gpt-turn-state.js";
import { createRuntimeLogger, requireRuntimeLogWrite } from "../../src/lib/runtime-logs/index.js";
import { HASH_A, HASH_B, HASH_C, identityFor, resultFor, task } from "./agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-continuation-"));
const intentMeta = (stepIndex: number) => ({
  flowVersion: GPT_TURN_FLOW_VERSION,
  stepIndex,
  inputHash: HASH_A,
  pluginStepId: "continuation-acceptance",
  actionOrdinal: stepIndex + 1,
});
try {
  const store = new ProductionRuntimeStore(temporary);
  const sourceTask = task({ jobId: "job:source", productId: "bazi_ai_full_analysis", actionId: "produce" });
  const sourceIdentity = identityFor(sourceTask);
  assert.equal(store.acceptTask(sourceTask, sourceIdentity).status, "accepted");
  assert.equal(store.acceptTask(sourceTask, sourceIdentity).identity.skill_hash, sourceIdentity.skill_hash);
  store.markRunning(sourceTask.job_id);
  const firstRunning = store.readTask(sourceTask.job_id)!;
  store.markRunning(sourceTask.job_id);
  assert.deepEqual(store.readTask(sourceTask.job_id), firstRunning);
  store.setRecoveryPending(sourceTask.job_id, "network");
  assert.equal(store.readTask(sourceTask.job_id)?.status, "recovery_pending");
  const atomicState = createGptTurnState({
    executionId: `${sourceTask.job_id}:bazi-ai-full-analysis:analyze`,
    stepInputHash: HASH_A,
    skillText: "acceptance skill",
    instruction: "acceptance instruction",
    parameters: sourceTask.parameters,
    provider: {
      labelKey: "bazi_analysis",
      profileRef: "acceptance:gpt-profile",
      modelDisplayName: "GPT-5.6 Sol",
      modelFamily: "gpt-5.6",
      reasoningTier: "pro_standard",
    },
    selectedMaterials: [],
    acceptanceVersion: HASH_B,
  });
  const dispatchedCheckpoint = {
    schema_version: "gpt-turn-checkpoint.v2" as const,
    flow_version: GPT_TURN_FLOW_VERSION,
    input_hash: HASH_A,
    step_index: 12,
    child_capability_id: "submit_exact_gpt_turn_once" as const,
    status: "failed" as const,
    mutation_state: "dispatched" as const,
    postcondition_result: "pending" as const,
    evidence_ref: "evidence:submit-dispatched",
    evidence_hash: HASH_C,
    provider_dispatch_used: true,
    state: atomicState,
    result: null,
  };
  store.writeGptTurnCheckpoint(sourceTask.job_id, "analyze", dispatchedCheckpoint);
  const restartedStore = new ProductionRuntimeStore(temporary);
  assert.deepEqual(
    restartedStore.readGptTurnCheckpoint(sourceTask.job_id, "analyze", HASH_A),
    dispatchedCheckpoint,
    "restart must recover the exact failed atomic step and mutation state",
  );
  assert.equal(restartedStore.countGptProviderDispatches(sourceTask.job_id), 1,
    "restart reconciliation must not erase or re-spend the prior provider dispatch");
  restartedStore.writeGptTurnCheckpoint(sourceTask.job_id, "analyze", {
    ...dispatchedCheckpoint,
    status: "success",
    mutation_state: "confirmed",
    postcondition_result: "passed",
    evidence_ref: "evidence:submit-reconciled",
  });
  assert.throws(() => restartedStore.writeGptTurnCheckpoint(sourceTask.job_id, "analyze", dispatchedCheckpoint),
    /GPT_TURN_CHECKPOINT_REGRESSION/u);
  restartedStore.close();
  const staleTask = task({ jobId: "job:stale-flow", productId: "bazi_ai_full_analysis", actionId: "produce" });
  store.acceptTask(staleTask, identityFor(staleTask));
  const database = Reflect.get(store, "database") as import("better-sqlite3").Database;
  database.prepare(`insert into production_steps(job_id,step_id,input_hash,result_json,completed_at)
    values(?,?,?,?,?)`).run(
    staleTask.job_id,
    "analyze",
    HASH_A,
    JSON.stringify({ ...dispatchedCheckpoint, flow_version: "gpt-turn-flow.v1",
      step_index: 3, child_capability_id: "open_gpt_execution_profile",
      mutation_state: "confirmed", provider_dispatch_used: false }),
    "2026-08-28T00:00:00.000Z",
  );
  assert.throws(() => store.reconstructStaleGptTurnStep({
    jobId: staleTask.job_id, stepId: "analyze", nextInputHash: HASH_B, safeByBrowserWal: false,
  }), /GPT_FLOW_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE/u);
  store.reconstructStaleGptTurnStep({
    jobId: staleTask.job_id, stepId: "analyze", nextInputHash: HASH_B, safeByBrowserWal: true,
  });
  assert.equal(store.readGptTurnCheckpointMetadata(staleTask.job_id, "analyze"), null);
  assert.match((database.prepare(`select response_hash from production_outbox
    where path like '%/gpt-flow-execution-slice-reconstructions'`).get() as { response_hash: string }).response_hash,
  /^sha256:[a-f0-9]{64}$/u);
  const checkpointAuthority = store.recordCheckpoint({
    jobId: sourceTask.job_id, attemptId: "attempt:source", checkpointId: "factory_running",
    checkpointHash: HASH_C, state: "persisted",
  });
  const leaseAuthority = store.recordLease({
    jobId: sourceTask.job_id, attemptId: "attempt:source", leaseVersion: 1,
    fenceHash: HASH_B, state: "active", expiresAt: "2026-08-27T16:00:00.000Z",
  });
  assert.equal(store.resolveAuthority(`production-checkpoint:${sourceTask.job_id}`, hashCanonical(checkpointAuthority)), "verified");
  assert.equal(store.resolveAuthority(`production-lease:${sourceTask.job_id}`, hashCanonical(leaseAuthority)), "verified");
  assert.equal(resolveStoredProductionAuthority(temporary,
    `production-checkpoint:${sourceTask.job_id}`, hashCanonical(checkpointAuthority)), "verified");

  const cliLogger = createRuntimeLogger({
    producer: "agent-cli-acceptance", producerRunId: "agent-cli-acceptance-run",
    owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs"), maxTotalBytes: 1_048_576 },
  });
  requireRuntimeLogWrite(cliLogger.emitState({
    traceId: `producer:${cliLogger.producerRunId}`, owner: "app-shell", stateKey: "producer.alive",
    previous: null, current: "alive", freshForMs: 60_000,
  }));
  requireRuntimeLogWrite(cliLogger.emitState({
    traceId: sourceTask.job_id, stateKey: "job.checkpoint", previous: null, current: "persisted",
    authorityRef: `production-checkpoint:${sourceTask.job_id}`, authorityHash: hashCanonical(checkpointAuthority),
    reconciledFromAuthority: true,
  }));
  const cli = spawnSync(process.execPath, [
    "--import", "tsx", "scripts/runtime-logs/inspect.ts", "--job", sourceTask.job_id,
    "--source", cliLogger.currentSegmentPath()!,
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal((JSON.parse(cli.stdout) as { status?: string }).status, "DIAGNOSIS_COMPLETE");

  const gpt = createGptAbilityGroup();
  const context = { dataDir: temporary, continuationStore: store };
  const provider = {
    provider_page_url: "https://chatgpt.com/c/source", prior_task_id: "provider:source",
    prior_raw_output_hash: HASH_A, prior_turn_marker: "turn:source",
  };
  const persisted = await gpt.execute({
    childCapabilityId: "persist_gpt_continuation", executionId: "acceptance:persist-continuation",
    ...intentMeta(18),
    input: {
      jobId: sourceTask.job_id, pluginId: sourceIdentity.plugin_id,
      ownerRef: sourceTask.business_identity.owner_ref, subjectRef: sourceTask.business_identity.subject_ref,
      authorizationRef: sourceTask.business_identity.authorization_ref, provider,
    },
  }, context);
  assert.equal(persisted.status, "success", persisted.failureCode ?? "persist continuation failed");
  const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
  if (typeof continuationRef !== "string") throw new Error("GPT_CONTINUATION_REF_MISSING");
  const acquireInput = {
    continuationRef, pluginId: "bazi-report-followup", allowedSourcePluginIds: ["bazi-ai-full-analysis"],
    ownerRef: sourceTask.business_identity.owner_ref, subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
  };
  const acquired = await gpt.execute({
    childCapabilityId: "acquire_gpt_continuation_lane", executionId: "acceptance:acquire-continuation",
    ...intentMeta(19),
    input: { ...acquireInput, jobId: "job:followup" },
  }, context);
  assert.equal(acquired.status, "success");
  const busy = await gpt.execute({
    childCapabilityId: "acquire_gpt_continuation_lane", executionId: "acceptance:busy-continuation",
    ...intentMeta(19),
    input: { ...acquireInput, jobId: "job:other" },
  }, context);
  assert.equal(busy.status, "review_required");
  assert.match(busy.failureCode ?? "", /GPT_CONTINUATION_LANE_BUSY/u);
  const advanced = await gpt.execute({
    childCapabilityId: "advance_gpt_continuation_lane", executionId: "acceptance:advance-continuation",
    ...intentMeta(20),
    input: {
      lane: acquired.value, jobId: "job:followup", pluginId: "bazi-report-followup",
      provider: {
        provider_page_url: "https://chatgpt.com/c/source", prior_task_id: "provider:followup",
        prior_raw_output_hash: HASH_B, prior_turn_marker: "turn:followup",
      },
    },
  }, context);
  assert.equal(advanced.status, "success");
  assert.equal(store.readGptContinuation(continuationRef)?.plugin_id, "bazi-report-followup");
  const unauthorized = await gpt.execute({
    childCapabilityId: "acquire_gpt_continuation_lane", executionId: "acceptance:unauthorized-continuation",
    ...intentMeta(19),
    input: {
      continuationRef, jobId: "job:intruder", pluginId: "qimen-report-followup",
      allowedSourcePluginIds: ["qimen-professional-answer"], ownerRef: sourceTask.business_identity.owner_ref,
      subjectRef: "subject:other", authorizationRef: sourceTask.business_identity.authorization_ref,
    },
  }, context);
  assert.equal(unauthorized.status, "review_required");
  assert.match(unauthorized.failureCode ?? "", /GPT_CONTINUATION_NOT_AUTHORIZED/u);

  const outboxPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(sourceTask.job_id)}/checkpoints`;
  const outbox = {
    idempotency_key: "outbox:1", kind: "checkpoint" as const, path: outboxPath,
    method: "POST" as const, headers: {}, body: "{}",
  };
  store.enqueue(outbox);
  store.enqueue(outbox);
  const pendingOutbox = store.readOutboxAuthority("outbox:1")!;
  assert.equal(pendingOutbox.state, "pending");
  assert.equal(store.resolveAuthority("production-outbox:outbox:1", hashCanonical(pendingOutbox)), "verified");
  store.markOutboxSent("outbox:1", { checkpoint_hash: HASH_A });
  assert.equal(store.readOutboxAuthority("outbox:1")?.state, "delivered");
  assert.deepEqual(store.outboxAuthorities().map((authority) => authority.state), ["delivered", "delivered"]);
  assert.throws(() => store.enqueue({ ...outbox, body: '{"drift":true}' }), /PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT/u);
  assert.throws(() => store.acceptTask(sourceTask, {
    ...sourceIdentity, plugin_version: sourceIdentity.plugin_version + 1,
  }), /PLUGIN_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE/u);
  assert.equal(store.readTask(sourceTask.job_id)?.status, "recovery_pending");
  const terminalTask = task({
    jobId: "job:terminal-reconciliation", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const terminalIdentity = identityFor(terminalTask);
  store.acceptTask(terminalTask, terminalIdentity);
  store.completeTask(terminalTask.job_id, resultFor(terminalTask, terminalIdentity));
  assert.equal(store.taskAuthorities().find((record) => record.task.job_id === terminalTask.job_id)?.status, "completed");
  store.close();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
