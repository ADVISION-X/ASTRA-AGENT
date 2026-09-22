import { governanceAssert as assert } from
  "../../../../scripts/audit/shared/governance-exam-assert.js";

import type { GptChildCapabilityId, GptChildCapabilityResult, GptChildInputMap } from "../contract.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import {
  serializeTerminalFailure,
  serializeTerminalFailureTransport,
} from "../../../lib/local-runtime/production/terminal-failure.js";
import { throwGptChildFailure } from "../production-child-support.js";

export const exerciseFailedEvidenceReadback = async <K extends GptChildCapabilityId>(
  result: GptChildCapabilityResult<K>,
  _input: GptChildInputMap[K],
  expectedFailure: ReturnType<typeof serializeTerminalFailure>,
): Promise<void> => {
  let thrown: unknown = null;
  try { throwGptChildFailure(result); } catch (error) { thrown = error; }
  assert.deepEqual(serializeTerminalFailure(thrown), { ...expectedFailure,
    evidence_ref: result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef });
};

export const exerciseReasoningEvidenceReadback = async (
  result: GptChildCapabilityResult<"select_gpt_reasoning_from_start_v3">,
  input: GptChildInputMap["select_gpt_reasoning_from_start_v3"],
): Promise<void> => {
  assert.equal(result.status, "success");
  assert.equal(result.reasoningRequirementResult?.startTier, input.profile.startReasoningTier);
};

export const exercisePreExecutionFailureEvidence = async (): Promise<void> => {
  const failure = serializeTerminalFailure(executionFailure(
    "failed", "BROWSER_RECONCILIATION_SCOPE_INVALID",
  ));
  assert.equal(failure.code, "BROWSER_RECONCILIATION_SCOPE_INVALID");
  assert.equal(failure.mutation_outcome, "no");
  const providerEffectIdentityHash = `sha256:${"8".repeat(64)}` as const;
  let postSubmitFailure: unknown = null;
  try {
    throwGptChildFailure({
      failureCode: "GPT_RESPONSE_TIMEOUT", failureCause: null, failureBrowserEffect: null,
      proof: { committedMutation: "no", browserFact: null,
        evidenceRef: "gpt-child-proof:checkpoint", evidenceHash: `sha256:${"7".repeat(64)}` },
    } as GptChildCapabilityResult, undefined, undefined, {
      exactCallIdentityHash: `sha256:${"6".repeat(64)}`,
      providerEffectIdentityHash, childCapabilityId: "submit_exact_gpt_turn_once",
      effectScope: "provider_effect", browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
      terminalAt: "2026-09-12T00:00:00.000Z", evidenceRef: "browser-mutation:submit",
      evidenceHash: `sha256:${"5".repeat(64)}`,
    });
  } catch (error) { postSubmitFailure = error; }
  assert.equal(serializeTerminalFailureTransport(postSubmitFailure).provider_effect_identity_hash,
    providerEffectIdentityHash, "a post-submit checkpoint failure must retain the confirmed effect identity");
};
