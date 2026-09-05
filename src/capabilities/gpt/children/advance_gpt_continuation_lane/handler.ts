import { gptExactCallIdentityHash } from "../../contract.js";
import {
  checkpointFrom,
  continuationController,
  continuationStore,
  laneFrom,
  providerFrom,
} from "../../session/continuation-child-input.js";
import {
  declaredFacts,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";

export const advanceGptContinuationLaneHandler: GptChildHandler<"advance_gpt_continuation_lane"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["currentCheckpoint", "jobId", "lane", "pluginId", "provider"]);
    const lane = laneFrom(intent);
    const provider = providerFrom(intent);
    const currentCheckpoint = checkpointFrom(intent);
    const before = continuationStore(context).readGptContinuation(lane.continuation_ref);
    const decision = before?.lane_owner_job_id === null
      && before.lane_version === lane.lane_version
      && JSON.stringify(before.provider) === JSON.stringify(provider)
      && JSON.stringify(before.current_checkpoint) === JSON.stringify(currentCheckpoint)
      ? "DONE" as const : "ACT" as const;
    continuationController(context).advance({
      lane,
      jobId: stringInput(intent, "jobId"),
      pluginId: stringInput(intent, "pluginId"),
      provider,
      currentCheckpoint,
    });
    return success({
      value: { advanced: true },
      ...declaredFacts({
        decision, factResultIds: [`gpt-transaction:${gptExactCallIdentityHash(intent).slice(7)}`],
        candidateCardinality: { raw: null, eligible: null }, authorityRefHashes: [],
        observationRevisionHash: null, mutationOutcome: decision === "ACT" ? "confirmed" : "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  };
