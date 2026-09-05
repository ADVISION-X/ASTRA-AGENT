import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  gptAttachmentProviderDisplayName,
  type ProductGptAnyCallInput,
  type ProductGptTools,
  type GptProviderContinuation,
} from "../../src/capabilities/gpt/index.js";
import {
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentTask,
  type ProductPlugin,
  type ProductPluginOutput,
  type SharedExecutionContext,
} from "../../src/mediator/product-plugin-contract.js";
import type {
  ExactGptContinuationReadback,
} from "../../src/capabilities/gpt/index.js";
import {
  productionRoutePolicy,
  type ProductionRoutePolicy,
} from "../../src/lib/local-runtime/production/route-policy.js";

export const FIXTURE_HASH = `sha256:${"a".repeat(64)}` as ProductionHash;
export const FIXTURE_HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;

type ProductCall = ProductGptAnyCallInput & Readonly<{ sessionKey: string }>;
type ProductExecuteInput = Parameters<ProductGptTools["execute"]>[0];
type ProductFact = Readonly<{ evidenceRef: string; mutation: boolean }>;

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
  continuationReadback?: ExactGptContinuationReadback;
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
    ...(route.relation_kind === "continuation" ? {
      continuation_ref: "continuation:1",
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

const initialProvider = (): GptProviderContinuation => Object.freeze({
  provider_page_url: "https://chatgpt.com/c/parent",
  prior_task_id: "task:parent",
  prior_prompt_hash: FIXTURE_HASH,
  prior_raw_output_hash: FIXTURE_HASH,
  prior_turn_marker: `[GRASSEYE:${"b".repeat(24)}]`,
});

const callKey = (call: Omit<ProductCall, "sessionKey">): string => hashCanonical({
  productStepId: call.productStepId,
  callId: call.callId,
  child: call.child,
  actionOrdinal: call.actionOrdinal,
  input: call.input,
});

const checkpointValue = (
  fixture: ProductFlowFixture,
  call: ProductCall,
): Readonly<Record<string, unknown>> => fixture.checkpointOutput?.(call) ?? fixture.output;

type ExecutionValueInput = {
  call: ProductCall;
  fixture: ProductFlowFixture;
  laneOwned: boolean;
  provider: GptProviderContinuation | null;
};
type ExecutionValue = Readonly<{
  laneOwned: boolean;
  provider: GptProviderContinuation | null;
  value: unknown;
}>;

const attachmentExecutionValue = (input: ExecutionValueInput): ExecutionValue => {
  const callInput = input.call.input as Readonly<Record<string, unknown>>;
  const files = Array.isArray(callInput.files) ? callInput.files : [];
  return { ...input, value: { files: files.map((entry) => {
    assert(entry && typeof entry === "object" && !Array.isArray(entry));
    const file = entry as Readonly<Record<string, unknown>>;
    return {
      artifactRef: file.artifactRef,
      displayName: file.displayName,
      providerDisplayName: gptAttachmentProviderDisplayName(
        String(file.displayName), "attempt-1", String(file.artifactRef),
      ),
      sha256: file.sha256,
      bytes: file.bytes,
    };
  }) } };
};

const observationExecutionValue = (input: ExecutionValueInput): ExecutionValue | null => {
  const { call, fixture } = input;
  if (call.child === "reconcile_gpt_attachment_set") return attachmentExecutionValue(input);
  if (call.child === "reconcile_gpt_turn_submission") {
    return { ...input, value: { canonicalConversationUrl: "https://chatgpt.com/c/current" } };
  }
  if (call.child === "wait_for_stable_gpt_text") {
    return { ...input, value: { assistantTurnId: "assistant:1", responseHash: FIXTURE_HASH } };
  }
  if (call.child === "checkpoint_gpt_text_response") {
    const output = checkpointValue(fixture, call);
    const semanticText = JSON.stringify(output);
    return { ...input, value: {
      rawDomHtml: `<article>${semanticText}</article>`, rawDomHash: FIXTURE_HASH,
      semanticText, semanticTextHash: FIXTURE_HASH,
    } };
  }
  return null;
};

const reservationExecutionValue = (input: ExecutionValueInput): ExecutionValue | null => {
  const { call } = input;
  if (call.child === "reserve_exact_gpt_continuation_once") {
    return { ...input, value: {
      continuationRef: `gpt-continuation:${String(call.input.reservationIdentityHash).slice(7)}`,
      reservationIdentityHash: call.input.reservationIdentityHash,
      laneVersion: call.input.laneVersion,
      reservationFenceHash: call.input.reservationFenceHash,
      complete: false,
      opaqueReadGrantHash: null,
    } };
  }
  if (call.child === "complete_exact_gpt_continuation_reservation_once") {
    return { ...input, provider: call.input.provider as GptProviderContinuation,
      value: { completionReceiptHash: call.input.completionReceiptHash } };
  }
  if (call.child === "fork_exact_gpt_conversation_at_checkpoint") {
    return { ...input, value: {
      sourceAssistantTurnId: call.input.sourceAssistantTurnId,
      sourceCanonicalConversationUrl: call.input.sourceCanonicalConversationUrl,
      childCanonicalConversationUrl: "https://chatgpt.com/c/formal-child",
      sourceToChildRelationHash: FIXTURE_HASH,
    } };
  }
  if (call.child === "persist_gpt_continuation") {
    return { ...input, provider: call.input.provider as GptProviderContinuation,
      value: { continuationRef: "continuation:created" } };
  }
  return null;
};

const laneExecutionValue = (input: ExecutionValueInput): ExecutionValue => {
  const { call } = input;
  if (call.child === "acquire_gpt_continuation_lane") {
    assert.equal(input.laneOwned, false);
    return { ...input, laneOwned: true, value: {
      continuation_ref: call.input.continuationRef, lane_version: 1, provider: input.provider,
    } };
  }
  if (call.child === "advance_gpt_continuation_lane") {
    assert.equal(input.laneOwned, true);
    return { ...input, laneOwned: false, provider: call.input.provider as GptProviderContinuation,
      value: undefined };
  }
  if (call.child === "release_gpt_continuation_lane") {
    return { ...input, laneOwned: false, value: undefined };
  }
  return { ...input, value: {} };
};

const executeValue = (input: ExecutionValueInput): ExecutionValue =>
  observationExecutionValue(input) ?? reservationExecutionValue(input) ?? laneExecutionValue(input);

type ProductRunState = {
  calls: ProductCall[];
  completed: ProductPluginOutput | null;
  continuationReads: unknown[];
  facts: Map<string, ProductFact>;
  laneOwned: boolean;
  physicalSubmitDispatches: number;
  generatedImageUploads: number;
  provider: GptProviderContinuation | null;
};

const createMaterials = (root: string, fixture: ProductFlowFixture) =>
  fixture.task.material_refs.map((material) => {
    const localPath = join(root, material.display_name);
    const content = fixture.materialContents?.[material.role]
      ?? (material.role === "result_contract" ? { schema_version: "fixture-result-contract.v1" }
        : { schema_version: `${material.role}.fixture.v1` });
    writeFileSync(localPath, JSON.stringify(content), "utf8");
    return { ...material, local_path: localPath };
  });

const createGptFixture = (
  state: ProductRunState,
  fixture: ProductFlowFixture,
): SharedExecutionContext["gpt"] => ({
  attemptId: "attempt-1",
  readContinuationExact: async (query) => {
    state.continuationReads.push(query);
    return fixture.continuationReadback ?? null;
  },
  readConfirmedSubmitFailure: async () => null,
  readCallFacts: async (call) => {
    const fact = state.facts.get(callKey(call));
    return {
      exactCallIdentityHash: FIXTURE_HASH,
      mutation: fact?.mutation ? {
        owner: "browser" as const, sourceAttemptId: "attempt-1",
        effectScope: "provider_effect" as const, outcome: "CONFIRMED" as const,
        terminalAt: "2020-01-01T00:00:00.000Z", targetRef: "target:fixture",
        documentRef: "document:fixture", productStepId: call.productStepId,
        callId: call.callId, childCapabilityId: call.child, actionOrdinal: call.actionOrdinal,
      } : null,
      evidence: fact ? {
        owner: "forensics-persistence" as const, evidenceRef: fact.evidenceRef,
        evidenceHash: FIXTURE_HASH, readbackVerified: true as const,
        artifactRefs: call.child === "checkpoint_gpt_text_response" ? ["artifact:checkpoint"] : [],
      } : null,
      continuation: null,
    };
  },
  execute: async (call: ProductExecuteInput) => {
    const productCall = call as ProductCall;
    state.calls.push(productCall);
    const key = callKey(productCall);
    const prior = state.facts.get(key);
    if (productCall.child === "submit_exact_gpt_turn_once" && !prior) state.physicalSubmitDispatches += 1;
    const evidenceRef = prior?.evidenceRef ?? `evidence:${state.calls.length}`;
    state.facts.set(key, { evidenceRef, mutation: productCall.child === "submit_exact_gpt_turn_once" });
    const outcome = executeValue({
      call: productCall, fixture, laneOwned: state.laneOwned, provider: state.provider,
    });
    state.laneOwned = outcome.laneOwned;
    state.provider = outcome.provider;
    return { value: outcome.value, evidenceRef, evidenceHash: FIXTURE_HASH } as never;
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
  completed: ProductPluginOutput;
  continuationReads: readonly unknown[];
  physicalSubmitDispatches: number;
  generatedImageUploads: number;
}>> => {
  const root = mkdtempSync(join(tmpdir(), "grasseye-product-acceptance-"));
  const state: ProductRunState = {
    calls: [], completed: null, continuationReads: [], facts: new Map(), laneOwned: false,
    physicalSubmitDispatches: 0, generatedImageUploads: 0,
    provider: fixture.task.continuation_ref ? initialProvider() : null,
  };
  try {
    await plugin.execute(fixture.task, createProductContext(root, state, fixture));
    assert(state.completed);
    assert.equal(state.laneOwned, false, `${plugin.pluginId} must release or advance every continuation lane`);
    assert.equal(new Set(state.calls.map((call) => call.sessionKey)).size, 1);
    assert.ok(state.calls.every((call) => call.sessionKey.includes(plugin.pluginId)));
    return { calls: state.calls, completed: state.completed,
      continuationReads: state.continuationReads, physicalSubmitDispatches: state.physicalSubmitDispatches,
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
