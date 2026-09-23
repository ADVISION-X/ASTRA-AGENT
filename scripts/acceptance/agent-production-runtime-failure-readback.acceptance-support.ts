import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductionRuntimeStore as RuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executeClaim, reconcilePendingAttemptFailures } from
  "../../src/lib/local-runtime/production/runtime-claim.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { classifyAttemptFailure, serializeTerminalFailureTransport,
  type SerializedTerminalFailure } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import { HASH_A, attemptFailureFirstFact, claimTask, failureStatus, task } from
  "./agent-production-runtime-fixtures.js";

const SCENARIOS = ["success", "response_unknown", "success_missing_receipt",
  "response_unknown_uncommitted", "duplicate_receipt", "code_only_mismatch", "code_only_exact",
  "receipt_conflicting_fact", "conflict_409"] as const;
type Scenario = (typeof SCENARIOS)[number];

const originalFailureFor = (scenario: Scenario, job: ReturnType<typeof claimTask>) =>
  scenario === "conflict_409" || scenario === "receipt_conflicting_fact" ? {
    code: "WEBSITE_ORIGINAL_FAILURE", mutation_outcome: "no", effect_scope: null,
    child_capability_id: null, browser_outcome: null, evidence_ref: null,
    evidence_hash: null, child_proof_ref: null, child_proof_hash: null,
    stopped_empty_proof: null, cause: null, provider_effect_identity_hash: null,
    settled_result_payload_hash: null, from_status: "failed", to_status: "failed",
    attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
  } as const : null;

const readbackSessionFor = (
  scenario: Scenario, job: ReturnType<typeof claimTask>, executionCode: string, store: RuntimeStore,
) => {
  let postCount = 0;
  let getCount = 0;
  let committedRequest: Readonly<Record<string, unknown>> | null = null;
  const originalFailure = originalFailureFor(scenario, job);
  const session = {
    workerSessionId: "worker:failure-readback",
    workerSessionEpoch: 1,
    device: { server_base_url: "http://127.0.0.1:4322" },
    request: async (path: string, options?: Readonly<{ method?: string; body?: string }>) => {
      if (path.endsWith("/lease-release")) {
        postCount += 1;
        const request = JSON.parse(options?.body ?? "null") as Readonly<Record<string, unknown>>;
        assert.ok(store.readTask(job.job_id)?.attempt_failure,
          "the complete first fact must be durably readable before failure release POST");
        if (scenario !== "response_unknown_uncommitted") committedRequest = request;
        if (scenario === "response_unknown" || scenario === "response_unknown_uncommitted") {
          throw runtimeTransportFailure("CLOUD_TRANSPORT_UNAVAILABLE", 503);
        }
        if (scenario === "conflict_409") {
          throw runtimeTransportFailure("AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT", 409);
        }
        return { ok: true };
      }
      if (!path.endsWith("/device-status")) throw new Error("UNEXPECTED_RUNTIME_REQUEST");
      getCount += 1;
      if (!committedRequest) return failureStatus(job.job_id, null, []);
      if (scenario === "conflict_409") return failureStatus(job.job_id, originalFailure, []);
      if (scenario === "success_missing_receipt") {
        return failureStatus(job.job_id, {
          ...(committedRequest.attempt_failure as Readonly<Record<string, unknown>>),
          from_status: "failed", to_status: "failed",
          attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
        }, []);
      }
      const response = {
        schema_version: "xuanxue-ai-lease-release-receipt.v6",
        job_id: job.job_id,
        task_status: "failed",
        lease_disposition: "released",
        reason_code: executionCode,
        payload_hash: committedRequest.payload_hash,
        terminal_payload_hash: null,
        attempt_failure: committedRequest.attempt_failure,
      };
      const receipt = {
        request_id: committedRequest.request_id,
        write_kind: "lease_release",
        payload_hash: hashCanonical(committedRequest),
        response_json: response,
      };
      return failureStatus(job.job_id,
        scenario === "receipt_conflicting_fact" ? originalFailure : null,
        scenario === "duplicate_receipt"
        ? [receipt, { ...receipt, payload_hash: HASH_A }] : [receipt]);
    },
  };
  return { session, counts: () => ({ postCount, getCount }) };
};

const assertReadbackDisposition = (input: Readonly<{
  scenario: Scenario; store: RuntimeStore; jobId: string; executionCode: string;
  counts: () => Readonly<{ postCount: number; getCount: number }>;
  lastErrorCode: string | null;
}>): void => {
  const { scenario, store, jobId, executionCode, counts, lastErrorCode } = input;
  assert.equal(counts().postCount, 1, `${scenario} must issue exactly one failure release POST`);
  assert.equal(counts().getCount, 2, `${scenario} must read Website before execution and after release`);
  assert.equal(store.readTask(jobId)?.attempt_failure?.failure_core.code,
    executionCode, `${scenario} must preserve the local immutable first fact`);
  if (scenario === "code_only_mismatch") {
    assert.equal(counts().postCount, 1,
      "a mismatch code without the complete Browser fact must use the ordinary failure path");
  }
  if (scenario === "conflict_409" || scenario === "receipt_conflicting_fact") {
    assert.equal(lastErrorCode,
      "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT",
      "a different Website first fact must be recorded as an authority contradiction");
    assert.match(store.readTask(jobId)?.current_reason ?? "",
      /^PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT\|attempt-failure-authority-conflict\|/u,
      "the local authority must retain a durable local/remote conflict report");
  } else if (scenario === "success_missing_receipt"
    || scenario === "response_unknown_uncommitted") {
    assert.equal(lastErrorCode,
      "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH",
      `${scenario} must fail closed without the exact request receipt`);
    assert.match(store.readTask(jobId)?.current_reason ?? "",
      /^PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH/u,
      `${scenario} must durably retain the missing-receipt diagnosis`);
  } else if (scenario === "duplicate_receipt") {
    assert.equal(lastErrorCode,
      "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT",
      "duplicate receipts for one request must fail closed even when one receipt matches");
  } else {
    assert.equal(lastErrorCode, null,
      `${scenario} must close through the exact persisted receipt`);
  }
};

export const verifyFailureReleaseReadbackScenarios = async (): Promise<void> => {
  for (const scenario of SCENARIOS) {
    const temporary = await mkdtemp(join(tmpdir(), `agent-failure-readback-${scenario}-`));
    let store = new RuntimeStore(temporary);
    try {
      const websiteTask = task({
        jobId: `job:failure-readback:${scenario}`,
        productId: "payment_screenshot_observation",
        actionId: "observe",
      });
      const job = claimTask(websiteTask);
      const activeAbort = new AbortController();
      const executionCode = scenario === "code_only_mismatch"
        ? "BROWSER_GPT_DIALOG_UNRECOGNIZED"
        : scenario === "code_only_exact"
          ? "BROWSER_KNOWN_GPT_RATE_LIMIT" : "PRODUCT_EXECUTION_FAILED";
      const { session, counts } = readbackSessionFor(scenario, job, executionCode, store);
      const runtimeLogger = createRuntimeLogger({
        producer: `agent-failure-readback-${scenario}`,
        owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(temporary, "runtime-logs") },
      });
      const state = {
        abort: new AbortController(),
        active: new Map(),
        activeAbort: new Map([[job.job_id, activeAbort]]),
        store,
        executor: {
          accept: (acceptedTask: typeof websiteTask, attemptId: string) =>
            store.acceptTask(acceptedTask, attemptId),
          acceptAfterFailureReconciled: () => { throw new Error("UNEXPECTED_RECONCILIATION"); },
          execute: async () => {
            throw executionFailure("failed", executionCode,
              scenario === "code_only_mismatch" || scenario === "code_only_exact"
              ? { metadata: { mutationOutcome: "no", evidence: {
                  evidenceRef: "non-authoritative-code-only", evidenceHash: HASH_A,
                } } } : {});
          },
        },
        session,
        providerRateLimitControl: {}, browserAuthority: {}, gpt: {}, evidenceStore: {},
        dataDir: temporary, runtimeLogger, draining: false, lastHeartbeat: null,
        lastErrorCode: null, lastErrorReason: null, stopped: false, ledgerReconciled: true,
      } as never;
      await executeClaim(state, job);
      assertReadbackDisposition({ scenario, store, jobId: job.job_id, executionCode, counts,
        lastErrorCode: (state as { lastErrorCode: string | null }).lastErrorCode });

      store.close();
      store = new RuntimeStore(temporary);
      const restartedState = { ...(state as object), store } as never;
      if (scenario === "duplicate_receipt") {
        await assert.rejects(reconcilePendingAttemptFailures(restartedState),
          /PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT/u);
      } else {
        await reconcilePendingAttemptFailures(restartedState);
      }
      assert.equal(counts().postCount, 1,
        `${scenario} restart reconciliation must remain GET-only and never replay the POST`);
      assert.equal(counts().getCount, 3, `${scenario} restart reconciliation must perform one exact readback`);
    } finally {
      store.close();
      await rm(temporary, { recursive: true, force: true });
    }
  }
};

export const verifyAttemptFailureClassificationMatrix = (): void => {
  const base: SerializedTerminalFailure = {
    code: "PRODUCT_EXECUTION_FAILED", mutation_outcome: "no", effect_scope: null,
    child_capability_id: null, browser_outcome: null, evidence_ref: null, evidence_hash: null,
    child_proof_ref: null, child_proof_hash: null, stopped_empty_proof: null, cause: null,
    provider_effect_identity_hash: null, settled_result_payload_hash: null,
  };
  const classify = (override: Partial<SerializedTerminalFailure>) =>
    classifyAttemptFailure({ ...base, ...override });
  const browserFact = {
    child_capability_id: "submit_exact_gpt_turn_once",
    evidence_ref: "browser-mutation:classification", evidence_hash: HASH_A,
  };
  const providerFact = { ...browserFact, effect_scope: "provider_effect" as const,
    provider_effect_identity_hash: HASH_A };
  for (const mutation_outcome of ["no", "dispatched", "confirmed"] as const) {
    assert.equal(classify({ ...browserFact, effect_scope: "target_local", browser_outcome: "REJECTED",
      mutation_outcome }), "new_attempt_allowed");
  }
  assert.equal(classify({ ...providerFact, browser_outcome: "REJECTED",
    mutation_outcome: "no" }), "new_attempt_allowed");
  for (const [browser_outcome, mutation_outcome] of [
    ["DISPATCHED", "dispatched"], ["CONFIRMED", "confirmed"],
    ["REJECTED", "dispatched"], ["REJECTED", "confirmed"],
  ] as const) assert.equal(classify({ ...providerFact, browser_outcome,
    mutation_outcome }), "same_attempt_provider_readback");
  for (const [browser_outcome, mutation_outcome] of [
    [null, "dispatched"], ["DISPATCHED", "confirmed"], ["CONFIRMED", "dispatched"],
    ["CONFIRMED", "no"], ["DISPATCHED", "no"],
  ] as const) assert.equal(classify({ ...providerFact, browser_outcome,
    mutation_outcome }), "fail_closed");
  for (const incomplete of [
    { ...providerFact, child_capability_id: null },
    { ...providerFact, evidence_ref: null },
    { ...providerFact, evidence_hash: null },
    { ...providerFact, provider_effect_identity_hash: null },
  ]) assert.equal(classify({ ...incomplete, browser_outcome: "CONFIRMED",
    mutation_outcome: "confirmed" }), "fail_closed");
  assert.equal(classify({ effect_scope: "target_local", browser_outcome: "REJECTED",
    mutation_outcome: "no" }), "fail_closed");
  const confirmedEffect = {
    ...providerFact, browser_outcome: "CONFIRMED" as const, mutation_outcome: "confirmed" as const,
  };
  assert.equal(classify({ ...confirmedEffect, code: "RESULT_SETTLED_UNUSABLE",
    settled_result_payload_hash: HASH_A }), "new_attempt_allowed");
  assert.equal(classify({ ...confirmedEffect, code: "RESULT_SETTLED_UNUSABLE" }), "fail_closed");
  assert.equal(classify({ ...confirmedEffect, code: "GPT_RESPONSE_STOPPED_EMPTY",
    child_capability_id: "submit_exact_gpt_turn_once", child_proof_ref: "child-proof:1",
    child_proof_hash: HASH_A, stopped_empty_proof: {
      first_observed_at: "2026-09-23T00:00:00.000Z",
      terminal_observed_at: "2026-09-23T00:20:00.000Z", continuous_monotonic_ms: 1_200_000,
      observation_count: 2, identity_hash: HASH_A, terminal_observation_revision_hash: HASH_A,
    },
  }), "new_attempt_allowed");
  assert.equal(classify({ ...confirmedEffect, code: "GPT_RESPONSE_STOPPED_EMPTY" }), "fail_closed");
};

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

const verifyRegrantedWithoutLocalAuthority = async <T extends { session: object; lastErrorCode: string | null }>(
  state: T, counts: { durableAccepts: number; productExecutions: number; websiteWrites: number },
): Promise<void> => {
  const regrantedTask = task({
    jobId: "job:regranted-without-local-authority",
    productId: "payment_screenshot_observation", actionId: "observe",
  });
  const freshShape = claimTask(regrantedTask);
  const regrantedJob = {
    ...freshShape, grant: { ...freshShape.grant, same_accepted_attempt: true },
  };
  counts.durableAccepts = 0;
  counts.productExecutions = 0;
  counts.websiteWrites = 0;
  const regrantState = { ...state,
    activeAbort: new Map([[regrantedJob.job_id, new AbortController()]]),
    session: { ...state.session, request:
      async (path: string, options?: Readonly<{ method?: string }>) => {
      if (options?.method && options.method !== "GET") counts.websiteWrites += 1;
      if (!path.endsWith("/device-status")) throw new Error("UNEXPECTED_RUNTIME_REQUEST");
      return failureStatus(regrantedJob.job_id, null, []);
    } },
  };
  await executeClaim(regrantState as never, regrantedJob);
  assert.equal(counts.durableAccepts, 0,
    "a regranted accepted attempt without its local authority must stop before acceptance");
  assert.equal(counts.productExecutions, 0,
    "an unknown old attempt must never enter Product or replay Provider submit");
  assert.equal(counts.websiteWrites, 0,
    "an unknown old accepted attempt must remain remote authority and must not be released");
  assert.equal(regrantState.lastErrorCode,
    "PRODUCTION_REGRANTED_ATTEMPT_LOCAL_AUTHORITY_MISSING");
};

export const verifyRemoteFailureWithoutLocalAuthorityStopsBeforeProduct = async (): Promise<void> => {
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

    await verifyRegrantedWithoutLocalAuthority(state, counts);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
};

export const verifyUnclassifiedFailureStopsBeforeProduct = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "agent-unclassified-failure-"));
  const store = new RuntimeStore(directory);
  try {
    const websiteTask = task({
      jobId: "job:unclassified-failure",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const firstGrant = claimTask(websiteTask);
    const job = { ...firstGrant, grant: { ...firstGrant.grant, lease_version: 2 } };
    store.acceptTask(websiteTask, job.grant.attempt_id);
    const failure = attemptFailureFirstFact(job.grant.attempt_id,
      serializeTerminalFailureTransport(executionFailure("failed", "GPT_CHAT_MODE_MISSING")));
    store.recordAttemptFailure(job.job_id, job.grant.attempt_id, failure);
    const remoteFailure = {
      ...failure.failure_core,
      from_status: "failed", to_status: "failed",
      attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
    };
    let durableAccepts = 0;
    let productExecutions = 0;
    let websiteWrites = 0;
    const state = {
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[job.job_id, new AbortController()]]), store,
      executor: {
        accept: () => { durableAccepts += 1; throw new Error("UNEXPECTED_ACCEPT"); },
        acceptAfterFailureReconciled: () => {
          durableAccepts += 1;
          throw new Error("UNEXPECTED_RECONCILED_ACCEPT");
        },
        execute: async () => {
          productExecutions += 1;
          throw new Error("UNEXPECTED_PRODUCT_EXECUTION");
        },
      },
      session: {
        workerSessionId: "worker:unclassified-failure", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (path: string, options?: Readonly<{ method?: string }>) => {
          if (options?.method && options.method !== "GET") websiteWrites += 1;
          if (!path.endsWith("/device-status")) throw new Error("UNEXPECTED_RUNTIME_REQUEST");
          return failureStatus(job.job_id, remoteFailure, []);
        },
      },
      browserAuthority: {}, evidenceStore: {}, providerRateLimitControl: {}, gpt: {},
      dataDir: directory,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-unclassified-failure", owner: "production-runtime",
        component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(directory, "runtime-logs") },
      }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    } as never;
    await executeClaim(state, job);
    assert.equal(durableAccepts, 0,
      "an unclassified failure must stop before durable Product acceptance");
    assert.equal(productExecutions, 0,
      "an unclassified failure must produce zero Product executions and Provider inputs");
    assert.equal(websiteWrites, 0,
      "an unclassified failure must produce zero Website writes");
    assert.equal(store.readTask(job.job_id)?.current_reason,
      "PRODUCTION_ATTEMPT_FAILURE_UNCLASSIFIED",
      "the local task must retain the exact fail-closed diagnosis");
    assert.deepEqual(store.readTask(job.job_id)?.attempt_failure?.failure_core, failure.failure_core,
      "fail-closed classification must preserve the immutable failure core");
    assert.equal(store.readTask(job.job_id)?.attempt_failure?.release_descriptor.lease_version, 2,
      "the first fact may only rebind to the current higher lease descriptor");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
};
