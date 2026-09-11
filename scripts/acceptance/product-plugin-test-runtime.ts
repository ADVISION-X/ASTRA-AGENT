import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  gptAttachmentProviderDisplayName,
  type ProductGptAnyCallInput,
  type ProductGptTools,
} from "../../src/capabilities/gpt/index.js";
import {
  sha256,
  type ProductionHash,
  type WebsiteAgentTask,
  type ProductPlugin,
  type ProductPluginOutput,
  type SharedExecutionContext,
} from "../../src/mediator/product-plugin-contract.js";
import {
  productionRoutePolicy,
  type ProductionRoutePolicy,
} from "../../src/lib/local-runtime/production/route-policy.js";

export const FIXTURE_HASH = `sha256:${"a".repeat(64)}` as ProductionHash;
export const FIXTURE_HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;

type ProductCall = ProductGptAnyCallInput & Readonly<{ sessionKey: string }>;
type ProductExecuteInput = Parameters<ProductGptTools["execute"]>[0];

export type ProductTaskFixture = Readonly<{
  parameters: Readonly<Record<string, unknown>>;
  privacySubjectRef?: string;
  reviewPolicy?: "manual-accuracy-challenge.v1" | "scheduled-quality-reflection.v1";
}>;

export type ProductFlowFixture = Readonly<{
  task: WebsiteAgentTask;
  output: Readonly<Record<string, unknown>>;
  materialContents?: Readonly<Record<string, unknown>>;
  checkpointOutput?: (call: ProductCall) => Readonly<Record<string, unknown>>;
  expectedSessionCount?: number;
}>;

const exactKeys = (value: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.keys(value).sort();

export const buildProductTask = (
  route: ProductionRoutePolicy,
  fixture: ProductTaskFixture,
): WebsiteAgentTask => {
  assert.deepEqual(exactKeys(fixture.parameters), [...route.required_parameter_keys].sort(),
    `${route.product_id}:${route.action_id} fixture parameters must match its current projection`);
  const task = {
    schema_version: "website-agent-task.v1",
    protocol_version: "xuanxue-ai-production-v6",
    job_id: `job:${route.product_id}:${route.action_id}`,
    source_task_id: `source:${route.product_id}:${route.action_id}`,
    product_id: route.product_id,
    action_id: route.action_id,
    idempotency_key: `idempotency:${route.product_id}:${route.action_id}`,
    request_hash: FIXTURE_HASH,
    task_contract_id: "website-agent-task",
    task_contract_version: 1,
    business_identity: {
      owner_ref: "owner:1", subject_ref: "subject:1", authorization_ref: "authorization:1",
    },
    business_context_ref: "context:1",
    business_context_hash: FIXTURE_HASH,
    parameters: { ...fixture.parameters },
    material_refs: route.material_roles.map((material, ordinal) => ({
      material_id: `material:${ordinal}`,
      ordinal,
      role: material.role,
      display_name: `material-${ordinal}.json`,
      object_ref: material.role === "subject_result" ? "result:subject" : `object:${ordinal}`,
      sha256: FIXTURE_HASH,
      bytes: 10,
      media_type: material.media_types[0]!,
      storage_class: material.storage_class,
      owner_scope_hash: material.owner_scope_policy === "required" ? FIXTURE_HASH_B : null,
      trust_class: material.trust_class,
      may_issue_instruction: material.may_issue_instruction,
    })),
    result_contract_id: "website-agent-result",
    result_contract_version: 1,
    ...(fixture.privacySubjectRef ? { privacy_subject_ref: fixture.privacySubjectRef } : {}),
    ...(route.relation_kind === "followup" ? {
      parent_task_ref: "task:parent",
      parent_result_ref: "result:parent",
      parent_result_hash: FIXTURE_HASH,
    } : {}),
    ...(route.relation_kind === "review" ? {
      subject_task_ref: "task:subject",
      subject_result_ref: "result:subject",
      subject_result_hash: FIXTURE_HASH,
      review_policy: fixture.reviewPolicy,
    } : {}),
  };
  return task as WebsiteAgentTask;
};

const checkpointValue = (
  fixture: ProductFlowFixture,
  call: ProductCall,
): Readonly<Record<string, unknown>> => fixture.checkpointOutput?.(call) ?? fixture.output;

type ExecutionValueInput = {
  call: ProductCall;
  fixture: ProductFlowFixture;
};
type ExecutionValue = Readonly<{
  value: unknown;
}>;

const attachmentExecutionValue = (input: ExecutionValueInput): ExecutionValue => {
  const callInput = input.call.input as Readonly<Record<string, unknown>>;
  const files = Array.isArray(callInput.files) ? callInput.files : [];
    return { value: { files: files.map((entry) => {
    assert(entry && typeof entry === "object" && !Array.isArray(entry));
    const file = entry as Readonly<Record<string, unknown>>;
    return {
      artifactRef: file.artifactRef,
      displayName: file.displayName,
      providerDisplayName: gptAttachmentProviderDisplayName(
        String(file.displayName), input.fixture.task.job_id, String(file.artifactRef),
      ),
      sha256: file.sha256,
      bytes: file.bytes,
    };
  }) } };
};

const observationExecutionValue = (input: ExecutionValueInput): ExecutionValue | null => {
  const { call, fixture } = input;
  if (call.child === "reconcile_gpt_attachment_set") return attachmentExecutionValue(input);
  if (call.child === "submit_exact_gpt_turn_once") {
    return { value: { status: "CONFIRMED", promptHash: call.input.promptHash,
      mutationSent: true,
      canonicalConversationUrl: `https://chatgpt.com/c/${sha256(call.sessionKey).slice(7, 31)}`,
      userTurnId: "conversation-turn-1" } };
  }
  if (call.child === "checkpoint_gpt_text_response") {
    const output = checkpointValue(fixture, call);
    const semanticText = JSON.stringify(output);
    return { value: {
      assistantTurnId: "conversation-turn-2",
      rawDomHtml: `<article>${semanticText}</article>`, rawDomHash: FIXTURE_HASH,
      semanticText, semanticTextHash: FIXTURE_HASH,
    } };
  }
  return null;
};

const executeValue = (input: ExecutionValueInput): ExecutionValue =>
  observationExecutionValue(input) ?? { value: {} };

type ProductRunState = {
  calls: ProductCall[];
  continuationAcquires: Parameters<ProductGptTools["acquireContinuation"]>[0][];
  continuationRecords: Parameters<ProductGptTools["recordContinuation"]>[0][];
  completed: ProductPluginOutput | null;
  physicalSubmitDispatches: number;
  generatedImageUploads: number;
};

const createMaterials = (root: string, fixture: ProductFlowFixture) =>
  fixture.task.material_refs.map((material) => {
    const localPath = join(root, material.display_name);
    const content = fixture.materialContents?.[material.role]
      ?? (material.role === "result_contract" ? { schema_version: "fixture-result-contract.v1" }
        : { schema_version: `${material.role}.fixture.v1` });
    const bytes = JSON.stringify(content);
    writeFileSync(localPath, bytes, "utf8");
    return { ...material, sha256: sha256(bytes), bytes: Buffer.byteLength(bytes), local_path: localPath };
  });

const createGptFixture = (
  state: ProductRunState,
  fixture: ProductFlowFixture,
): SharedExecutionContext["gpt"] => ({
  jobId: fixture.task.job_id,
  attemptId: "attempt-1",
  acquireContinuation: async (input) => {
    state.continuationAcquires.push(input);
    return Object.freeze({
      canonicalConversationUrl: "https://chatgpt.com/c/fixture-continuation",
      promptHash: FIXTURE_HASH,
      turnMarker: "[GRASSEYE:fixture-predecessor]",
      assistantTurnId: "conversation-turn-2",
      semanticTextHash: FIXTURE_HASH,
    });
  },
  recordContinuation: (input) => { state.continuationRecords.push(input); },
  execute: async (call: ProductExecuteInput) => {
    const productCall = call as ProductCall;
    state.calls.push(productCall);
    if (productCall.child === "submit_exact_gpt_turn_once") state.physicalSubmitDispatches += 1;
    const evidenceRef = `evidence:${state.calls.length}`;
    const outcome = executeValue({ call: productCall, fixture });
    return { value: outcome.value, evidenceRef, evidenceHash: FIXTURE_HASH,
      sourceAttemptId: "attempt-1", exactCallIdentityHash: FIXTURE_HASH,
      artifactRefs: productCall.child === "checkpoint_gpt_text_response" ? ["artifact:checkpoint"] : [],
      effectReceipt: productCall.child === "submit_exact_gpt_turn_once" ? {
        effectScope: "provider_effect", outcome: "CONFIRMED", mutationOutcome: "confirmed",
        terminalAt: "2020-01-01T00:00:00.000Z", evidenceRef, evidenceHash: FIXTURE_HASH,
      } : null } as never;
  },
});

const createProductContext = (
  root: string,
  state: ProductRunState,
  fixture: ProductFlowFixture,
): SharedExecutionContext => ({
  materials: createMaterials(root, fixture),
  routePolicy: productionRoutePolicy(fixture.task.product_id, fixture.task.action_id),
  productSkill: Object.freeze({ text: "fixture product skill", hash: FIXTURE_HASH }),
  gpt: createGptFixture(state, fixture),
  resultRevision: { revision: 0, priorRejection: null },
  uploadGeneratedImage: async (artifact) => {
    state.generatedImageUploads += 1;
    return Object.freeze({
      artifact_id: artifact.artifact_id,
      object_ref: `object:${artifact.artifact_id}`,
      sha256: artifact.sha256,
      receipt_hash: FIXTURE_HASH_B,
      bytes: artifact.bytes,
      mime_type: artifact.media_type,
      width: artifact.width,
      height: artifact.height,
    });
  },
  complete: async (output) => {
    state.completed = output;
    return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
  },
});

export const exerciseProductFlow = async (
  plugin: ProductPlugin,
  fixture: ProductFlowFixture,
): Promise<Readonly<{
  calls: readonly ProductCall[];
  continuationAcquires: readonly Parameters<ProductGptTools["acquireContinuation"]>[0][];
  continuationRecords: readonly Parameters<ProductGptTools["recordContinuation"]>[0][];
  completed: ProductPluginOutput;
  physicalSubmitDispatches: number;
  generatedImageUploads: number;
}>> => {
  const root = mkdtempSync(join(tmpdir(), "grasseye-product-acceptance-"));
  const state: ProductRunState = {
    calls: [], continuationAcquires: [], continuationRecords: [], completed: null,
    physicalSubmitDispatches: 0, generatedImageUploads: 0,
  };
  try {
    await plugin.execute(fixture.task, createProductContext(root, state, fixture));
    assert(state.completed);
    assert.equal(new Set(state.calls.map((call) => call.sessionKey)).size, fixture.expectedSessionCount ?? 1);
    assert.ok(state.calls.every((call) => call.sessionKey.includes(plugin.pluginId)));
    return { calls: state.calls, continuationAcquires: state.continuationAcquires,
      continuationRecords: state.continuationRecords, completed: state.completed,
      physicalSubmitDispatches: state.physicalSubmitDispatches,
      generatedImageUploads: state.generatedImageUploads };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

export const routesForPlugin = (
  plugin: ProductPlugin,
  policies: readonly ProductionRoutePolicy[],
): readonly ProductionRoutePolicy[] => plugin.accepts.map((accepted) => {
  const route = policies.find((candidate) => candidate.product_id === accepted.productId
    && candidate.action_id === accepted.actionId);
  assert(route, `missing route policy for ${accepted.productId}:${accepted.actionId}`);
  return route;
});
