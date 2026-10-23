import { stageResultForAcceptance } from "./agent-production-runtime-fixtures.js";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { ProductionRuntimeStore as RuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import {
  executeClaim,
  reconcilePendingAttemptFailures,
} from "../../src/lib/local-runtime/production/runtime-claim.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { serializeTerminalFailureTransport } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attemptFailureFirstFact, claimTask, failureStatus,
  resultFor, task } from "./agent-production-runtime-fixtures.js";
import { verifyFailureReleaseReadbackScenarios, verifyAttemptFailureClassificationMatrix } from
  "./agent-production-runtime-failure-readback.acceptance-support.js";
import {
  verifyClaimTimeFirstFactConflict, verifyRemoteFailureWithoutLocalAuthorityStopsBeforeProduct,
} from "./agent-production-runtime-failure-authority.acceptance-support.js";




const verifyLeaseRebind = async (): Promise<void> => {
const rebindDirectory = await mkdtemp(join(tmpdir(), "agent-claim-failure-rebind-"));
const rebindStore = new RuntimeStore(rebindDirectory);
try {
  const websiteTask = task({
    jobId: "job:claim-failure-rebind",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const firstGrant = claimTask(websiteTask);
  const job = { ...firstGrant, grant: { ...firstGrant.grant, lease_version: 2 } };
  rebindStore.acceptTask(websiteTask, job.grant.attempt_id);
  const original = attemptFailureFirstFact(job.grant.attempt_id,
    serializeTerminalFailureTransport(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")), 1);
  rebindStore.recordAttemptFailure(websiteTask.job_id, job.grant.attempt_id, original);
  let committedRequest: Readonly<Record<string, unknown>> | null = null;
  let releaseRequests = 0;
  const status = () => {
    if (!committedRequest) return failureStatus(job.job_id, null, []);
    const response = {
      schema_version: "xuanxue-ai-lease-release-receipt.v6", job_id: job.job_id,
      task_status: "failed", lease_disposition: "released",
      reason_code: "PRODUCT_EXECUTION_FAILED", payload_hash: committedRequest.payload_hash,
      terminal_payload_hash: null, attempt_failure: committedRequest.attempt_failure,
    };
    return failureStatus(job.job_id, null, [{
      request_id: committedRequest.request_id, write_kind: "lease_release",
      payload_hash: hashCanonical(committedRequest), response_json: response,
    }]);
  };
  const state = {
    abort: new AbortController(), active: new Map(),
    activeAbort: new Map([[job.job_id, new AbortController()]]), store: rebindStore,
    executor: { accept: () => { throw new Error("UNEXPECTED_ACCEPT"); } },
    session: {
      workerSessionId: "worker:claim-failure-rebind", workerSessionEpoch: 1,
      device: { server_base_url: "http://127.0.0.1:4322" },
      request: async (path: string, options?: Readonly<{ body?: string }>) => {
        if (path.endsWith("/lease-release")) {
          releaseRequests += 1;
          committedRequest = JSON.parse(options?.body ?? "null") as Readonly<Record<string, unknown>>;
          return { ok: true };
        }
        return status();
      },
    },
    browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
    dataDir: rebindDirectory,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-claim-failure-rebind", owner: "production-runtime",
      component: "production-runtime", terminalEnabled: false,
      fileSink: { directoryPath: join(rebindDirectory, "runtime-logs") },
    }),
    draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
    stopped: false, ledgerReconciled: true,
  } as never;
  await executeClaim(state, job as never);
  assert.equal(releaseRequests, 1,
    "a same-attempt new lease may transport the first fact exactly once after GET proves absence");
  const committed = committedRequest as Readonly<Record<string, unknown>> | null;
  assert.ok(committed, "the rebound descriptor must produce one release request");
  assert.deepEqual(committed.attempt_failure, original.failure_core,
    "descriptor rebinding must not alter one byte of the immutable failure core");
  const rebound = rebindStore.readTask(job.job_id)?.attempt_failure;
  assert.equal(rebound?.release_descriptor.lease_version, 2);
  assert.deepEqual(rebound?.failure_core, original.failure_core);
} finally {
  rebindStore.close();
  await rm(rebindDirectory, { recursive: true, force: true });
}
};

const verifyConsumeCurrentResult = async (): Promise<void> => {
const temporary = await mkdtemp(join(tmpdir(), "agent-failure-consume-current-result-"));
const store = new RuntimeStore(temporary);
try {
  const websiteTask = task({
    jobId: "job:failure-consume-current-result",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const attemptId = "attempt:failure-consume-current-result";
  store.acceptTask(websiteTask, attemptId);
  const staged = resultFor(websiteTask);
  store.markExecuting(websiteTask.job_id);
  stageResultForAcceptance(store, websiteTask.job_id, attemptId, staged);
  const failure = attemptFailureFirstFact(attemptId,
    serializeTerminalFailureTransport(executionFailure("failed", "BUSINESS_ADMISSION_INTERRUPTED")));
  store.recordAttemptFailure(websiteTask.job_id, attemptId, failure);
  const remoteFailure = {
    ...failure.failure_core,
    from_status: "failed", to_status: "failed",
    attempt_id: attemptId, lease_version: failure.release_descriptor.lease_version,
  };
  const response = {
    schema_version: "xuanxue-ai-lease-release-receipt.v6",
    job_id: websiteTask.job_id,
    task_status: "failed",
    lease_disposition: "released",
    reason_code: failure.failure_core.code,
    payload_hash: failure.release_descriptor.body_payload_hash,
    terminal_payload_hash: null,
    attempt_failure: failure.failure_core,
  };
  const remote = {
    ...failureStatus(websiteTask.job_id, remoteFailure, [{
      request_id: failure.release_descriptor.request_id,
      write_kind: "lease_release",
      payload_hash: failure.release_descriptor.write_request_payload_hash,
      response_json: response,
    }]),
    next_action_code: "CONSUME_CURRENT_RESULT",
  };
  let reads = 0;
  const state = {
    abort: new AbortController(), active: new Map(), activeAbort: new Map(), store,
    session: {
      workerSessionId: "worker:consume-current-result", workerSessionEpoch: 1,
      device: { server_base_url: "http://127.0.0.1:4322" },
      request: async () => { reads += 1; return remote; },
    },
    browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
    dataDir: temporary,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-failure-consume-current-result", owner: "production-runtime",
      component: "production-runtime", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "runtime-logs") },
    }),
    draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
    stopped: false, ledgerReconciled: true,
  } as never;
  await reconcilePendingAttemptFailures(state);
  const reconciled = store.readTask(websiteTask.job_id);
  assert.equal(reads, 2,
    "consume-current-result must read the failure disposition and then receiving authority");
  assert.deepEqual(reconciled?.attempt_failure, failure,
    "consume-current-result must preserve the first failure fact until Website receiving is confirmed");
  assert.deepEqual(reconciled?.staged_result, staged,
    "consume-current-result must retain the exact staged result for receiving");
  assert.equal(reconciled?.current_reason, "RESULT_AUTHORITY_RECONCILIATION_PENDING");
} finally {
  store.close();
  await rm(temporary, { recursive: true, force: true });
}
};

const oldReleaseReceipts = (
  jobId: string, localFailure: ReturnType<typeof attemptFailureFirstFact>, present: boolean,
) => {
  if (!present) return [];
  const response = {
    schema_version: "xuanxue-ai-lease-release-receipt.v6", job_id: jobId,
    task_status: "failed", lease_disposition: "released",
    reason_code: localFailure.failure_core.code,
    payload_hash: localFailure.release_descriptor.body_payload_hash,
    terminal_payload_hash: null, attempt_failure: localFailure.failure_core,
  };
  return [{ request_id: localFailure.release_descriptor.request_id,
    write_kind: "lease_release",
    payload_hash: localFailure.release_descriptor.write_request_payload_hash,
    response_json: response }];
};

const verifyNewLeaseConflictScenario = async (scenario: Readonly<{
  slug: string; currentLease: number; remoteLease: number; remoteFailureCode: string;
}>, oldReceiptPresent: boolean): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(),
    `agent-claim-new-lease-conflict-${scenario.slug}-${oldReceiptPresent ? "receipt" : "no-receipt"}-`));
  const store = new RuntimeStore(directory);
  try {
    const websiteTask = task({
      jobId: `job:claim-new-lease-conflict:${scenario.slug}:${oldReceiptPresent ? "receipt" : "no-receipt"}`,
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const firstGrant = claimTask(websiteTask);
    const job = { ...firstGrant, grant: {
      ...firstGrant.grant, lease_version: scenario.currentLease,
    } };
    store.acceptTask(websiteTask, job.grant.attempt_id);
    const localFailure = attemptFailureFirstFact(job.grant.attempt_id,
      serializeTerminalFailureTransport(executionFailure("failed", "LOCAL_FIRST_FAILURE")), 1);
    store.recordAttemptFailure(websiteTask.job_id, job.grant.attempt_id, localFailure);
    const remoteFailure = {
      ...serializeTerminalFailureTransport(executionFailure("failed", scenario.remoteFailureCode)),
      from_status: "failed", to_status: "failed",
      attempt_id: job.grant.attempt_id, lease_version: scenario.remoteLease,
    };
    const oldReceipts = oldReleaseReceipts(job.job_id, localFailure, oldReceiptPresent);
    let releaseRequests = 0;
    let productExecutions = 0;
    const state = {
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[job.job_id, new AbortController()]]), store,
      executor: {
        accept: () => { productExecutions += 1; throw new Error("UNEXPECTED_ACCEPT"); },
        acceptAfterFailureReconciled: () => {
          productExecutions += 1;
          throw new Error("UNEXPECTED_RECONCILED_ACCEPT");
        },
      },
      session: {
        workerSessionId: "worker:claim-new-lease-conflict", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (requestPath: string) => {
          if (requestPath.endsWith("/lease-release")) {
            releaseRequests += 1;
            throw new Error("UNEXPECTED_RELEASE");
          }
          return failureStatus(job.job_id, remoteFailure, oldReceipts);
        },
      },
      browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
      dataDir: directory,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-claim-new-lease-conflict", owner: "production-runtime",
        component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(directory, "runtime-logs") },
      }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    } as never;
    await executeClaim(state, job as never);
    assert.equal(productExecutions, 0,
      "a current-grant failure contradiction must stop before Product acceptance");
    assert.equal(releaseRequests, 0,
      "a current-grant failure contradiction must stop before descriptor rebind POST");
    assert.deepEqual(store.readTask(job.job_id)?.attempt_failure, localFailure,
      "a current-grant failure contradiction must retain the original first fact and descriptor");
    assert.match(store.readTask(job.job_id)?.current_reason ?? "",
      /^PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT\|attempt-failure-authority-conflict\|/u,
      "the current lease contradiction must be durably diagnosable with or without an old receipt");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
};

export const verifyAttemptFailureReadbackRuntimeContract = async (): Promise<void> => {
  verifyAttemptFailureClassificationMatrix();

  await verifyFailureReleaseReadbackScenarios();



  await verifyUnresolvedBrowserMutationDoesNotStarveClaimRecovery();

  await verifyClaimTimeFirstFactConflict();

  await verifyRemoteFailureWithoutLocalAuthorityStopsBeforeProduct();

  for (const scenario of [
    { slug: "current-lease-different-core", currentLease: 2, remoteLease: 2,
      remoteFailureCode: "REMOTE_NEW_LEASE_FAILURE" },
    { slug: "intermediate-lease-same-core", currentLease: 3, remoteLease: 2,
      remoteFailureCode: "LOCAL_FIRST_FAILURE" },
  ]) for (const oldReceiptPresent of [false, true]) {
    await verifyNewLeaseConflictScenario(scenario, oldReceiptPresent);
  }

  await verifyLeaseRebind();


  await verifyConsumeCurrentResult();
};

const verifyUnresolvedBrowserMutationDoesNotStarveClaimRecovery = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "agent-unresolved-browser-claim-recovery-"));
  const store = new RuntimeStore(directory);
  try {
    const websiteTask = task({ jobId: "job:wait-new-unrelated-browser-mutation",
      productId: "payment_screenshot_observation", actionId: "observe" });
    const job = claimTask(websiteTask);
    store.acceptTask(websiteTask, job.grant.attempt_id);
    const failure = attemptFailureFirstFact(job.grant.attempt_id,
      serializeTerminalFailureTransport(executionFailure("failed", "BROWSER_POSTCONDITION_FAILED")));
    store.recordAttemptFailure(job.job_id, job.grant.attempt_id, failure);
    const remoteFailure = { ...failure.failure_core, from_status: "failed", to_status: "failed",
      attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version };
    const remote = { ...failureStatus(job.job_id, remoteFailure, []),
      next_action_code: "WAIT_NEW_ATTEMPT" };
    let released = 0;
    let unresolved = true;
    const state = {
      store,
      session: { request: async () => remote },
      browserAuthority: {
        hasUnresolvedBrowserMutation: () => unresolved,
        readJobPhysicalInputState: () => "zero",
        releaseJobBoundTarget: async () => { released += 1; },
      },
      abort: new AbortController(),
    } as never;
    await reconcilePendingAttemptFailures(state);
    assert.equal(released, 1,
      "an unrelated historical Browser mutation cannot postpone Website-authorized target release");
    assert.deepEqual(store.readTask(job.job_id)?.attempt_failure, failure,
      "resource release must retain the immutable failed-attempt authority");
    unresolved = false;
    await reconcilePendingAttemptFailures(state);
    assert.equal(released, 2, "the next original reconciliation remains reachable without a historical gate");
    assert.equal(store.readTask(job.job_id)?.current_reason,
      "SOURCE_HANDOFF_RECONCILIATION_PENDING");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
};
