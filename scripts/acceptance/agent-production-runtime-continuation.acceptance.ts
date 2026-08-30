import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { createGptAbilityGroup, type GptChildCapabilityId } from "../../src/capabilities/gpt/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { HASH_A, identityFor, task } from "./agent-production-runtime-fixtures.js";

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
    prior_task_id: "provider:source",
    prior_raw_output_hash: HASH_A,
    prior_turn_marker: "turn:source",
  } as const;
  const persistInput = {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
    provider,
  } as const;
  const persisted = await execute("persist_gpt_continuation", persistInput);
  assert.equal(persisted.status, "success", persisted.failureCode ?? "persist continuation failed");
  const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
  assert.equal(typeof continuationRef, "string");
  const persistedReadback = await executeAt("persist_gpt_continuation", persistInput, ordinal);
  assert.equal(persistedReadback.status, "success", persistedReadback.failureCode ?? "persist readback failed");
  assert.equal(Reflect.get(persistedReadback.value ?? {}, "continuationRef"), continuationRef);

  const acquired = await execute("acquire_gpt_continuation_lane", {
    continuationRef,
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    allowedSourcePluginIds: [identity.plugin_id],
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
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
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    allowedSourcePluginIds: [identity.plugin_id],
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
  });
  assert.equal(reacquired.status, "success", reacquired.failureCode ?? "reacquire continuation failed");
  const advancedProvider = { ...provider, prior_task_id: "provider:advanced", prior_turn_marker: "turn:advanced" } as const;
  const advanceInput = {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    lane: reacquired.value as Readonly<Record<string, unknown>>,
    provider: advancedProvider,
  } as const;
  const advanced = await execute("advance_gpt_continuation_lane", advanceInput);
  assert.equal(advanced.status, "success", advanced.failureCode ?? "advance continuation failed");
  const advancedReadback = await execute("advance_gpt_continuation_lane", advanceInput);
  assert.equal(advancedReadback.status, "success", advancedReadback.failureCode ?? "advance readback failed");

  const currentProvider = {
    ...provider,
    provider_page_url: "https://chatgpt.com/c/current-attempt",
    prior_turn_marker: "turn:current-attempt",
  } as const;
  const currentPersisted = await execute("persist_gpt_continuation", {
    ...persistInput,
    provider: currentProvider,
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
  await execute("persist_gpt_continuation", { ...persistInput, provider: duplicateMarkerProvider });
  assert.throws(
    () => store.readGptContinuationForOriginJob(
      sourceTask.job_id, identity.plugin_id, "turn:current-attempt",
    ),
    /GPT_CONTINUATION_IDENTITY_AMBIGUOUS/u,
  );
  store.close();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
