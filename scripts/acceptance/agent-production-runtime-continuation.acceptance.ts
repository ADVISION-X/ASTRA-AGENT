import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore, resolveStoredProductionAuthority } from "../../src/lib/local-runtime/production/store.js";
import { createRuntimeLogger, requireRuntimeLogWrite } from "../../src/lib/runtime-logs/index.js";
import { HASH_A, HASH_B, HASH_C, identityFor, resultFor, task } from "./agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-continuation-"));
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
    input: { ...acquireInput, jobId: "job:followup" },
  }, context);
  assert.equal(acquired.status, "success");
  const busy = await gpt.execute({
    childCapabilityId: "acquire_gpt_continuation_lane", executionId: "acceptance:busy-continuation",
    input: { ...acquireInput, jobId: "job:other" },
  }, context);
  assert.equal(busy.status, "review_required");
  assert.match(busy.failureCode ?? "", /GPT_CONTINUATION_LANE_BUSY/u);
  const advanced = await gpt.execute({
    childCapabilityId: "advance_gpt_continuation_lane", executionId: "acceptance:advance-continuation",
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
  store.markOutboxFailed("outbox:1", "FETCH_FAILED");
  assert.equal(store.readOutboxAuthority("outbox:1")?.state, "failed");
  store.markOutboxPending("outbox:1");
  store.markOutboxSent("outbox:1", { checkpoint_hash: HASH_A });
  assert.equal(store.readOutboxAuthority("outbox:1")?.state, "delivered");
  assert.deepEqual(store.outboxAuthorities().map((authority) => authority.state), ["delivered"]);
  assert.throws(() => store.enqueue({ ...outbox, body: '{"drift":true}' }), /PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT/u);
  assert.throws(() => store.acceptTask(sourceTask, {
    ...sourceIdentity, plugin_version: sourceIdentity.plugin_version + 1,
  }), /PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY/u);
  assert.equal(store.readTask(sourceTask.job_id)?.status, "recovery_pending");
  const terminalTask = task({
    jobId: "job:terminal-reconciliation", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const terminalIdentity = identityFor(terminalTask);
  store.acceptTask(terminalTask, terminalIdentity);
  store.setTerminal(terminalTask.job_id, "completed", null, resultFor(terminalTask, terminalIdentity));
  assert.equal(store.taskAuthorities().find((record) => record.task.job_id === terminalTask.job_id)?.status, "completed");
  store.close();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
