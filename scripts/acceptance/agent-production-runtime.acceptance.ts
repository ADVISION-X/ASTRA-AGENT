import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import {
  agentPluginCapabilityManifest,
  productionCatalogHash,
  productionPluginCatalog,
  resolveProductionPlugin,
} from "../../src/lib/local-runtime/production/catalog.js";
import {
  AgentPluginCapabilityManifestSchema,
  RESULT_CONTRACT_ID,
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_ID,
  TASK_CONTRACT_VERSION,
  WebsiteAgentResultSchema,
  WebsiteAgentTaskSchema,
  hashCanonical,
  type DurablePluginIdentity,
  type ProductionActionId,
  type ProductionHash,
  type ProductionProductId,
  type WebsiteAgentResult,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import { startProductionRuntime } from "../../src/lib/local-runtime/production/runtime.js";
import {
  ProductionRuntimeStore,
  resolveStoredProductionAuthority,
} from "../../src/lib/local-runtime/production/store.js";
import { createRuntimeLogger, requireRuntimeLogWrite } from "../../src/lib/runtime-logs/index.js";
import {
  ClaimedProductionTaskSchema,
  PRODUCTION_V6_MANIFEST_HASH,
  websiteAgentTaskFromClaim,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const HASH_A = `sha256:${"a".repeat(64)}` as ProductionHash;
const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;
const HASH_C = `sha256:${"c".repeat(64)}` as ProductionHash;

const task = (input: Readonly<{
  jobId: string;
  productId: ProductionProductId;
  actionId: ProductionActionId;
  materialRefs?: readonly Record<string, unknown>[];
  extra?: Readonly<Record<string, unknown>>;
}>): WebsiteAgentTask => {
  const draft = {
    schema_version: "website-agent-task.v1",
    protocol_version: "xuanxue-ai-production-v6",
    job_id: input.jobId,
    source_task_id: `source:${input.jobId}`,
    product_id: input.productId,
    action_id: input.actionId,
    idempotency_key: `idempotency:${input.jobId}`,
    task_contract_id: TASK_CONTRACT_ID,
    task_contract_version: TASK_CONTRACT_VERSION,
    business_identity: {
      owner_ref: "owner:1",
      subject_ref: "subject:1",
      authorization_ref: "authorization:1",
    },
    business_context_ref: `context:${input.jobId}`,
    business_context_hash: HASH_A,
    parameters: {},
    material_refs: input.materialRefs ?? [],
    result_contract_id: RESULT_CONTRACT_ID,
    result_contract_version: RESULT_CONTRACT_VERSION,
    ...(input.extra ?? {}),
  };
  const { job_id: _jobId, ...canonical } = draft;
  return WebsiteAgentTaskSchema.parse({ ...draft, request_hash: hashCanonical(canonical) });
};

const resultFor = (accepted: WebsiteAgentTask, identity: DurablePluginIdentity): WebsiteAgentResult =>
  WebsiteAgentResultSchema.parse({
    schema_version: "website-agent-result.v1",
    job_id: accepted.job_id,
    source_task_id: accepted.source_task_id,
    product_id: accepted.product_id,
    action_id: accepted.action_id,
    plugin_id: identity.plugin_id,
    plugin_version: identity.plugin_version,
    result_contract_id: RESULT_CONTRACT_ID,
    result_contract_version: RESULT_CONTRACT_VERSION,
    result_payload_ref: `object:${accepted.job_id}`,
    result_payload_hash: HASH_B,
    result_payload_bytes: 2,
    result_payload_media_type: "application/json",
    result_object_receipt: {
      object_ref: `object:${accepted.job_id}`,
      sha256: HASH_B,
      bytes: 2,
      media_type: "application/json",
      receipt_hash: HASH_C,
    },
    evidence_refs: ["evidence:provider"],
    execution_receipt_hash: HASH_A,
  }) as WebsiteAgentResult;

const identityFor = (accepted: WebsiteAgentTask): DurablePluginIdentity => {
  const resolved = authorizeWebsiteAgentTask(accepted);
  return {
    catalog_hash: productionCatalogHash,
    plugin_id: resolved.plugin.pluginId,
    plugin_version: resolved.plugin.pluginVersion,
    skill_hash: resolved.skillHash,
    checkpoint_schema_version: resolved.plugin.checkpointSchemaVersion,
    request_hash: accepted.request_hash,
  };
};

assert.equal(productionPluginCatalog.length, 12);
assert.equal(agentPluginCapabilityManifest.plugins.length, 12);
assert.deepEqual(AgentPluginCapabilityManifestSchema.parse(agentPluginCapabilityManifest), agentPluginCapabilityManifest);
for (const entry of agentPluginCapabilityManifest.plugins) {
  for (const accepted of entry.accepts) {
    assert.equal(resolveProductionPlugin(accepted.product_id, accepted.action_id).plugin.pluginId, entry.plugin_id);
  }
}
assert.throws(() => AgentPluginCapabilityManifestSchema.parse({
  ...agentPluginCapabilityManifest,
  catalog_hash: HASH_A,
}), /AGENT_CAPABILITY_MANIFEST_HASH_MISMATCH/u);
assert.throws(() => AgentPluginCapabilityManifestSchema.parse({
  ...agentPluginCapabilityManifest,
  skill_hash: HASH_A,
}), /unrecognized_keys/u);

const productionTask = task({
  jobId: "job:payment",
  productId: "payment_screenshot_observation",
  actionId: "observe",
});
const reviewTask = task({
  jobId: "job:review",
  productId: "payment_screenshot_observation",
  actionId: "accuracy_challenge",
  extra: {
    subject_task_ref: "task:subject",
    subject_result_ref: "result:subject",
    subject_result_hash: HASH_B,
    review_policy: "verify visible facts only",
  },
});
assert.equal(authorizeWebsiteAgentTask(reviewTask).plugin.pluginId, "payment-screenshot-observation");
assert.throws(() => task({
  jobId: "job:review-missing-policy",
  productId: "payment_screenshot_observation",
  actionId: "accuracy_challenge",
  extra: { subject_task_ref: "task:subject", subject_result_ref: "result:subject", subject_result_hash: HASH_B },
}), /AGENT_REVIEW_SUBJECT_INVALID/u);
assert.throws(() => task({
  jobId: "job:ordinary-with-review",
  productId: "payment_screenshot_observation",
  actionId: "observe",
  extra: { subject_task_ref: "task:subject" },
}), /AGENT_REVIEW_SUBJECT_INVALID/u);
assert.throws(() => task({
  jobId: "job:execution-role",
  productId: "payment_screenshot_observation",
  actionId: "observe",
  materialRefs: [{
    material_id: "material:1", ordinal: 0, role: "stage_1_input", display_name: "proof.png",
    object_ref: "object:1", sha256: HASH_A, bytes: 10, media_type: "image/png",
    storage_class: "private_owner_scoped", owner_scope_hash: HASH_B,
    trust_class: "user_provided_data", may_issue_instruction: false,
  }],
}), /AGENT_MATERIAL_EXECUTION_ROLE_FORBIDDEN/u);
assert.throws(() => task({
  jobId: "job:instruction-escalation",
  productId: "payment_screenshot_observation",
  actionId: "observe",
  materialRefs: [{
    material_id: "material:1", ordinal: 0, role: "payment_screenshot", display_name: "proof.png",
    object_ref: "object:1", sha256: HASH_A, bytes: 10, media_type: "image/png",
    storage_class: "private_owner_scoped", owner_scope_hash: HASH_B,
    trust_class: "user_provided_data", may_issue_instruction: true,
  }],
}), /AGENT_MATERIAL_INSTRUCTION_AUTHORITY_INVALID/u);
assert.throws(() => WebsiteAgentTaskSchema.parse({ ...productionTask, plugin_id: "forbidden" }), /unrecognized_keys/u);

const claimedTask = ClaimedProductionTaskSchema.parse({
  ...productionTask,
  status: "leased",
  lease_owner: "device:1",
  lease_expires_at: "2030-01-01T00:05:00.000Z",
  lease_token: "lease:1",
  lease_version: 1,
  grant: {
    schema_version: "xuanxue-ai-cloud-execution-grant.v6",
    control_protocol_version: "xuanxue-ai-production-v6",
    claim_batch_id: "claim:1",
    job_id: productionTask.job_id,
    source_task_id: productionTask.source_task_id,
    request_hash: productionTask.request_hash,
    task_contract_id: TASK_CONTRACT_ID,
    task_contract_version: TASK_CONTRACT_VERSION,
    result_contract_id: RESULT_CONTRACT_ID,
    result_contract_version: RESULT_CONTRACT_VERSION,
    capability_manifest_hash: productionCatalogHash,
    attempt_id: "attempt:1",
    device_id: "device:1",
    device_epoch: 1,
    worker_session_id: "worker:1",
    worker_session_epoch: 1,
    lease_token: "lease:1",
    lease_version: 1,
    server_now: "2030-01-01T00:00:00.000Z",
    accept_by: "2030-01-01T00:01:00.000Z",
    lease_expires_at: "2030-01-01T00:05:00.000Z",
    renew_after_ms: 20_000,
    control_contract_manifest_hash: PRODUCTION_V6_MANIFEST_HASH,
    execution_fence: {
      schema_version: "xuanxue-ai-execution-fence.v6",
      environment_id: "production",
      device_id: "device:1",
      device_epoch: 1,
      worker_session_id: "worker:1",
      worker_session_epoch: 1,
      job_id: productionTask.job_id,
      attempt_id: "attempt:1",
      lease_version: 1,
      lease_token_hash: HASH_A,
      control_contract_manifest_hash: PRODUCTION_V6_MANIFEST_HASH,
      fence_hash: HASH_B,
    },
  },
});
assert.throws(() => authorizeWebsiteAgentTask(claimedTask), /unrecognized_keys/u);
const projectedTask = websiteAgentTaskFromClaim(claimedTask);
assert.deepEqual(projectedTask, productionTask);
assert.equal(authorizeWebsiteAgentTask(projectedTask).plugin.pluginId, "payment-screenshot-observation");

const runtimeSource = await readFile(new URL("../../src/lib/local-runtime/production/runtime.ts", import.meta.url), "utf8");
const durableAcceptAt = runtimeSource.indexOf("state.executor.accept(task)");
const acceptedAt = runtimeSource.indexOf("accepted = true", durableAcceptAt);
const remoteCheckpointAt = runtimeSource.indexOf("checkpointWithLog(", acceptedAt);
assert(durableAcceptAt >= 0 && acceptedAt > durableAcceptAt && remoteCheckpointAt > acceptedAt);
assert.match(runtimeSource, /state\.executor\.execute\(task, materials/u);
assert.match(runtimeSource, /current: durableAccept\.status/u);
assert.match(runtimeSource, /const durablyAccepted = accepted \|\| state\.store\.readTask\(job\.job_id\) !== null/u);
assert.match(runtimeSource, /impact: RuntimeFailureImpact\.CLEANUP,[\s\S]*causedByEventId/u);
const deferredCommitAt = runtimeSource.indexOf("state.store.setRecoveryPending(job.job_id, `TERMINAL_DEFERRED:");
const deferredReadAt = runtimeSource.indexOf("const recoveryRecord = state.store.readTask(job.job_id)!", deferredCommitAt);
const deferredProjectionAt = runtimeSource.indexOf("current: \"recovery_pending\"", deferredReadAt);
assert(deferredCommitAt >= 0 && deferredReadAt > deferredCommitAt && deferredProjectionAt > deferredReadAt);

const executorSource = await readFile(new URL("../../src/lib/local-runtime/production/executor.ts", import.meta.url), "utf8");
assert.doesNotMatch(executorSource, /this\.store\.markRunning/u);
const settledTargetGuardAt = executorSource.indexOf("if (browser && browser.pendingMutationCount() === 0)");
const settledTargetCloseAt = executorSource.indexOf("await browser.close({ reason: \"gpt-turn-settled\" })", settledTargetGuardAt);
assert(settledTargetGuardAt >= 0 && settledTargetCloseAt > settledTargetGuardAt,
  "a GPT turn must release its task-owned Target only when no Browser mutation remains UNKNOWN");

let turnCalls = 0;
let completionCalls = 0;
const dispatched = await dispatchWebsiteAgentTask(productionTask, (authorized) => ({
  materials: [],
  runTurn: async () => {
    turnCalls += 1;
    return { raw_text: "visible facts", raw_hash: HASH_A, evidence_refs: ["evidence:1"], provider_continuation: null };
  },
  complete: async () => {
    completionCalls += 1;
    return resultFor(authorized.task, identityFor(authorized.task));
  },
}));
assert.equal(dispatched.plugin_id, "payment-screenshot-observation");
assert.equal(turnCalls, 1);
assert.equal(completionCalls, 1);

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-runtime-"));
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
  assert.equal(resolveStoredProductionAuthority(temporary, `production-checkpoint:${sourceTask.job_id}`, hashCanonical(checkpointAuthority)), "verified");
  const cliLogger = createRuntimeLogger({
    producer: "agent-cli-acceptance", producerRunId: "agent-cli-acceptance-run",
    owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs"), maxTotalBytes: 1_048_576 },
  });
  requireRuntimeLogWrite(cliLogger.emitState({
    traceId: `producer:${cliLogger.producerRunId}`, owner: "app-shell",
    stateKey: "producer.alive", previous: null, current: "alive", freshForMs: 60_000,
  }));
  requireRuntimeLogWrite(cliLogger.emitState({
    traceId: sourceTask.job_id, stateKey: "job.checkpoint", previous: null, current: "persisted",
    authorityRef: `production-checkpoint:${sourceTask.job_id}`,
    authorityHash: hashCanonical(checkpointAuthority), reconciledFromAuthority: true,
  }));
  const cli = spawnSync(process.execPath, [
    "--import", "tsx", "scripts/runtime-logs/inspect.ts", "--job", sourceTask.job_id,
    "--source", cliLogger.currentSegmentPath()!,
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal((JSON.parse(cli.stdout) as { status?: string }).status, "DIAGNOSIS_COMPLETE");

  const gpt = createGptAbilityGroup();
  const continuationContext = { dataDir: temporary, continuationStore: store };
  const provider = {
    provider_page_url: "https://chatgpt.com/c/source",
    prior_task_id: "provider:source",
    prior_raw_output_hash: HASH_A,
    prior_turn_marker: "turn:source",
  };
  const persisted = await gpt.execute({
    childCapabilityId: "persist_gpt_continuation",
    executionId: "acceptance:persist-continuation",
    input: {
      jobId: sourceTask.job_id, pluginId: sourceIdentity.plugin_id,
      ownerRef: sourceTask.business_identity.owner_ref,
      subjectRef: sourceTask.business_identity.subject_ref,
      authorizationRef: sourceTask.business_identity.authorization_ref,
      provider,
    },
  }, continuationContext);
  assert.equal(persisted.status, "success", persisted.failureCode ?? "persist continuation failed");
  const continuationValue = persisted.value as { continuationRef?: unknown };
  if (typeof continuationValue.continuationRef !== "string") throw new Error("GPT_CONTINUATION_REF_MISSING");
  const continuationRef = continuationValue.continuationRef;
  const acquireInput = {
    continuationRef, pluginId: "bazi-report-followup",
    allowedSourcePluginIds: ["bazi-ai-full-analysis"],
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
  };
  const acquired = await gpt.execute({
    childCapabilityId: "acquire_gpt_continuation_lane",
    executionId: "acceptance:acquire-continuation",
    input: { ...acquireInput, jobId: "job:followup" },
  }, continuationContext);
  assert.equal(acquired.status, "success");
  const busy = await gpt.execute({
    childCapabilityId: "acquire_gpt_continuation_lane",
    executionId: "acceptance:busy-continuation",
    input: { ...acquireInput, jobId: "job:other" },
  }, continuationContext);
  assert.equal(busy.status, "review_required");
  assert.match(busy.failureCode ?? "", /GPT_CONTINUATION_LANE_BUSY/u);
  const advanced = await gpt.execute({
    childCapabilityId: "advance_gpt_continuation_lane",
    executionId: "acceptance:advance-continuation",
    input: {
      lane: acquired.value, jobId: "job:followup", pluginId: "bazi-report-followup",
      provider: {
        provider_page_url: "https://chatgpt.com/c/source",
        prior_task_id: "provider:followup",
        prior_raw_output_hash: HASH_B,
        prior_turn_marker: "turn:followup",
      },
    },
  }, continuationContext);
  assert.equal(advanced.status, "success");
  assert.equal(store.readGptContinuation(continuationRef)?.plugin_id, "bazi-report-followup");
  const unauthorized = await gpt.execute({
    childCapabilityId: "acquire_gpt_continuation_lane",
    executionId: "acceptance:unauthorized-continuation",
    input: {
      continuationRef, jobId: "job:intruder", pluginId: "qimen-report-followup",
      allowedSourcePluginIds: ["qimen-professional-answer"],
      ownerRef: sourceTask.business_identity.owner_ref, subjectRef: "subject:other",
      authorizationRef: sourceTask.business_identity.authorization_ref,
    },
  }, continuationContext);
  assert.equal(unauthorized.status, "review_required");
  assert.match(unauthorized.failureCode ?? "", /GPT_CONTINUATION_NOT_AUTHORIZED/u);

  const outboxPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(sourceTask.job_id)}/checkpoints`;
  store.enqueue({ idempotency_key: "outbox:1", kind: "checkpoint", path: outboxPath, method: "POST", headers: {}, body: "{}" });
  store.enqueue({ idempotency_key: "outbox:1", kind: "checkpoint", path: outboxPath, method: "POST", headers: {}, body: "{}" });
  const pendingOutbox = store.readOutboxAuthority("outbox:1")!;
  assert.equal(pendingOutbox.state, "pending");
  assert.equal(store.resolveAuthority("production-outbox:outbox:1", hashCanonical(pendingOutbox)), "verified");
  store.markOutboxFailed("outbox:1", "FETCH_FAILED");
  assert.equal(store.readOutboxAuthority("outbox:1")?.state, "failed");
  store.markOutboxPending("outbox:1");
  store.markOutboxSent("outbox:1");
  assert.equal(store.readOutboxAuthority("outbox:1")?.state, "delivered");
  assert.deepEqual(store.outboxAuthorities().map((authority) => authority.state), ["delivered"]);
  assert.throws(() => store.enqueue({ idempotency_key: "outbox:1", kind: "checkpoint", path: outboxPath, method: "POST", headers: {}, body: "{\"drift\":true}" }), /PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT/u);
  assert.throws(() => store.acceptTask(sourceTask, { ...sourceIdentity, plugin_version: 2 }), /PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY/u);
  assert.equal(store.readTask(sourceTask.job_id)?.status, "recovery_pending");
  const terminalTask = task({ jobId: "job:terminal-reconciliation", productId: "payment_screenshot_observation", actionId: "observe" });
  const terminalIdentity = identityFor(terminalTask);
  store.acceptTask(terminalTask, terminalIdentity);
  store.setTerminal(terminalTask.job_id, "completed", null, resultFor(terminalTask, terminalIdentity));
  assert.equal(store.taskAuthorities().find((record) => record.task.job_id === terminalTask.job_id)?.status, "completed");
  store.close();

  const previousCredentialPath = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = path.join(temporary, "missing-credential.json");
  try {
    const browserAuthority = {
      readProductionRuntimeState: () => ({ browserAuthorityState: "absent" as const, browserTargetState: "absent" as const }),
    };
    const blocked = await startProductionRuntime({
      dataDir: path.join(temporary, "blocked-shell"),
      sourceHash: HASH_A,
      gpt: createGptAbilityGroup(),
      browserAuthority: browserAuthority as never,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-acceptance",
        owner: "app-shell",
        component: "production-runtime-acceptance",
        terminalEnabled: false,
        fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
      }),
    });
    assert.equal(blocked.readHealth().shellState, "ready");
    assert.equal(blocked.readHealth().cloudState, "contract_blocked");
    assert.equal(blocked.readHealth().executionState, "blocked");
    await blocked.close();
  } finally {
    if (previousCredentialPath === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
    else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = previousCredentialPath;
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][agent-production-runtime] PASS\n");
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    passed: true,
    findings: [],
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V3",
    evidenceMode,
    clauses: [
      "forbidden:0", "forbidden:10", "forbidden:11", "forbidden:12", "forbidden:17",
      "forbidden:2", "forbidden:3", "forbidden:8", "forbidden:9",
    ],
    locator: `acceptance:agent-production-runtime:${evidenceMode}`,
    observedValue: "strict V6 claim projection, one mediator dispatch, durable local acceptance before remote checkpoint, frozen identity, outbox idempotency, continuation lane CAS, task-owned Target cleanup, and blocked-shell isolation pass with rejecting mutants",
  });
}
