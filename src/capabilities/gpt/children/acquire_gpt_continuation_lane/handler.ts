import { executionFailure } from "../../../../lib/execution-failure.js";

import { gptExactCallIdentityHash } from "../../contract.js";
import {
  continuationController,
  continuationStore,
  exactRecordKeys,
  hashField,
  textField,
} from "../../session/continuation-child-input.js";
import {
  declaredFacts,
  recordInput,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";

export const acquireGptContinuationLaneHandler: GptChildHandler<"acquire_gpt_continuation_lane"> =
  async (intent, context) => {
    const authorization = recordInput(intent, "authorization");
    const grant = authorization.kind === "continuation_lane_use_grant";
    requireExactInputKeys(intent, [
      "authorization", "continuationRef", ...(grant ? ["parentManifestHash", "parentManifestId"] : []),
      "ownerRef", "subjectRef",
    ]);
    exactRecordKeys(authorization, grant
      ? ["currentAuthorizationRef", "currentJobId", "kind", "opaqueLaneUseGrantHash"]
      : ["currentAuthorizationRef", "kind"], "GPT_CONTINUATION_AUTHORIZATION_INVALID");
    if (authorization.kind !== "row_authorization" && !grant) {
      throw executionFailure("failed", "GPT_CONTINUATION_AUTHORIZATION_INVALID");
    }
    const common = {
      continuationRef: stringInput(intent, "continuationRef"),
      jobId: intent.jobId,
      pluginId: intent.pluginId,
      ownerRef: stringInput(intent, "ownerRef"),
      subjectRef: stringInput(intent, "subjectRef"),
    } as const;
    const before = continuationStore(context).readGptContinuation(common.continuationRef);
    const decision = before?.lane_owner_job_id === intent.jobId ? "DONE" as const : "ACT" as const;
    const lane = continuationController(context).acquire(grant ? {
      ...common,
      authorization: {
        kind: "continuation_lane_use_grant",
        currentJobId: textField(authorization.currentJobId, "GPT_CONTINUATION_AUTHORIZATION_INVALID"),
        currentAuthorizationRef: textField(
          authorization.currentAuthorizationRef, "GPT_CONTINUATION_AUTHORIZATION_INVALID",
        ),
        opaqueLaneUseGrantHash: hashField(
          authorization.opaqueLaneUseGrantHash, "GPT_CONTINUATION_AUTHORIZATION_INVALID",
        ),
      },
      parentManifestId: stringInput(intent, "parentManifestId"),
      parentManifestHash: hashField(
        "parentManifestHash" in intent.input ? intent.input.parentManifestHash : null,
        "GPT_CONTINUATION_AUTHORIZATION_INVALID",
      ),
    } : {
      ...common,
      authorization: {
        kind: "row_authorization",
        currentAuthorizationRef: textField(
          authorization.currentAuthorizationRef, "GPT_CONTINUATION_AUTHORIZATION_INVALID",
        ),
      },
    });
    return success({
      value: lane,
      ...declaredFacts({
        decision, factResultIds: [`gpt-transaction:${gptExactCallIdentityHash(intent).slice(7)}`],
        candidateCardinality: { raw: null, eligible: null }, authorityRefHashes: [],
        observationRevisionHash: null, mutationOutcome: decision === "ACT" ? "confirmed" : "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  };
