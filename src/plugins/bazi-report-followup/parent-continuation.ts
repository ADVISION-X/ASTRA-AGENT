import {
  type GptContinuationLane,
  type GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import {
  sha256,
  type WebsiteAgentTask,
} from "../../lib/local-runtime/production/contracts.js";
import {
  gptTextContinuationCheckpointInput,
  productResultValidation,
  type SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import {
  failureCode,
  postCheckpointReceiverFault,
} from "../../lib/typed-failure.js";
import { parseProductResult } from "./result-contract.js";
import {
  PLUGIN_ID,
  applyAttachments,
  applyProfile,
  fail,
  hashValue,
  objectValue,
  submitTurn,
  textValue,
  uploadedFiles,
  type Checkpoint,
  type OwnedExecution,
} from "./product-turn.js";

const laneValue = (value: unknown): GptContinuationLane => {
  const lane = objectValue(value, "PRODUCT_CONTINUATION_LANE_INVALID");
  const provider = objectValue(lane.provider, "PRODUCT_CONTINUATION_LANE_INVALID");
  if (!Number.isSafeInteger(lane.lane_version)) fail("PRODUCT_CONTINUATION_LANE_INVALID");
  return Object.freeze({
    continuation_ref: textValue(lane.continuation_ref, "PRODUCT_CONTINUATION_LANE_INVALID"),
    lane_version: Number(lane.lane_version),
    provider: Object.freeze({
      provider_page_url: textValue(provider.provider_page_url, "PRODUCT_CONTINUATION_LANE_INVALID"),
      prior_task_id: textValue(provider.prior_task_id, "PRODUCT_CONTINUATION_LANE_INVALID"),
      prior_prompt_hash: hashValue(provider.prior_prompt_hash, "PRODUCT_CONTINUATION_LANE_INVALID"),
      prior_raw_output_hash: hashValue(provider.prior_raw_output_hash, "PRODUCT_CONTINUATION_LANE_INVALID"),
      prior_turn_marker: textValue(provider.prior_turn_marker, "PRODUCT_CONTINUATION_LANE_INVALID"),
    }),
  });
};

export const acquireContinuation = async (
  task: WebsiteAgentTask,
  flow: OwnedExecution,
): Promise<GptContinuationLane> => {
  if (!task.continuation_ref) fail("PRODUCT_CONTINUATION_REQUIRED");
  const stepId = task.action_id;
  const parentManifestId = textValue(
    task.parameters.parent_delivery_manifest_id, "PRODUCT_PARENT_MANIFEST_REQUIRED",
  );
  const parentManifestHash = hashValue(
    task.parameters.parent_delivery_manifest_hash, "PRODUCT_PARENT_MANIFEST_REQUIRED",
  );
  const opaqueLaneUseGrantHash = hashValue(
    task.parameters.parent_lane_use_grant_hash, "PRODUCT_PARENT_LANE_USE_GRANT_REQUIRED",
  );
  const lane = laneValue((await flow.execute({
    productStepId: stepId, callId: "continuation-acquire", child: "acquire_gpt_continuation_lane",
    actionOrdinal: 1, input: {
      authorization: {
        kind: "continuation_lane_use_grant",
        currentJobId: task.job_id,
        currentAuthorizationRef: task.business_identity.authorization_ref,
        opaqueLaneUseGrantHash,
      },
      continuationRef: task.continuation_ref,
      parentManifestId,
      parentManifestHash,
      ownerRef: task.business_identity.owner_ref,
      subjectRef: task.business_identity.subject_ref,
    },
  })).value);
  return lane;
};

export const verifyParentContinuation = async (
  task: WebsiteAgentTask,
  flow: OwnedExecution,
  lane: GptContinuationLane,
): Promise<void> => {
  if (lane.continuation_ref !== task.continuation_ref
    || !task.parent_task_ref || lane.provider.prior_task_id !== task.parent_task_ref) {
    fail("PRODUCT_CONTINUATION_LANE_DRIFT");
  }
  await flow.execute({
    productStepId: task.action_id, callId: "conversation-focus", child: "focus_exact_gpt_conversation",
    actionOrdinal: 2, input: { canonicalConversationUrl: lane.provider.provider_page_url },
  });
  await flow.execute({
    productStepId: task.action_id, callId: "conversation-verify", child: "verify_gpt_conversation_identity",
    actionOrdinal: 3, input: {
      canonicalConversationUrl: lane.provider.provider_page_url,
      expectedPromptHash: lane.provider.prior_prompt_hash,
      expectedResponseHash: lane.provider.prior_raw_output_hash,
      timeoutMs: 60_000,
      turnMarker: lane.provider.prior_turn_marker,
    },
  });
};

export const validateFollowupContract = (task: WebsiteAgentTask, context: SharedExecutionContext): void => {
  if (task.product_id !== "bazi_report_followup" || task.action_id !== "followup"
    || !task.continuation_ref || task.parameters.thread_ref !== task.continuation_ref
    || task.parameters.current_authorization_ref !== task.business_identity.authorization_ref
    || (task.parameters.parent_product_id !== "bazi_chart_interpretation"
      && task.parameters.parent_product_id !== "bazi_ai_full_analysis")
    || !task.parent_task_ref || !task.parent_result_ref || !task.parent_result_hash
    || task.parameters.parent_raw_output_hash !== task.parent_result_hash) {
    fail("PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  }
  textValue(task.parameters.parent_authorization_ref, "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  textValue(task.parameters.parent_delivery_manifest_id, "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  hashValue(task.parameters.parent_delivery_manifest_hash, "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  hashValue(task.parameters.parent_lane_use_grant_hash, "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  const roles = context.materials.slice().sort((left, right) => left.ordinal - right.ordinal)
    .map((material) => material.role);
  if (roles.join("\0") !== ["bazi_input_bundle", "result_contract"].join("\0")) {
    fail("PRODUCT_FOLLOWUP_MATERIAL_SET_INVALID");
  }
};

export const runContinuationTurn = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: OwnedExecution,
  prompt: string,
  marker: string,
): Promise<Checkpoint> => {
  const stepId = task.action_id;
  const submit = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 14, input: { promptHash: sha256(prompt), turnMarker: marker } } as const;
  const existing = await flow.facts(submit);
  const recoverOnly = Boolean(existing.mutation || existing.evidence);
  await applyProfile(flow, stepId, [4, 5, 6, 7, 8], recoverOnly);
  await applyAttachments(flow, context, stepId, [9, 10, 11], recoverOnly);
  return submitTurn(flow, stepId, prompt, marker, uploadedFiles(context), [12, 13, 14, 15, 16, 17]);
};

const providerFor = (task: WebsiteAgentTask, checkpoint: Checkpoint): GptProviderContinuation =>
  Object.freeze({
    provider_page_url: checkpoint.canonicalConversationUrl,
    prior_task_id: task.job_id,
    prior_prompt_hash: checkpoint.promptHash,
    prior_raw_output_hash: checkpoint.semanticTextHash,
    prior_turn_marker: checkpoint.turnMarker,
  });

export const receive = (task: WebsiteAgentTask, checkpoint: Checkpoint): Readonly<Record<string, unknown>> => {
  try {
    const value = productResultValidation.parseJsonObject(
      checkpoint.semanticText, "PRODUCT_RESULT_JSON_INVALID",
    );
    return parseProductResult(task, value);
  } catch (error) {
    throw postCheckpointReceiverFault(failureCode(error, "PRODUCT_RESULT_RECEIVER_FAILED"), {
      artifactRef: checkpoint.artifactRef,
      rawDomHash: checkpoint.rawDomHash,
      semanticTextHash: checkpoint.semanticTextHash,
    });
  }
};

export const advanceContinuation = async (
  task: WebsiteAgentTask,
  flow: OwnedExecution,
  lane: GptContinuationLane,
  checkpoint: Checkpoint,
  sourceAttemptId: string,
): Promise<void> => {
  await flow.execute({
    productStepId: task.action_id, callId: "continuation-advance", child: "advance_gpt_continuation_lane",
    actionOrdinal: 18, input: {
      currentCheckpoint: gptTextContinuationCheckpointInput(sourceAttemptId, checkpoint),
      jobId: task.job_id, lane, pluginId: PLUGIN_ID, provider: providerFor(task, checkpoint),
    },
  });
};

export const releaseContinuation = async (
  task: WebsiteAgentTask,
  flow: OwnedExecution,
  lane: GptContinuationLane,
): Promise<void> => {
  await flow.execute({
    productStepId: task.action_id, callId: "continuation-release", child: "release_gpt_continuation_lane",
    actionOrdinal: 19, input: { jobId: task.job_id, lane },
  });
};
