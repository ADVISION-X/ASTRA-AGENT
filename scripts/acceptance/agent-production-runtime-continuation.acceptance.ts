import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  createGptAbilityGroup,
  gptContinuationIdentityHash,
  type GptAbilityGroup,
  type GptContinuationLane,
  type GptProviderContinuation,
} from "../../src/capabilities/gpt/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { HASH_A, HASH_B, HASH_C, identityFor, task } from "./agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-continuation-"));
try {
  const store = new ProductionRuntimeStore(temporary);
  const sourceTask = task({ jobId: "job:source", productId: "bazi_ai_full_analysis", actionId: "produce" });
  const identity = identityFor(sourceTask);
  store.acceptTask(sourceTask, identity, "attempt:source:1");

  const database = new Database(path.join(temporary, "production-runtime.sqlite"), { readonly: true });
  const tables = new Set((database.prepare("select name from sqlite_master where type='table'").all() as Array<{ name: string }>)
    .map((row) => row.name));
  database.close();
  assert.equal(tables.has("production_steps"), false, "global GPT turn checkpoints must be physically absent");

  const gpt = createGptAbilityGroup();
  type ChildIntent = Parameters<GptAbilityGroup["execute"]>[0];
  type ChildId = ChildIntent["childCapabilityId"];
  type ChildInput = ChildIntent["input"];
  let ordinal = 0;
  const executeAt = (
    childCapabilityId: ChildId,
    input: ChildInput,
    actionOrdinal: number,
  ) => {
    const intent = {
      childCapabilityId,
      executionId: `acceptance:${childCapabilityId}:${actionOrdinal}`,
      jobId: sourceTask.job_id,
      attemptId: "attempt:source:1",
      pluginId: identity.plugin_id,
      pluginVersion: identity.plugin_version,
      productStepId: "continuation-contract",
      callId: "continuation-contract",
      inputHash: hashCanonical(input),
      actionOrdinal,
      input,
    } as ChildIntent;
    return gpt.execute(intent, { dataDir: temporary, continuationStore: store });
  };
  const execute = (childCapabilityId: ChildId, input: ChildInput) => {
    ordinal += 1;
    return executeAt(childCapabilityId, input, ordinal);
  };
  const continuationLane = (
    result: Awaited<ReturnType<GptAbilityGroup["execute"]>>,
  ): GptContinuationLane => {
    if (result.status !== "success") throw new Error("GPT_CONTINUATION_LANE_NOT_ACQUIRED");
    const value = result.value;
    if (
      typeof value !== "object"
      || value === null
      || typeof Reflect.get(value, "continuation_ref") !== "string"
      || !Number.isSafeInteger(Reflect.get(value, "lane_version"))
      || typeof Reflect.get(value, "provider") !== "object"
      || Reflect.get(value, "provider") === null
    ) {
      throw new Error("GPT_CONTINUATION_LANE_INVALID");
    }
    return value as GptContinuationLane;
  };
  const provider = {
    provider_page_url: "https://chatgpt.com/c/source",
    prior_task_id: sourceTask.job_id,
    prior_prompt_hash: HASH_B,
    prior_raw_output_hash: HASH_A,
    prior_turn_marker: "turn:source",
  } as const;
  const textCheckpoint = (
    currentProvider: GptProviderContinuation,
    suffix: string,
  ) => ({
    checkpointKind: "text" as const,
    sourceAttemptId: "attempt:source:1",
    assistantTurnId: `assistant:${suffix}`,
    artifactRef: `artifact:${suffix}`,
    rawDomHash: HASH_A,
    semanticTextHash: currentProvider.prior_raw_output_hash,
    canonicalConversationUrl: currentProvider.provider_page_url,
    promptHash: currentProvider.prior_prompt_hash,
    turnMarker: currentProvider.prior_turn_marker,
    evidenceRef: `evidence:${suffix}`,
    evidenceHash: HASH_B,
  });
  const persistInput = {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
    provider,
    currentCheckpoint: textCheckpoint(provider, "source"),
  } as const;
  const persisted = await execute("persist_gpt_continuation", persistInput);
  assert.equal(persisted.status, "success", persisted.failureCode ?? "persist continuation failed");
  const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
  assert.equal(typeof continuationRef, "string");
  const persistedReadback = await executeAt("persist_gpt_continuation", persistInput, ordinal);
  assert.equal(persistedReadback.status, "success", persistedReadback.failureCode ?? "persist readback failed");
  assert.equal(Reflect.get(persistedReadback.value ?? {}, "continuationRef"), continuationRef);
  assert.notEqual(
    gptContinuationIdentityHash(provider),
    gptContinuationIdentityHash({ ...provider, prior_prompt_hash: HASH_C }),
    "continuations that differ only by prompt hash must have different identities",
  );
  const mismatchedPersist = await execute("persist_gpt_continuation", {
    ...persistInput,
    provider: { ...provider, prior_task_id: "job:wrong-provider-task" },
    currentCheckpoint: textCheckpoint(
      { ...provider, prior_task_id: "job:wrong-provider-task" }, "wrong-provider-task",
    ),
  });
  assert.equal(mismatchedPersist.status, "failed");
  assert.equal(mismatchedPersist.failureCode, "GPT_CONTINUATION_PROVIDER_CHECKPOINT_MISMATCH");

  const acquired = await execute("acquire_gpt_continuation_lane", {
    continuationRef,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorization: {
      kind: "row_authorization",
      currentAuthorizationRef: sourceTask.business_identity.authorization_ref,
    },
  });
  assert.equal(acquired.status, "success", acquired.failureCode ?? "acquire continuation failed");
  const acquiredLane = continuationLane(acquired);
  const released = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: acquiredLane,
  });
  assert.equal(released.status, "success", released.failureCode ?? "release continuation failed");
  const releasedReadback = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: acquiredLane,
  });
  assert.equal(releasedReadback.status, "success", releasedReadback.failureCode ?? "release readback failed");

  const reacquired = await execute("acquire_gpt_continuation_lane", {
    continuationRef,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorization: {
      kind: "row_authorization",
      currentAuthorizationRef: sourceTask.business_identity.authorization_ref,
    },
  });
  assert.equal(reacquired.status, "success", reacquired.failureCode ?? "reacquire continuation failed");
  const reacquiredLane = continuationLane(reacquired);
  const advancedProvider = { ...provider, prior_turn_marker: "turn:advanced" } as const;
  const advanceInput = {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    lane: reacquiredLane,
    provider: advancedProvider,
    currentCheckpoint: textCheckpoint(advancedProvider, "advanced"),
  } as const;
  const advanced = await execute("advance_gpt_continuation_lane", advanceInput);
  assert.equal(advanced.status, "success", advanced.failureCode ?? "advance continuation failed");
  const advancedReadback = await execute("advance_gpt_continuation_lane", advanceInput);
  assert.equal(advancedReadback.status, "success", advancedReadback.failureCode ?? "advance readback failed");
  const settledOldLaneRelease = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: reacquiredLane,
  });
  assert.equal(settledOldLaneRelease.status, "success",
    "a committed advance must make the old same-version lane release an idempotent no-op");

  const currentProvider = {
    ...provider,
    provider_page_url: "https://chatgpt.com/c/current-attempt",
    prior_turn_marker: "turn:current-attempt",
  } as const;
  const currentPersisted = await execute("persist_gpt_continuation", {
    ...persistInput,
    provider: currentProvider,
    currentCheckpoint: textCheckpoint(currentProvider, "current-attempt"),
  });
  const currentContinuationRef = Reflect.get(currentPersisted.value ?? {}, "continuationRef");
  assert.equal(typeof currentContinuationRef, "string");
  assert.equal(
    store.readGptContinuationForOriginJob(
      sourceTask.job_id, identity.plugin_id, "turn:advanced",
    )?.continuation_ref,
    continuationRef,
    "an older attempt marker must select only its exact continuation",
  );
  assert.equal(
    store.readGptContinuationForOriginJob(
      sourceTask.job_id, identity.plugin_id, "turn:current-attempt",
    )?.continuation_ref,
    currentContinuationRef,
    "the current attempt marker must not collide with an older continuation for the same job",
  );
  assert.equal(
    store.readGptContinuationForOriginJob(sourceTask.job_id, identity.plugin_id, "turn:missing"),
    null,
  );

  const duplicateMarkerProvider = {
    ...currentProvider,
    provider_page_url: "https://chatgpt.com/c/current-attempt-conflict",
  } as const;
  await execute("persist_gpt_continuation", {
    ...persistInput,
    provider: duplicateMarkerProvider,
    currentCheckpoint: textCheckpoint(duplicateMarkerProvider, "current-attempt-conflict"),
  });
  assert.throws(
    () => store.readGptContinuationForOriginJob(
      sourceTask.job_id, identity.plugin_id, "turn:current-attempt",
    ),
    /GPT_CONTINUATION_IDENTITY_AMBIGUOUS/u,
  );

  const frontierRef = hashCanonical({
    identity_type: "gpt-continuation-frontier.v1",
    job_id: sourceTask.job_id,
    plugin_id: identity.plugin_id,
    owner_ref: sourceTask.business_identity.owner_ref,
    subject_ref: sourceTask.business_identity.subject_ref,
    authorization_ref: sourceTask.business_identity.authorization_ref,
    product_step_id: "corpus_research",
  });
  const frontierProvider = {
    ...provider,
    prior_task_id: sourceTask.job_id,
    prior_turn_marker: "turn:frontier",
  } as const;
  const frontierInput = {
    ...persistInput,
    provider: frontierProvider,
    currentCheckpoint: textCheckpoint(frontierProvider, "frontier"),
    frontier: {
      frontierRef,
      originCheckpoint: {
        sourceAttemptId: "attempt:source:1",
        assistantTurnId: "assistant:frontier",
        artifactRef: "artifact:frontier",
        rawDomHash: HASH_A,
        semanticTextHash: HASH_A,
        canonicalConversationUrl: frontierProvider.provider_page_url,
        promptHash: frontierProvider.prior_prompt_hash,
        turnMarker: frontierProvider.prior_turn_marker,
        evidenceRef: "evidence:frontier",
        evidenceHash: HASH_B,
      },
    },
  } as const;
  const frontierPersisted = await execute("persist_gpt_continuation", frontierInput);
  assert.equal(frontierPersisted.status, "success", frontierPersisted.failureCode ?? "frontier persist failed");
  const frontierContinuationRef = Reflect.get(frontierPersisted.value ?? {}, "continuationRef");
  assert.equal(store.readGptContinuationForFrontier(frontierRef)?.continuation_ref, frontierContinuationRef);
  assert.deepEqual(store.readGptContinuationForFrontier(frontierRef)?.origin_provider, frontierProvider);
  assert.equal(store.readGptContinuationForFrontier(frontierRef)?.origin_checkpoint?.artifact_ref,
    "artifact:frontier");
  const frontierReadback = await executeAt("persist_gpt_continuation", frontierInput, ordinal);
  assert.equal(Reflect.get(frontierReadback.value ?? {}, "continuationRef"), frontierContinuationRef,
    "same exact frontier persist must read back the original continuation");
  const frontierConflict = await execute("persist_gpt_continuation", {
    ...frontierInput,
    provider: { ...frontierProvider, prior_prompt_hash: HASH_C },
    currentCheckpoint: textCheckpoint(
      { ...frontierProvider, prior_prompt_hash: HASH_C }, "frontier-conflict",
    ),
    frontier: {
      ...frontierInput.frontier,
      originCheckpoint: {
        ...frontierInput.frontier.originCheckpoint,
        assistantTurnId: "assistant:frontier-conflict",
        artifactRef: "artifact:frontier-conflict",
        evidenceRef: "evidence:frontier-conflict",
        promptHash: HASH_C,
      },
    },
  });
  assert.equal(frontierConflict.status, "failed");
  assert.equal(frontierConflict.failureCode, "GPT_CONTINUATION_FRONTIER_CONFLICT");
  assert.equal(store.readGptContinuationForFrontier(HASH_C), null,
    "a legacy/null frontier continuation must never be guessed as task frontier");
  const currentReasonBeforeCorruption = store.readTask(sourceTask.job_id)?.current_reason;
  store.close();

  const incompleteDatabase = new Database(path.join(temporary, "production-runtime.sqlite"));
  incompleteDatabase.prepare(`update production_continuations set current_checkpoint_json=null
    where continuation_ref=?`).run(frontierContinuationRef);
  incompleteDatabase.close();
  const incompleteStore = new ProductionRuntimeStore(temporary);
  assert.equal(incompleteStore.frontierContinuationInvariantFailures().length, 1);
  assert.equal(
    incompleteStore.readTask(sourceTask.job_id)?.current_reason,
    currentReasonBeforeCorruption,
    "Runtime startup must not interpret or rewrite Product checkpoint semantics",
  );
  assert.equal(
    incompleteStore.readGptContinuation(frontierContinuationRef as string)?.current_checkpoint,
    null,
    "Runtime startup must never write or guess a Product checkpoint",
  );
  incompleteStore.close();

  const invalidDatabase = new Database(path.join(temporary, "production-runtime.sqlite"));
  invalidDatabase.prepare(`update production_continuations
    set current_checkpoint_json=origin_checkpoint_json,conversation_identity_hash=null
    where continuation_ref=?`).run(frontierContinuationRef);
  invalidDatabase.close();
  const invalidStore = new ProductionRuntimeStore(temporary);
  assert.deepEqual(invalidStore.frontierContinuationInvariantFailures(), [{
    origin_job_id: sourceTask.job_id,
    reason: "GPT_CONTINUATION_FRONTIER_INVALID",
  }]);
  assert.equal(invalidStore.readTask(sourceTask.job_id)?.current_reason, currentReasonBeforeCorruption);
  invalidStore.setCurrentReason(sourceTask.job_id, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  assert.equal(
    invalidStore.readTask(sourceTask.job_id)?.current_reason,
    "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
    "a frontier invariant failure must not overwrite Website's permanent authorization revocation",
  );
  assert.throws(
    () => invalidStore.readGptContinuationForFrontier(frontierRef),
    /GPT_CONTINUATION_FRONTIER_INVALID/u,
    "a present but unusable frontier must fail before Product can treat it as a fresh task",
  );
  invalidStore.close();

} finally {
  await rm(temporary, { recursive: true, force: true });
}
