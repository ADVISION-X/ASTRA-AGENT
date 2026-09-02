import assert from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  createGptAbilityGroup,
  gptContinuationIdentityHash,
  type GptChildCapabilityId,
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
  let ordinal = 0;
  const executeAt = (
    childCapabilityId: GptChildCapabilityId,
    input: Readonly<Record<string, unknown>>,
    actionOrdinal: number,
  ) => {
    return gpt.execute({
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
    }, { dataDir: temporary, continuationStore: store });
  };
  const execute = (childCapabilityId: GptChildCapabilityId, input: Readonly<Record<string, unknown>>) => {
    ordinal += 1;
    return executeAt(childCapabilityId, input, ordinal);
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
  const released = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: acquired.value as Readonly<Record<string, unknown>>,
  });
  assert.equal(released.status, "success", released.failureCode ?? "release continuation failed");
  const releasedReadback = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: acquired.value as Readonly<Record<string, unknown>>,
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
  const advancedProvider = { ...provider, prior_turn_marker: "turn:advanced" } as const;
  const advanceInput = {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    lane: reacquired.value as Readonly<Record<string, unknown>>,
    provider: advancedProvider,
    currentCheckpoint: textCheckpoint(advancedProvider, "advanced"),
  } as const;
  const advanced = await execute("advance_gpt_continuation_lane", advanceInput);
  assert.equal(advanced.status, "success", advanced.failureCode ?? "advance continuation failed");
  const advancedReadback = await execute("advance_gpt_continuation_lane", advanceInput);
  assert.equal(advancedReadback.status, "success", advancedReadback.failureCode ?? "advance readback failed");
  const settledOldLaneRelease = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: reacquired.value as Readonly<Record<string, unknown>>,
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
  store.close();

  const legacyDatabase = new Database(path.join(temporary, "production-runtime.sqlite"));
  legacyDatabase.pragma("foreign_keys = OFF");
  const legacyCount = Number((legacyDatabase.prepare(
    "select count(*) as count from production_continuations",
  ).get() as { count: number }).count);
  legacyDatabase.exec(`begin;
    alter table production_continuations rename to production_continuations_frontier_source;
    create table production_continuations(
      continuation_ref text primary key,
      origin_job_id text not null references production_tasks(job_id) on delete restrict,
      plugin_id text not null, owner_ref text not null, subject_ref text not null,
      authorization_ref text not null, conversation_identity_hash text not null,
      provider_json text not null, lane_version integer not null,
      lane_owner_job_id text, created_at text not null
    );
    insert into production_continuations(
      continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,authorization_ref,
      conversation_identity_hash,provider_json,lane_version,lane_owner_job_id,created_at
    ) select continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,authorization_ref,
      conversation_identity_hash,provider_json,lane_version,lane_owner_job_id,created_at
      from production_continuations_frontier_source;
    drop table production_continuations_frontier_source;
    commit;`);
  legacyDatabase.close();

  const migratedStore = new ProductionRuntimeStore(temporary);
  const migratedDatabase = new Database(path.join(temporary, "production-runtime.sqlite"), { readonly: true });
  const migratedColumns = new Set((migratedDatabase.prepare(
    "pragma table_info(production_continuations)",
  ).all() as Array<{ name: string }>).map((column) => column.name));
  const migratedCount = Number((migratedDatabase.prepare(
    "select count(*) as count from production_continuations",
  ).get() as { count: number }).count);
  migratedDatabase.close();
  assert.equal(migratedCount, legacyCount, "nonempty in-place migration must preserve every continuation row");
  assert.deepEqual([...migratedColumns].filter((column) => [
    "current_checkpoint_json", "frontier_ref", "origin_provider_json", "origin_checkpoint_json",
  ].includes(column)).sort(), [
    "current_checkpoint_json", "frontier_ref", "origin_checkpoint_json", "origin_provider_json",
  ]);
  assert.equal(migratedStore.readGptContinuationForFrontier(frontierRef), null,
    "pre-frontier rows must remain null and must not be auto-promoted during migration");
  const migratedLegacy = migratedStore.readGptContinuation(frontierContinuationRef as string);
  assert(migratedLegacy);
  assert.equal(migratedLegacy.frontier_ref, null);
  assert.deepEqual(migratedLegacy.origin_provider, migratedLegacy.provider,
    "migration may preserve the old provider as origin but must not invent a task frontier");
  assert.equal(migratedLegacy.current_checkpoint, null,
    "a legacy continuation without a verified checkpoint must remain task-locally fail-closed");
  migratedStore.close();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
