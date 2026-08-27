import type { GptChildCapabilityIntent } from "../contract.js";
import { executionFailure } from "../../../lib/typed-failure.js";
import type { GptChildHandlerMap } from "../web/child-handler.js";
import {
  arrayInput,
  recordInput,
  requireExactInputKeys,
  stringInput,
  success,
} from "../web/child-handler.js";
import { GptSessionController, type GptContinuationLane } from "./gpt-session-controller.js";
import type { GptProviderContinuation } from "./gpt-continuation-store-port.js";

const controller = (context: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[1]) => {
  if (!context.continuationStore) throw executionFailure("failed", "GPT_CONTINUATION_STORE_REQUIRED");
  return new GptSessionController(context.continuationStore);
};

const providerFrom = (
  intent: GptChildCapabilityIntent,
  key = "provider",
): GptProviderContinuation => {
  const value = recordInput(intent, key);
  if (typeof value.provider_page_url !== "string"
    || typeof value.prior_task_id !== "string"
    || typeof value.prior_raw_output_hash !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(value.prior_raw_output_hash)
    || typeof value.prior_turn_marker !== "string") {
    throw executionFailure("failed", "GPT_CONTINUATION_PROVIDER_INVALID");
  }
  return {
    provider_page_url: value.provider_page_url,
    prior_task_id: value.prior_task_id,
    prior_raw_output_hash: value.prior_raw_output_hash as `sha256:${string}`,
    prior_turn_marker: value.prior_turn_marker,
  };
};

const laneFrom = (intent: GptChildCapabilityIntent): GptContinuationLane => {
  const value = recordInput(intent, "lane");
  if (typeof value.continuation_ref !== "string"
    || typeof value.lane_version !== "number" || !Number.isSafeInteger(value.lane_version)
    || !value.provider || typeof value.provider !== "object" || Array.isArray(value.provider)) {
    throw executionFailure("failed", "GPT_CONTINUATION_LANE_INVALID");
  }
  return {
    continuation_ref: value.continuation_ref,
    lane_version: value.lane_version,
    provider: providerFrom({ ...intent, input: { provider: value.provider } }),
  };
};

export const sessionChildHandlers = {
  async persist_gpt_continuation(intent, context) {
    requireExactInputKeys(intent, [
      "authorizationRef", "jobId", "ownerRef", "pluginId", "provider", "subjectRef",
    ], ["continuationRef"]);
    const ref = controller(context).persist({
      ...(intent.input.continuationRef === undefined ? {} : { continuationRef: stringInput(intent, "continuationRef") }),
      jobId: stringInput(intent, "jobId"),
      pluginId: stringInput(intent, "pluginId"),
      ownerRef: stringInput(intent, "ownerRef"),
      subjectRef: stringInput(intent, "subjectRef"),
      authorizationRef: stringInput(intent, "authorizationRef"),
      provider: providerFrom(intent),
    });
    return success({
      value: { continuationRef: ref }, candidateCount: null,
      observedSemantics: ["opaque GPT continuation", "plugin/subject/authorization bound"],
      committedMutation: "yes",
    });
  },

  async acquire_gpt_continuation_lane(intent, context) {
    requireExactInputKeys(intent, [
      "allowedSourcePluginIds", "authorizationRef", "continuationRef", "jobId",
      "ownerRef", "pluginId", "subjectRef",
    ]);
    const allowed = arrayInput(intent, "allowedSourcePluginIds");
    if (!allowed.every((value): value is string => typeof value === "string" && value.length > 0)) {
      throw executionFailure("failed", "GPT_CONTINUATION_SOURCE_PLUGIN_IDS_INVALID");
    }
    const lane = controller(context).acquire({
      continuationRef: stringInput(intent, "continuationRef"),
      jobId: stringInput(intent, "jobId"),
      pluginId: stringInput(intent, "pluginId"),
      allowedSourcePluginIds: allowed,
      ownerRef: stringInput(intent, "ownerRef"),
      subjectRef: stringInput(intent, "subjectRef"),
      authorizationRef: stringInput(intent, "authorizationRef"),
    });
    return success({
      value: lane, candidateCount: null,
      observedSemantics: ["one continuation", "lane CAS acquired", `lane-version:${lane.lane_version}`],
      committedMutation: "yes",
    });
  },

  async advance_gpt_continuation_lane(intent, context) {
    requireExactInputKeys(intent, ["jobId", "lane", "pluginId", "provider"]);
    controller(context).advance({
      lane: laneFrom(intent),
      jobId: stringInput(intent, "jobId"),
      pluginId: stringInput(intent, "pluginId"),
      provider: providerFrom(intent),
    });
    return success({
      value: { advanced: true }, candidateCount: null,
      observedSemantics: ["lane version matched", "new turn identity persisted", "lane released"],
      committedMutation: "yes",
    });
  },

  async release_gpt_continuation_lane(intent, context) {
    requireExactInputKeys(intent, ["jobId", "lane"]);
    controller(context).release(laneFrom(intent), stringInput(intent, "jobId"));
    return success({
      value: { released: true }, candidateCount: null,
      observedSemantics: ["same lane owner", "lane released"], committedMutation: "yes",
    });
  },

  async recover_gpt_response_checkpoint(intent, context) {
    requireExactInputKeys(intent, ["continuationRef", "expectedOutputHash", "expectedTaskId"]);
    const stored = controller(context).readVerified(stringInput(intent, "continuationRef"));
    if (stored.provider.prior_raw_output_hash !== stringInput(intent, "expectedOutputHash")
      || stored.provider.prior_task_id !== stringInput(intent, "expectedTaskId")) {
      throw executionFailure("review_required", "GPT_RESPONSE_CHECKPOINT_IDENTITY_MISMATCH");
    }
    return success({
      value: stored.provider, candidateCount: null,
      observedSemantics: ["verified continuation identity", "exact output hash", "exact task id"],
      committedMutation: "no",
    });
  },
} satisfies GptChildHandlerMap;
