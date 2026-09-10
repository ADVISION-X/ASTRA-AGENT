import { governanceAssert as assert } from
  "../../../../scripts/audit/shared/governance-exam-assert.js";

import type { GptChildCapabilityId, GptChildCapabilityResult, GptChildInputMap } from "../contract.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
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
  result: GptChildCapabilityResult<"ensure_gpt_reasoning_requirement">,
  input: GptChildInputMap["ensure_gpt_reasoning_requirement"],
): Promise<void> => {
  assert.equal(result.status, "success");
  assert.equal(result.reasoningRequirementResult?.requestedTier,
    input.profile.reasoningRequirement.requestedTier);
  assert.equal(result.reasoningRequirementResult?.selectionPolicy,
    input.profile.reasoningRequirement.selectionPolicy);
};

export const exercisePreExecutionFailureEvidence = async (): Promise<void> => {
  const failure = serializeTerminalFailure(executionFailure(
    "failed", "BROWSER_RECONCILIATION_SCOPE_INVALID",
  ));
  assert.equal(failure.code, "BROWSER_RECONCILIATION_SCOPE_INVALID");
  assert.equal(failure.mutation_outcome, "no");
};
