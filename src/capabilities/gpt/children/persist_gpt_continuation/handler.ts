import { executionFailure } from "../../../../lib/execution-failure.js";

import { gptExactCallIdentityHash } from "../../contract.js";
import {
  declaredFacts,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  checkpointFrom,
  continuationController,
  continuationStore,
  frontierFrom,
  providerFrom,
} from "../../session/continuation-child-input.js";

export const persistGptContinuationHandler: GptChildHandler<"persist_gpt_continuation"> =
  async (intent, context) => {
    const hasFrontier = Boolean(intent.input && typeof intent.input === "object"
      && !Array.isArray(intent.input) && Object.prototype.hasOwnProperty.call(intent.input, "frontier"));
    requireExactInputKeys(intent, hasFrontier ? [
      "authorizationRef", "currentCheckpoint", "frontier", "jobId", "ownerRef", "pluginId", "provider", "subjectRef",
    ] : ["authorizationRef", "currentCheckpoint", "jobId", "ownerRef", "pluginId", "provider", "subjectRef"]);
    const continuationRef = `gpt-continuation:${gptExactCallIdentityHash(intent).slice(7)}`;
    const decision = continuationStore(context).readGptContinuation(continuationRef) ? "DONE" as const : "ACT" as const;
    const ref = continuationController(context).persist({
      continuationRef,
      jobId: stringInput(intent, "jobId"),
      pluginId: stringInput(intent, "pluginId"),
      ownerRef: stringInput(intent, "ownerRef"),
      subjectRef: stringInput(intent, "subjectRef"),
      authorizationRef: stringInput(intent, "authorizationRef"),
      provider: providerFrom(intent),
      currentCheckpoint: checkpointFrom(intent),
      frontier: hasFrontier ? frontierFrom(intent) : null,
    });
    if (!ref) throw executionFailure("failed", "GPT_CONTINUATION_PERSIST_READBACK_MISSING");
    return success({
      value: { continuationRef: ref },
      ...declaredFacts({
        decision, factResultIds: [`gpt-transaction:${gptExactCallIdentityHash(intent).slice(7)}`],
        candidateCardinality: { raw: null, eligible: null }, authorityRefHashes: [],
        observationRevisionHash: null, mutationOutcome: decision === "ACT" ? "confirmed" : "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  };
