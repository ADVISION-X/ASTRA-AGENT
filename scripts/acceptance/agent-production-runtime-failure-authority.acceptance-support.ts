import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductionRuntimeStore as RuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executeClaim } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { serializeTerminalFailureTransport } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import { HASH_A, attemptFailureFirstFact, claimTask, failureStatus, task } from
  "./agent-production-runtime-fixtures.js";

export const verifyClaimTimeFirstFactConflict = async (): Promise<void> => {
  const conflictDirectory = await mkdtemp(join(tmpdir(), "agent-claim-failure-conflict-"));
  const conflictStore = new RuntimeStore(conflictDirectory);
  try {
    const websiteTask = task({
      jobId: "job:claim-failure-conflict",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const job = claimTask(websiteTask);
    conflictStore.acceptTask(websiteTask, job.grant.attempt_id);
    const localFailure = attemptFailureFirstFact(job.grant.attempt_id,
      serializeTerminalFailureTransport(executionFailure("failed", "LOCAL_FIRST_FAILURE")));
    conflictStore.recordAttemptFailure(websiteTask.job_id, job.grant.attempt_id, localFailure);
    const remoteFailure = {
      ...serializeTerminalFailureTransport(executionFailure("failed", "REMOTE_FIRST_FAILURE")),
      from_status: "failed", to_status: "failed",
      attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
    };
    let releaseRequests = 0;
    const state = {
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[job.job_id, new AbortController()]]), store: conflictStore,
      executor: { accept: () => { throw new Error("UNEXPECTED_ACCEPT"); } },
      session: {
        workerSessionId: "worker:claim-failure-conflict", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (path: string) => {
          if (path.endsWith("/lease-release")) {
            releaseRequests += 1;
            throw new Error("UNEXPECTED_RELEASE");
          }
          return failureStatus(job.job_id, remoteFailure, []);
        },
      },
      browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
      dataDir: conflictDirectory,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-claim-failure-conflict", owner: "production-runtime",
        component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(conflictDirectory, "runtime-logs") },
      }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    } as never;
    await executeClaim(state, job);
    assert.equal(releaseRequests, 0,
      "a claim-time local/remote first-fact contradiction must produce zero Website writes");
    assert.match(conflictStore.readTask(job.job_id)?.current_reason ?? "",
      /^PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT\|attempt-failure-authority-conflict\|/u,
      "claim-time contradiction evidence must survive the outer runtime boundary");
    assert.deepEqual(conflictStore.readTask(job.job_id)?.attempt_failure, localFailure,
      "claim-time contradiction must retain the immutable local first fact");
  } finally {
    conflictStore.close();
    await rm(conflictDirectory, { recursive: true, force: true });
  }
};

const verifyRemoteFailureWithoutLocalAuthority = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "agent-remote-failure-without-local-authority-"));
  const store = new RuntimeStore(directory);
  try {
    const websiteTask = task({
      jobId: "job:remote-failure-without-local-authority",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const job = claimTask(websiteTask);
    const remoteFailure = {
      ...serializeTerminalFailureTransport(executionFailure("failed", "PROVIDER_RESPONSE_UNKNOWN", {
        metadata: {
          mutationOutcome: "dispatched",
          evidence: { evidenceRef: "browser-fact:remote-only", evidenceHash: HASH_A },
          browserEffect: {
            effectScope: "provider_effect", childCapabilityId: "submit_exact_gpt_turn_once",
            browserOutcome: "DISPATCHED", providerEffectIdentityHash: HASH_A,
          },
        },
      })),
      from_status: "failed", to_status: "failed",
      attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
    };
    const counts = { durableAccepts: 0, productExecutions: 0, websiteWrites: 0 };
    const state = {
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[job.job_id, new AbortController()]]), store,
      executor: {
        accept: () => { counts.durableAccepts += 1; throw new Error("UNEXPECTED_ACCEPT"); },
        execute: async () => { counts.productExecutions += 1; throw new Error("UNEXPECTED_EXECUTION"); },
      },
      session: {
        workerSessionId: "worker:remote-failure-without-local-authority", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (path: string, options?: Readonly<{ method?: string }>) => {
          if (options?.method && options.method !== "GET") counts.websiteWrites += 1;
          if (!path.endsWith("/device-status")) throw new Error("UNEXPECTED_RUNTIME_REQUEST");
          return failureStatus(job.job_id, remoteFailure, []);
        },
      },
      browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
      dataDir: directory,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-remote-failure-without-local-authority", owner: "production-runtime",
        component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(directory, "runtime-logs") },
      }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    };
    await executeClaim(state as never, job);
    assert.equal(counts.durableAccepts, 0,
      "a remote first fact without its local durable carrier must stop before acceptance");
    assert.equal(counts.productExecutions, 0,
      "a remote first fact without local authority must produce zero Product or Provider execution");
    assert.equal(counts.websiteWrites, 0,
      "the boundary must retain the accepted remote attempt instead of releasing it as unaccepted");
    assert.equal(state.lastErrorCode,
      "PRODUCTION_REMOTE_ATTEMPT_FAILURE_LOCAL_AUTHORITY_MISSING");
    assert.equal(store.readTask(job.job_id), null,
      "the AGENT must not invent a local first fact from Website readback");

  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }

};

const verifyMissingLocalAcceptedRecovery = async (): Promise<void> => {
  const recoveryDirectory = await mkdtemp(join(tmpdir(), "agent-missing-local-accepted-"));
  const recoveryStore = new RuntimeStore(recoveryDirectory);
  try {
    const acceptedTask = task({ jobId: "job:missing-local-accepted",
      productId: "payment_screenshot_observation", actionId: "observe" });
    const first = claimTask(acceptedTask);
    const regrant = { ...first, grant: { ...first.grant, same_accepted_attempt: true } };
    let accepts = 0;
    let executions = 0;
    let websiteWrites = 0;
    await executeClaim({
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[regrant.job_id, new AbortController()]]), store: recoveryStore,
      executor: {
        accept: (value: typeof acceptedTask, attemptId: string) => {
          accepts += 1;
          return recoveryStore.acceptTask(value, attemptId);
        },
        execute: async () => { executions += 1; throw new Error("UNEXPECTED_EXECUTION"); },
      },
      session: {
        workerSessionId: "worker:missing-local", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (_path: string, options?: Readonly<{ method?: string }>) => {
          if (options?.method && options.method !== "GET") websiteWrites += 1;
          return failureStatus(regrant.job_id, null, []);
        },
      },
      browserAuthority: {
        readJobBrowserHistoryEvidence: () => ({ walHistoryVerified: true, rowCount: 1 }),
      },
      evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
      dataDir: recoveryDirectory,
      runtimeLogger: createRuntimeLogger({ producer: "agent-missing-local-accepted",
        owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(recoveryDirectory, "runtime-logs") } }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    } as never, regrant);
    assert.equal(accepts, 1);
    assert.equal(executions, 0,
      "Browser history with a missing local task must first restore the durable task identity");
    assert.equal(websiteWrites, 0,
      "the accepted Website attempt must not be released during local authority recovery");
    assert.equal(recoveryStore.readTask(regrant.job_id)?.current_reason,
      "LOCAL_AUTHORITY_RECOVERY_PENDING");
  } finally {
    recoveryStore.close();
    await rm(recoveryDirectory, { recursive: true, force: true });
  }
};

export const verifyRemoteFailureWithoutLocalAuthorityStopsBeforeProduct = async (): Promise<void> => {
  await verifyRemoteFailureWithoutLocalAuthority();
  await verifyMissingLocalAcceptedRecovery();
};
