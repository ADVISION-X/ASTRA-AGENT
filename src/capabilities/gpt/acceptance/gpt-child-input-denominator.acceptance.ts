import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import {
  createGptAbilityGroup,
} from "../index.js";
import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
  GptChildCapabilityProof,
} from "../contract.js";
import { hashCanonical } from "../../../lib/local-runtime/production/contracts.js";
import { EXPECTED_GPT_CHILD_IDS } from "./gpt-exact-target-browser-fixture.js";
import { productionGptAtomicIdentity } from "../production-atomic-call.js";

const gpt = createGptAbilityGroup();

const invalidResult = async (
  childCapabilityId: GptChildCapabilityId,
  input: unknown,
  suffix: string,
) => {
  const intent = Object.freeze({
    childCapabilityId,
    executionId: `acceptance:gpt-input-denominator:${childCapabilityId}:${suffix}`,
    jobId: "job:gpt-input-denominator",
    attemptId: "attempt:gpt-input-denominator",
    pluginId: "acceptance-product",
    pluginVersion: 1,
    productStepId: "gpt-input-denominator",
    callId: `invalid-${suffix}`,
    inputHash: hashCanonical(input),
    actionOrdinal: 1,
    input,
  }) as GptChildCapabilityIntent<GptChildCapabilityId>;
  const proofs: GptChildCapabilityProof[] = [];
  const result = await gpt.execute(intent, {
    dataDir: "/tmp/gpt-input-denominator",
    onProof: async (proof) => { proofs.push(proof); },
  });
  assert.equal(result.status, "failed");
  assert.match(result.failureCode ?? "", /^GPT_CHILD_INPUT_INVALID:/u,
    `${childCapabilityId} must classify ${suffix} input as a typed contract failure`);
  assert.equal(result.proof.internalDecisionCode, "FAIL_CLOSED");
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(result.proof.browserFact, null);
  assert.equal(proofs.length, 1, "the public facade must emit exactly one terminal proof");
  assert.equal(proofs[0], result.proof);
  return result;
};

for (const childCapabilityId of EXPECTED_GPT_CHILD_IDS as readonly GptChildCapabilityId[]) {
  const nullOne = await invalidResult(childCapabilityId, null, "wrong-top-level-type");
  const nullTwo = await invalidResult(childCapabilityId, null, "wrong-top-level-type");
  assert.equal(nullOne.proof.evidenceHash, nullTwo.proof.evidenceHash,
    `${childCapabilityId} must produce a stable proof for the same invalid exact call`);
  await invalidResult(childCapabilityId, { unexpected: true }, "extra-field");
  if (childCapabilityId !== "open_gpt_attachment_control") {
    await invalidResult(childCapabilityId, {}, "missing-field");
  }
}

const submitInput = { files: [], promptHash: hashCanonical("prompt") } as const;
const submitIntent = Object.freeze({
  childCapabilityId: "submit_exact_gpt_turn_once", executionId: "submit-identity",
  jobId: "job:submit-identity", attemptId: "attempt:1", pluginId: "acceptance-product",
  pluginVersion: 1, productStepId: "step", callId: "submit", inputHash: hashCanonical(submitInput),
  actionOrdinal: 1, input: submitInput,
}) as GptChildCapabilityIntent<"submit_exact_gpt_turn_once">;
assert.equal(productionGptAtomicIdentity(submitIntent, 0).inputHash,
  productionGptAtomicIdentity({ ...submitIntent, attemptId: "attempt:2" }, 0).inputHash,
  "changing only attempt must retain the Provider submit request hash");
assert.notEqual(productionGptAtomicIdentity(submitIntent, 0).inputHash,
  productionGptAtomicIdentity(submitIntent, 1).inputHash,
  "a Website-authorized result revision must create a different Provider submit request hash");
