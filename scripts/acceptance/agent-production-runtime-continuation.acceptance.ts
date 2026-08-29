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
  const execute = (childCapabilityId: GptChildCapabilityId, input: Readonly<Record<string, unknown>>) => {
    ordinal += 1;
    return gpt.execute({
      childCapabilityId,
      executionId: `acceptance:${childCapabilityId}:${ordinal}`,
      attemptId: "attempt:source:1",
      pluginId: identity.plugin_id,
      pluginVersion: identity.plugin_version,
      productStepId: "continuation-contract",
      callId: "continuation-contract",
      inputHash: hashCanonical(input),
      actionOrdinal: ordinal,
      input,
    }, { dataDir: temporary, continuationStore: store });
  };
  const provider = {
    provider_page_url: "https://chatgpt.com/c/source",
    prior_task_id: "provider:source",
    prior_raw_output_hash: HASH_A,
    prior_turn_marker: "turn:source",
  } as const;
  const persisted = await execute("persist_gpt_continuation", {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
    provider,
  });
  assert.equal(persisted.status, "success", persisted.failureCode ?? "persist continuation failed");
  const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
  assert.equal(typeof continuationRef, "string");

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
  store.close();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
