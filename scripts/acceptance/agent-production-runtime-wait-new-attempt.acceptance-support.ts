import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductionRuntimeStore as RuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executeClaim } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { HASH_A, attemptFailureFirstFact, claimTask, failureStatus, task } from
  "./agent-production-runtime-fixtures.js";
import { mismatchEvidenceRef, typedDialogFailure } from
  "./agent-production-runtime-dialog-failure.acceptance-support.js";

const verifyInvalidSameAttempt = async (
  waitNewStore: RuntimeStore, waitNewDirectory: string,
  oldFailure: ReturnType<typeof attemptFailureFirstFact>,
): Promise<void> => {
  const invalidTask = task({
    jobId: "job:wait-new-attempt-same-attempt",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const invalidJob = claimTask(invalidTask);
  const invalidFailure = attemptFailureFirstFact(
    invalidJob.grant.attempt_id, oldFailure.failure_core,
  );
  waitNewStore.acceptTask(invalidTask, invalidJob.grant.attempt_id);
  waitNewStore.recordAttemptFailure(
    invalidTask.job_id, invalidJob.grant.attempt_id, invalidFailure,
  );
  waitNewStore.releaseAttemptForWebsiteDecision(
    invalidTask.job_id, invalidJob.grant.attempt_id,
  );
  let invalidAccepts = 0;
  let invalidReleaseRequests = 0;
  await executeClaim({
    abort: new AbortController(), active: new Map(),
    activeAbort: new Map([[invalidJob.job_id, new AbortController()]]), store: waitNewStore,
    executor: {
      accept: () => { invalidAccepts += 1; throw new Error("UNEXPECTED_ACCEPT"); },
      acceptAfterFailureReconciled: () => {
        invalidAccepts += 1;
        throw new Error("UNEXPECTED_RECONCILED_ACCEPT");
      },
    },
    session: {
      workerSessionId: "worker:wait-new-attempt", workerSessionEpoch: 1,
      device: { server_base_url: "http://127.0.0.1:4322" },
      request: async (path: string) => {
        if (path.endsWith("/lease-release")) invalidReleaseRequests += 1;
        return failureStatus(invalidJob.job_id, null, []);
      },
    },
    browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
    dataDir: waitNewDirectory,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-wait-new-attempt-invalid", owner: "production-runtime",
      component: "production-runtime", terminalEnabled: false,
      fileSink: { directoryPath: join(waitNewDirectory, "runtime-logs-invalid") },
    }),
    draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
    stopped: false, ledgerReconciled: true,
  } as never, invalidJob);
  assert.equal(invalidAccepts, 0,
    "WAIT_NEW_ATTEMPT must reject a same-attempt grant before durable acceptance");
  assert.equal(invalidReleaseRequests, 0,
    "WAIT_NEW_ATTEMPT must not post the old failure when Website does not grant a new attempt");
  assert.deepEqual(waitNewStore.readTask(invalidJob.job_id)?.attempt_failure, invalidFailure,
    "an invalid WAIT_NEW_ATTEMPT grant must retain the immutable old first fact");
  assert.equal(waitNewStore.readTask(invalidJob.job_id)?.current_reason,
    "PRODUCTION_WAIT_NEW_ATTEMPT_AUTHORITY_CONFLICT");
};

const prepareWaitNewAttempt = (waitNewStore: RuntimeStore) => {
  const websiteTask = task({
    jobId: "job:wait-new-attempt-claim",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const oldJob = claimTask(websiteTask);
  waitNewStore.acceptTask(websiteTask, oldJob.grant.attempt_id);
  const oldFailure = attemptFailureFirstFact(oldJob.grant.attempt_id, Object.freeze({
    code: "BROWSER_POSTCONDITION_FAILED",
    mutation_outcome: "no" as const,
    effect_scope: "target_local" as const,
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "REJECTED" as const,
    evidence_ref: "browser-mutation:wait-new-attempt",
    evidence_hash: HASH_A,
    child_proof_ref: null,
    child_proof_hash: null,
    stopped_empty_proof: null,
    cause: null,
    provider_effect_identity_hash: null,
    settled_result_payload_hash: null,
  }));
  waitNewStore.recordAttemptFailure(
    websiteTask.job_id, oldJob.grant.attempt_id, oldFailure,
  );
  waitNewStore.releaseAttemptForWebsiteDecision(websiteTask.job_id, oldJob.grant.attempt_id);
  const newAttemptId = `${oldJob.grant.attempt_id}:new`;
  const newJob = {
    ...oldJob,
    grant: {
      ...oldJob.grant,
      attempt_id: newAttemptId,
      accepted_attempt_count: 2,
      lease_token: `lease:${newAttemptId}`,
      execution_fence: {
        ...oldJob.grant.execution_fence,
        attempt_id: newAttemptId,
      },
    },
  };
  return { websiteTask, oldFailure, newJob, newAttemptId };
};

export const verifyWaitNewAttempt = async (): Promise<void> => {
  const waitNewDirectory = await mkdtemp(join(tmpdir(), "agent-wait-new-attempt-claim-"));
  const waitNewStore = new RuntimeStore(waitNewDirectory);
  try {
    const { websiteTask, oldFailure, newJob, newAttemptId } = prepareWaitNewAttempt(waitNewStore);
    let reconciledAccepts = 0;
    let productExecutions = 0;
    let releaseRequests = 0;
    const state = {
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[newJob.job_id, new AbortController()]]), store: waitNewStore,
      executor: {
        accept: () => { throw new Error("UNEXPECTED_PLAIN_ACCEPT"); },
        acceptAfterFailureReconciled: (
          acceptedTask: typeof websiteTask,
          attemptId: string,
          expected: typeof oldFailure,
        ) => {
          reconciledAccepts += 1;
          return waitNewStore.acceptTaskAfterFailureReconciled(acceptedTask, attemptId, expected);
        },
        execute: async () => {
          productExecutions += 1;
          throw typedDialogFailure("BROWSER_GPT_DIALOG_UNRECOGNIZED", mismatchEvidenceRef, HASH_A);
        },
      },
      session: {
        workerSessionId: "worker:wait-new-attempt", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (path: string) => {
          if (path.endsWith("/lease-release")) {
            releaseRequests += 1;
            throw new Error("OLD_FAILURE_MUST_NOT_BE_POSTED_TO_NEW_ATTEMPT");
          }
          return { ...failureStatus(newJob.job_id, null, []), accepted_attempt_count: 2 };
        },
      },
      browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
      dataDir: waitNewDirectory,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-wait-new-attempt", owner: "production-runtime",
        component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(waitNewDirectory, "runtime-logs") },
      }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    } as never;
    await executeClaim(state, newJob as never);
    assert.equal(reconciledAccepts, 1,
      "a Website-authorized new attempt must reach the existing cross-attempt CAS acceptor");
    assert.equal(productExecutions, 1,
      "the accepted new attempt must become reachable by Product execution");
    assert.equal(releaseRequests, 0,
      "the old first fact must never be rebound or posted to the new attempt");
    assert.equal(waitNewStore.readTask(newJob.job_id)?.current_attempt_id, newAttemptId);
    assert.equal(waitNewStore.readTask(newJob.job_id)?.attempt_failure, null,
      "the exact old first fact must be cleared by the same atomic new-attempt acceptance");

    await verifyInvalidSameAttempt(waitNewStore, waitNewDirectory, oldFailure);
  } finally {
    waitNewStore.close();
    await rm(waitNewDirectory, { recursive: true, force: true });
  }
};
