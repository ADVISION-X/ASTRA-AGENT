import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { GPT_TURN_FLOW_VERSION, createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createGptTurnState } from "../../src/lib/local-runtime/production/gpt-turn-state.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import {
  ProductionRuntimeStore,
  resolveStoredProductionAuthority,
} from "../../src/lib/local-runtime/production/store.js";
import { HASH_A, HASH_B, HASH_C, identityFor, task } from "./agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-continuation-"));
const attemptId = "attempt:source:1";
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
  const accepted = store.acceptTask(sourceTask, sourceIdentity, attemptId);
  assert.equal(accepted.status, "failed");
  assert.equal(accepted.current_reason, "LEASE_GRANTED");
  assert.equal(accepted.current_attempt_id, attemptId);
  store.markExecuting(sourceTask.job_id);
  assert.equal(store.readTask(sourceTask.job_id)?.status, "failed");
  assert.equal(store.readTask(sourceTask.job_id)?.current_reason, "EXECUTING");

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
  store.close();

  const restarted = new ProductionRuntimeStore(temporary);
  assert.deepEqual(
    restarted.readGptTurnCheckpoint(sourceTask.job_id, "analyze", HASH_A),
    dispatchedCheckpoint,
    "restart must preserve the exact mutation checkpoint without a reconstruction path",
  );
  assert.equal(restarted.countGptProviderDispatches(sourceTask.job_id), 1);
  restarted.writeGptTurnCheckpoint(sourceTask.job_id, "analyze", {
    ...dispatchedCheckpoint,
    status: "success",
    mutation_state: "confirmed",
    postcondition_result: "passed",
    evidence_ref: "evidence:submit-reconciled",
  });
  assert.throws(
    () => restarted.writeGptTurnCheckpoint(sourceTask.job_id, "analyze", dispatchedCheckpoint),
    /GPT_TURN_CHECKPOINT_REGRESSION/u,
  );

  const checkpointAuthority = restarted.recordCheckpoint({
    jobId: sourceTask.job_id,
    attemptId,
    checkpointId: "progress",
    checkpointHash: HASH_C,
    state: "persisted",
  });
  assert.equal(
    restarted.resolveAuthority(`production-checkpoint:${sourceTask.job_id}`, hashCanonical(checkpointAuthority)),
    "verified",
  );
  assert.equal(
    resolveStoredProductionAuthority(
      temporary,
      `production-checkpoint:${sourceTask.job_id}`,
      hashCanonical(checkpointAuthority),
    ),
    "verified",
  );

  const gpt = createGptAbilityGroup();
  const persisted = await gpt.execute({
    childCapabilityId: "persist_gpt_continuation",
    executionId: "acceptance:persist-continuation",
    ...intentMeta(18),
    input: {
      jobId: sourceTask.job_id,
      pluginId: sourceIdentity.plugin_id,
      ownerRef: sourceTask.business_identity.owner_ref,
      subjectRef: sourceTask.business_identity.subject_ref,
      authorizationRef: sourceTask.business_identity.authorization_ref,
      provider: {
        provider_page_url: "https://chatgpt.com/c/source",
        prior_task_id: "provider:source",
        prior_raw_output_hash: HASH_A,
        prior_turn_marker: "turn:source",
      },
    },
  }, { dataDir: temporary, continuationStore: restarted });
  assert.equal(persisted.status, "success", persisted.failureCode ?? "persist continuation failed");
  assert.equal(typeof Reflect.get(persisted.value ?? {}, "continuationRef"), "string");
  restarted.close();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
