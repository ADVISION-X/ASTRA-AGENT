import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import type { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { HASH_A, attemptFailureFirstFact, task } from "./agent-production-runtime-fixtures.js";

export const verifyBrowserFailureStoreContract = (store: ProductionRuntimeStore): void => {
  const legalPairs = Object.freeze([
    Object.freeze({ browser_outcome: "CONFIRMED" as const, mutation_outcome: "no" as const }),
    Object.freeze({ browser_outcome: "CONFIRMED" as const, mutation_outcome: "confirmed" as const }),
    Object.freeze({ browser_outcome: "REJECTED" as const, mutation_outcome: "no" as const }),
    Object.freeze({ browser_outcome: "REJECTED" as const, mutation_outcome: "confirmed" as const }),
    Object.freeze({ browser_outcome: "REJECTED" as const, mutation_outcome: "dispatched" as const }),
    Object.freeze({ browser_outcome: "DISPATCHED" as const, mutation_outcome: "dispatched" as const }),
  ]);
  for (const [index, pair] of legalPairs.entries()) {
    const browserTask = task({
      jobId: `job:browser-failure-pair:${index}`,
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const attemptId = `attempt:browser-failure-pair:${index}`;
    store.acceptTask(browserTask, attemptId);
    const failure = Object.freeze({
      code: "BROWSER_POSTCONDITION_FAILED",
      mutation_outcome: pair.mutation_outcome,
      effect_scope: "target_local" as const,
      child_capability_id: "prepare_clean_gpt_chat",
      browser_outcome: pair.browser_outcome,
      evidence_ref: `browser-mutation:legal-pair:${index}`,
      evidence_hash: HASH_A,
      child_proof_ref: null,
      child_proof_hash: null,
      stopped_empty_proof: null,
      cause: null,
    });
    const firstFact = attemptFailureFirstFact(attemptId, failure);
    store.recordAttemptFailure(browserTask.job_id, attemptId, firstFact);
    assert.deepEqual(store.readTask(browserTask.job_id)?.attempt_failure, firstFact,
      "every law-authorized Browser terminal/mutation pair must survive local authoritative readback");
  }
  const incompleteTask = task({
    jobId: "job:browser-failure-incomplete-evidence",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const incompleteAttempt = "attempt:browser-failure-incomplete-evidence";
  store.acceptTask(incompleteTask, incompleteAttempt);
  assert.throws(() => store.recordAttemptFailure(incompleteTask.job_id, incompleteAttempt,
    attemptFailureFirstFact(incompleteAttempt, {
    code: "BROWSER_POSTCONDITION_FAILED",
    mutation_outcome: "no",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "REJECTED",
    evidence_ref: null,
    evidence_hash: null,
    child_proof_ref: null,
    child_proof_hash: null,
    stopped_empty_proof: null,
    cause: null,
  } as never)), /PRODUCTION_ATTEMPT_FAILURE_INVALID/u,
  "Browser facts without their WAL evidence pair must fail before local admission");
};
