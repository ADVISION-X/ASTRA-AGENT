import { readFileSync } from "node:fs";

import type { GptContinuationLane } from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  sha256,
  type WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import type { SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import {
  MODEL_PROFILE,
  PLUGIN_ID,
  createOwnedExecution,
  markerFor,
  promptFor,
  runFreshTurn,
  type Checkpoint,
} from "./product-turn.js";
import {
  acquireContinuation,
  advanceContinuation,
  receive,
  releaseContinuation,
  runContinuationTurn,
  validateFollowupContract,
  verifyParentContinuation,
} from "./parent-continuation.js";

type FollowupExecutionContextInput = Readonly<{
  task: WebsiteAgentTask;
  context: SharedExecutionContext;
  lane: GptContinuationLane;
  prompt: string;
  checkpoint: Checkpoint;
}>;

const followupSubject = (task: WebsiteAgentTask) => Object.freeze({
  job_id: task.job_id,
  source_task_id: task.source_task_id,
  product_id: task.product_id,
  action_id: task.action_id,
  owner_ref: task.business_identity.owner_ref,
  subject_ref: task.business_identity.subject_ref,
  authorization_ref: task.business_identity.authorization_ref,
  privacy_subject_ref: task.privacy_subject_ref ?? null,
});

const followupMaterials = (context: SharedExecutionContext) => Object.freeze(context.materials.slice()
  .sort((left, right) => left.ordinal - right.ordinal)
  .map((material) => Object.freeze({
    material_id: material.material_id,
    ordinal: material.ordinal,
    role: material.role,
    owner_scope_hash: material.owner_scope_hash,
    trust_class: material.trust_class,
    may_issue_instruction: material.may_issue_instruction,
    sha256: material.sha256,
    bytes: material.bytes,
    media_type: material.media_type,
    exact_bytes_utf8: readFileSync(material.local_path, "utf8"),
  })));

const followupParent = (input: FollowupExecutionContextInput) => Object.freeze({
  parent_task_ref: input.task.parent_task_ref,
  parent_result_ref: input.task.parent_result_ref,
  parent_result_hash: input.task.parent_result_hash,
  parent_product_id: input.task.parameters.parent_product_id,
  parent_authorization_ref: input.task.parameters.parent_authorization_ref,
  parent_delivery_manifest_id: input.task.parameters.parent_delivery_manifest_id,
  parent_delivery_manifest_hash: input.task.parameters.parent_delivery_manifest_hash,
  parent_continuation_ref: input.task.continuation_ref,
  parent_lane_use_grant_hash: input.task.parameters.parent_lane_use_grant_hash,
  parent_provider: input.lane.provider,
  may_issue_instruction: false,
});

const followupFormal = (
  input: FollowupExecutionContextInput,
  turnContractBytes: string,
) => Object.freeze({
  continuation_ref: input.lane.continuation_ref,
  source_provider: input.lane.provider,
  prompt_exact_bytes_utf8: input.prompt,
  prompt_hash: input.checkpoint.promptHash,
  turn_contract_exact_bytes_utf8: turnContractBytes,
  turn_contract_hash: sha256(turnContractBytes),
  raw_dom_bytes_utf8: input.checkpoint.rawDomHtml,
  raw_dom_hash: input.checkpoint.rawDomHash,
  semantic_text_bytes_utf8: input.checkpoint.semanticText,
  semantic_text_hash: input.checkpoint.semanticTextHash,
  artifact_ref: input.checkpoint.artifactRef,
  evidence_ref: input.checkpoint.evidenceRef,
  evidence_hash: input.checkpoint.evidenceHash,
  may_issue_instruction: false,
});

const followupExecutionContext = (input: FollowupExecutionContextInput) => {
  const formalTurnContractBytes = JSON.stringify({
    schema_version: "bazi-followup-turn-contract.v1",
    plugin_id: PLUGIN_ID,
    action_id: input.task.action_id,
    profile: MODEL_PROFILE,
    prompt_hash: input.checkpoint.promptHash,
    turn_marker: input.checkpoint.turnMarker,
    material_roles: ["bazi_input_bundle", "result_contract"],
    result_contract_hash: hashCanonical(
      input.context.routePolicy.result_contract ?? {},
    ),
  });
  return Object.freeze({
    schema_version: "bazi-product-execution-context.v1",
    subject_identity: followupSubject(input.task),
    input_materials: followupMaterials(input.context),
    product_skill: Object.freeze({
      plugin_id: PLUGIN_ID, plugin_version: 8, skill_version: "current-plugin-skill",
      exact_bytes_utf8: input.context.productSkill.text,
      sha256: input.context.productSkill.hash,
      may_issue_instruction: false,
    }),
    execution_profile: Object.freeze({ value: MODEL_PROFILE, hash: hashCanonical(MODEL_PROFILE) }),
    private_base: null,
    parent: followupParent(input),
    formal: followupFormal(input, formalTurnContractBytes),
  });
};

export const executeOwnedFlow = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
) => {
  const flow = createOwnedExecution(task, context);
  const marker = markerFor(task, context.gpt.attemptId);
  const prompt = promptFor(task, context, marker);
  if (task.action_id === "followup") {
    validateFollowupContract(task, context);
    const lane = await acquireContinuation(task, flow);
    let advanced = false;
    try {
      await verifyParentContinuation(task, flow, lane);
      const checkpoint = await runContinuationTurn(task, context, flow, prompt, marker);
      const payload = receive(task, checkpoint, context);
      await advanceContinuation(task, flow, lane, checkpoint, context.gpt.attemptId);
      advanced = true;
      return context.complete({
        payload,
        evidence_refs: flow.evidenceRefs(),
        execution_context: followupExecutionContext({ task, context, lane, prompt, checkpoint }),
      });
    } finally {
      if (!advanced) await releaseContinuation(task, flow, lane);
    }
  }
  const checkpoint = await runFreshTurn(task, context, flow, prompt, marker);
  const payload = receive(task, checkpoint, context);
  return context.complete({ payload, evidence_refs: flow.evidenceRefs() });
};
