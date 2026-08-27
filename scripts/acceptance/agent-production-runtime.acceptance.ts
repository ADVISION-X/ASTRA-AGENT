import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createGptAbilityGroup, GptSessionController } from "../../src/capabilities/gpt/index.js";
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
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
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
  store.setRecoveryPending(sourceTask.job_id, "network");
  assert.equal(store.readTask(sourceTask.job_id)?.status, "recovery_pending");

  const controller = new GptSessionController(store);
  const continuationRef = controller.persist({
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
  });
  assert(continuationRef);
  const lane = controller.acquire({
    continuationRef,
    jobId: "job:followup",
    pluginId: "bazi-report-followup",
    allowedSourcePluginIds: ["bazi-ai-full-analysis"],
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
  });
  assert.throws(() => controller.acquire({
    continuationRef,
    jobId: "job:other",
    pluginId: "bazi-report-followup",
    allowedSourcePluginIds: ["bazi-ai-full-analysis"],
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
  }), /GPT_CONTINUATION_LANE_BUSY/u);
  controller.advance({
    lane,
    jobId: "job:followup",
    pluginId: "bazi-report-followup",
    provider: {
      provider_page_url: "https://chatgpt.com/c/source",
      prior_task_id: "provider:followup",
      prior_raw_output_hash: HASH_B,
      prior_turn_marker: "turn:followup",
    },
  });
  assert.equal(store.readGptContinuation(continuationRef)?.plugin_id, "bazi-report-followup");
  assert.throws(() => controller.acquire({
    continuationRef,
    jobId: "job:intruder",
    pluginId: "qimen-report-followup",
    allowedSourcePluginIds: ["qimen-professional-answer"],
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: "subject:other",
    authorizationRef: sourceTask.business_identity.authorization_ref,
  }), /GPT_CONTINUATION_NOT_AUTHORIZED/u);

  store.enqueue({ idempotency_key: "outbox:1", kind: "checkpoint", path: "/checkpoint", method: "POST", headers: {}, body: "{}" });
  store.enqueue({ idempotency_key: "outbox:1", kind: "checkpoint", path: "/checkpoint", method: "POST", headers: {}, body: "{}" });
  assert.throws(() => store.enqueue({ idempotency_key: "outbox:1", kind: "checkpoint", path: "/checkpoint", method: "POST", headers: {}, body: "{\"drift\":true}" }), /PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT/u);
  assert.throws(() => store.acceptTask(sourceTask, { ...sourceIdentity, plugin_version: 2 }), /PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY/u);
  assert.equal(store.readTask(sourceTask.job_id)?.status, "review_required");
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
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V2",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:2", "forbidden:7", "forbidden:9", "forbidden:10", "forbidden:14"],
    locator: `acceptance:agent-production-runtime:${evidenceMode}`,
    observedValue: "strict contracts, one mediator dispatch, durable identity, outbox idempotency, continuation lane CAS, and blocked-shell isolation pass with rejecting mutants",
  });
}
