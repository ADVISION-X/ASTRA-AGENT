import { gptExactCallIdentityHash } from "../../contract.js";
import {
  continuationController,
  continuationStore,
  laneFrom,
} from "../../session/continuation-child-input.js";
import {
  declaredFacts,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";

export const releaseGptContinuationLaneHandler: GptChildHandler<"release_gpt_continuation_lane"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["jobId", "lane"]);
    const lane = laneFrom(intent);
    const before = continuationStore(context).readGptContinuation(lane.continuation_ref);
    const decision = before?.lane_owner_job_id === null ? "DONE" as const : "ACT" as const;
    continuationController(context).release(lane, stringInput(intent, "jobId"));
    return success({
      value: { released: true },
      ...declaredFacts({
        decision, factResultIds: [`gpt-transaction:${gptExactCallIdentityHash(intent).slice(7)}`],
        candidateCardinality: { raw: null, eligible: null }, authorityRefHashes: [],
        observationRevisionHash: null, mutationOutcome: decision === "ACT" ? "confirmed" : "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  };
