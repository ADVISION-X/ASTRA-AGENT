import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { ProductionRuntimeStore as RuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import {
  executeClaim,
  reconcilePendingAttemptFailures,
  stageCompletedClaimResult,
} from "../../src/lib/local-runtime/production/runtime-claim.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { serializeTerminalFailureTransport } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HASH_A, attemptFailureFirstFact, claimTask, deviceStatusWithoutAdmission,
  resultFor, task } from "./agent-production-runtime-fixtures.js";
const mismatchEvidenceRef = "browser-gpt-dialog-unrecognized:typed-authority";

const typedDialogFailure = (
  code: "BROWSER_GPT_DIALOG_UNRECOGNIZED" | "BROWSER_KNOWN_GPT_RATE_LIMIT",
  evidenceRef: string,
  evidenceHash: `sha256:${string}`,
) => executionFailure("failed", code, {
  metadata: Object.freeze({
    evidence: Object.freeze({ evidenceRef, evidenceHash }),
    knownGptDialogAuthority: Object.freeze({ evidenceRef, evidenceHash }),
  }),
});

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

export const verifyGptDialogMismatchRuntimeContract = async (): Promise<void> => {
  const temporary = await mkdtemp(join(tmpdir(), "agent-dialog-mismatch-runtime-"));
  const store = new RuntimeStore(temporary);
  try {
    const websiteTask = task({
      jobId: "job:dialog-mismatch-runtime",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const job = claimTask(websiteTask);
    const activeAbort = new AbortController();
    let releaseRequests = 0;
    const statusSession = deviceStatusWithoutAdmission(job.job_id);
    const runtimeLogger = createRuntimeLogger({
      producer: "agent-dialog-mismatch-runtime-acceptance",
      owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "runtime-logs") },
    });
    await executeClaim({
      abort: new AbortController(),
      active: new Map(),
      activeAbort: new Map([[job.job_id, activeAbort]]),
      store,
      executor: {
        accept: (acceptedTask: typeof websiteTask, attemptId: string) =>
          store.acceptTask(acceptedTask, attemptId),
        acceptAfterFailureReconciled: () => { throw new Error("UNEXPECTED_RECONCILIATION"); },
        execute: async () => {
          throw typedDialogFailure("BROWSER_GPT_DIALOG_UNRECOGNIZED", mismatchEvidenceRef, HASH_A);
        },
      } as never,
      session: {
        workerSessionId: "worker:1",
        workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (path: string) => {
          if (path.endsWith("/lease-release")) releaseRequests += 1;
          return statusSession.request();
        },
      } as never,
      providerRateLimitControl: {} as never,
      browserAuthority: {} as never,
      gpt: {} as never,
      evidenceStore: {} as never,
      dataDir: temporary,
      runtimeLogger,
      draining: false,
      lastHeartbeat: null,
      lastErrorCode: null,
      lastErrorReason: null,
      stopped: false,
      ledgerReconciled: true,
    }, job);
    const record = store.readTask(job.job_id);
    assert.equal(record?.current_reason, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
    assert.equal(record?.attempt_failure, null,
      "dialog mismatch must leave the durable attempt-failure slot empty");
    assert.equal(releaseRequests, 0,
      "dialog mismatch must not release the accepted lease to Website recovery");
    assert.equal(store.outboxAuthorities().length, 0,
      "dialog mismatch must not create any Website Outbox write");
    const events = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
      .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>);
    const terminal = events.find((event) => {
      const failure = event.failure as Readonly<Record<string, unknown>> | undefined;
      return event.kind === "span.terminal" && failure?.code === "BROWSER_GPT_DIALOG_UNRECOGNIZED";
    });
    assert.equal(terminal?.authorityRef,
      mismatchEvidenceRef,
      "runtime diagnosis must bind the mismatch terminal to its Browser authority");
    assert.equal(terminal?.authorityHash, HASH_A,
      "runtime diagnosis must retain the Browser mismatch evidence hash");
  } finally {
    store.close();
    await rm(temporary, { recursive: true, force: true });
  }
};

export const verifyKnownGptRateLimitRuntimeContract = async (): Promise<void> => {
  const temporary = await mkdtemp(join(tmpdir(), "agent-known-rate-limit-runtime-"));
  const store = new RuntimeStore(temporary);
  try {
    const websiteTask = task({
      jobId: "job:known-rate-limit-runtime",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const job = claimTask(websiteTask);
    let releaseRequests = 0;
    const statusSession = deviceStatusWithoutAdmission(job.job_id);
    const runtimeLogger = createRuntimeLogger({
      producer: "agent-known-rate-limit-runtime-acceptance",
      owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "runtime-logs") },
    });
    await executeClaim({
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[job.job_id, new AbortController()]]), store,
      executor: {
        accept: (acceptedTask: typeof websiteTask, attemptId: string) =>
          store.acceptTask(acceptedTask, attemptId),
        acceptAfterFailureReconciled: () => { throw new Error("UNEXPECTED_RECONCILIATION"); },
        execute: async () => {
          throw typedDialogFailure("BROWSER_KNOWN_GPT_RATE_LIMIT",
            "browser-mutation:confirmed-known-rate-limit", HASH_A);
        },
      } as never,
      session: {
        workerSessionId: "worker:1", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (requestPath: string) => {
          if (requestPath.endsWith("/lease-release")) releaseRequests += 1;
          return statusSession.request();
        },
      } as never,
      providerRateLimitControl: {
        assertProviderSubmitAllowed: () => {
          throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
        },
      } as never,
      browserAuthority: {} as never, gpt: {} as never, evidenceStore: {} as never,
      dataDir: temporary, runtimeLogger, draining: false, lastHeartbeat: null,
      lastErrorCode: null, lastErrorReason: null, stopped: false, ledgerReconciled: true,
    }, job);
    const record = store.readTask(job.job_id);
    assert.equal(record?.current_reason,
      ["PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE", "browser-mutation:confirmed-known-rate-limit",
        HASH_A].join("|"));
    assert.equal(record?.attempt_failure, null,
      "an authoritative exact dialog behind a closed cooldown gate must not become attempt failure");
    assert.equal(releaseRequests, 0,
      "an authoritative exact dialog behind a closed cooldown gate must not issue a 409-prone release");
    assert.equal(store.outboxAuthorities().length, 0,
      "the Runtime exception must not create a second Website write path");
  } finally {
    store.close();
    await rm(temporary, { recursive: true, force: true });
  }
};

const failureStatus = (
  jobId: string,
  attemptFailure: Readonly<Record<string, unknown>> | null,
  writeReceipts: readonly Readonly<Record<string, unknown>>[],
) => ({
  schema_version: "xuanxue-ai-device-job-status.v6",
  job_id: jobId,
  status: "failed",
  current_reason: null,
  attempt_failure: attemptFailure,
  control_intent: { schema_version: "xuanxue-ai-control-intent.v6",
    job_id: jobId, control_epoch: 0, intent: "none", reason_code: null },
  next_action_code: "ACTIVE_ATTEMPT",
  terminal_status: null,
  terminal_payload_hash: null,
  business_admission_receipt: null,
  business_consumer_error: null,
  accepted_attempt_count: 1,
  write_receipts: writeReceipts,
});

export const verifyAttemptFailureReadbackRuntimeContract = async (): Promise<void> => {
  for (const scenario of ["success", "response_unknown", "success_missing_receipt",
    "response_unknown_uncommitted", "duplicate_receipt", "code_only_mismatch", "code_only_exact",
    "receipt_conflicting_fact", "conflict_409"] as const) {
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
      let postCount = 0;
      let getCount = 0;
      let committedRequest: Readonly<Record<string, unknown>> | null = null;
      const originalFailure = scenario === "conflict_409" || scenario === "receipt_conflicting_fact" ? {
        code: "WEBSITE_ORIGINAL_FAILURE",
        mutation_outcome: "no",
        effect_scope: null,
        child_capability_id: null,
        browser_outcome: null,
        evidence_ref: null,
        evidence_hash: null,
        child_proof_ref: null,
        child_proof_hash: null,
        stopped_empty_proof: null,
        cause: null,
        provider_effect_identity_hash: null,
        settled_result_payload_hash: null,
        from_status: "failed",
        to_status: "failed",
        attempt_id: job.grant.attempt_id,
        lease_version: job.grant.lease_version,
      } as const : null;
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
      assert.equal(postCount, 1, `${scenario} must issue exactly one failure release POST`);
      assert.equal(getCount, 2, `${scenario} must read Website before execution and after release`);
      assert.equal(store.readTask(job.job_id)?.attempt_failure?.failure_core.code,
        executionCode, `${scenario} must preserve the local immutable first fact`);
      if (scenario === "code_only_mismatch") {
        assert.equal(postCount, 1,
          "a mismatch code without the complete Browser fact must use the ordinary failure path");
      }
      if (scenario === "conflict_409" || scenario === "receipt_conflicting_fact") {
        assert.equal((state as { lastErrorCode: string | null }).lastErrorCode,
          "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT",
          "a different Website first fact must be recorded as an authority contradiction");
        assert.match(store.readTask(job.job_id)?.current_reason ?? "",
          /^PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT\|attempt-failure-authority-conflict\|/u,
          "the local authority must retain a durable local/remote conflict report");
      } else if (scenario === "success_missing_receipt"
        || scenario === "response_unknown_uncommitted") {
        assert.equal((state as { lastErrorCode: string | null }).lastErrorCode,
          "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH",
          `${scenario} must fail closed without the exact request receipt`);
        assert.match(store.readTask(job.job_id)?.current_reason ?? "",
          /^PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH/u,
          `${scenario} must durably retain the missing-receipt diagnosis`);
      } else if (scenario === "duplicate_receipt") {
        assert.equal((state as { lastErrorCode: string | null }).lastErrorCode,
          "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT",
          "duplicate receipts for one request must fail closed even when one receipt matches");
      } else {
        assert.equal((state as { lastErrorCode: string | null }).lastErrorCode, null,
          `${scenario} must close through the exact persisted receipt`);
      }

      store.close();
      store = new RuntimeStore(temporary);
      const restartedState = { ...(state as object), store } as never;
      if (scenario === "duplicate_receipt") {
        await assert.rejects(reconcilePendingAttemptFailures(restartedState),
          /PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT/u);
      } else {
        await reconcilePendingAttemptFailures(restartedState);
      }
      assert.equal(postCount, 1,
        `${scenario} restart reconciliation must remain GET-only and never replay the POST`);
      assert.equal(getCount, 3, `${scenario} restart reconciliation must perform one exact readback`);
    } finally {
      store.close();
      await rm(temporary, { recursive: true, force: true });
    }
  }

  const waitNewDirectory = await mkdtemp(join(tmpdir(), "agent-wait-new-attempt-claim-"));
  const waitNewStore = new RuntimeStore(waitNewDirectory);
  try {
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
  } finally {
    waitNewStore.close();
    await rm(waitNewDirectory, { recursive: true, force: true });
  }

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

  for (const scenario of [
    { slug: "current-lease-different-core", currentLease: 2, remoteLease: 2,
      remoteFailureCode: "REMOTE_NEW_LEASE_FAILURE" },
    { slug: "intermediate-lease-same-core", currentLease: 3, remoteLease: 2,
      remoteFailureCode: "LOCAL_FIRST_FAILURE" },
  ]) for (const oldReceiptPresent of [false, true]) {
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
      const oldResponse = {
        schema_version: "xuanxue-ai-lease-release-receipt.v6",
        job_id: job.job_id,
        task_status: "failed",
        lease_disposition: "released",
        reason_code: localFailure.failure_core.code,
        payload_hash: localFailure.release_descriptor.body_payload_hash,
        terminal_payload_hash: null,
        attempt_failure: localFailure.failure_core,
      };
      const oldReceipts = oldReceiptPresent ? [{
        request_id: localFailure.release_descriptor.request_id,
        write_kind: "lease_release",
        payload_hash: localFailure.release_descriptor.write_request_payload_hash,
        response_json: oldResponse,
      }] : [];
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
  }

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

  const activeCarrierDirectory = await mkdtemp(join(tmpdir(), "agent-active-carrier-"));
  const activeCarrierStore = new RuntimeStore(activeCarrierDirectory);
  try {
    const websiteTask = task({
      jobId: "job:active-provider-effect-carrier",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const job = claimTask(websiteTask);
    activeCarrierStore.acceptTask(websiteTask, job.grant.attempt_id);
    const browserAuthorityRef = "browser-mutation:confirmed-provider-effect";
    const browserAuthorityHash = `sha256:${"b".repeat(64)}` as const;
    const providerEffectIdentityHash = HASH_A;
    const failure = attemptFailureFirstFact(job.grant.attempt_id,
      serializeTerminalFailureTransport(executionFailure("failed", "PRODUCT_EXECUTION_FAILED", {
        metadata: {
          mutationOutcome: "confirmed",
          evidence: { evidenceRef: browserAuthorityRef, evidenceHash: browserAuthorityHash },
          browserEffect: {
            effectScope: "provider_effect",
            childCapabilityId: "submit_exact_gpt_turn_once",
            browserOutcome: "CONFIRMED",
            providerEffectIdentityHash,
          },
        },
      })));
    activeCarrierStore.recordAttemptFailure(websiteTask.job_id, job.grant.attempt_id, failure);
    const executionRecord = activeCarrierStore.readTask(websiteTask.job_id)!;
    const result = resultFor(websiteTask);
    const stage = (providerEffectReadbackProof: unknown) => stageCompletedClaimResult({
      store: activeCarrierStore,
      job,
      execution: { record: executionRecord, result, providerEffectReadbackProof } as never,
    });
    assert.throws(() => stage(null),
      (error: unknown) => typedExecutionFailure(error)?.code === "PROVIDER_EFFECT_READBACK_PROOF_INVALID",
      "ACTIVE_ATTEMPT must reject a missing provider-effect readback carrier");
    assert.deepEqual(activeCarrierStore.readTask(websiteTask.job_id)?.attempt_failure, failure);
    assert.equal(activeCarrierStore.readTask(websiteTask.job_id)?.staged_result, null,
      "a missing carrier must not stage the result");
    const proofBody = Object.freeze({
      schema_version: "provider-effect-readback-proof.v1" as const,
      job_id: websiteTask.job_id,
      attempt_id: job.grant.attempt_id,
      result_revision: job.grant.result_revision,
      provider_effect_identity_hash: providerEffectIdentityHash,
      exact_call_identity_hash: `sha256:${"c".repeat(64)}` as const,
      browser_authority_ref: browserAuthorityRef,
      browser_authority_hash: browserAuthorityHash,
      readback_provider_input_delta: 0 as const,
    });
    const proof = Object.freeze({ ...proofBody, proof_hash: hashCanonical(proofBody) });
    assert.throws(() => stage({ ...proof, browser_authority_hash: HASH_A }),
      (error: unknown) => typedExecutionFailure(error)?.code === "PROVIDER_EFFECT_READBACK_PROOF_INVALID",
      "ACTIVE_ATTEMPT must reject a tampered provider-effect readback carrier");
    assert.deepEqual(activeCarrierStore.readTask(websiteTask.job_id)?.attempt_failure, failure);
    assert.equal(activeCarrierStore.readTask(websiteTask.job_id)?.staged_result, null,
      "a tampered carrier must not stage the result");
    stage(proof);
    const staged = activeCarrierStore.readTask(websiteTask.job_id);
    assert.equal(staged?.attempt_failure, null,
      "the exact carrier must atomically clear the matching first fact");
    assert.deepEqual(staged?.staged_result, result,
      "the exact carrier must stage only the same execution result");
  } finally {
    activeCarrierStore.close();
    await rm(activeCarrierDirectory, { recursive: true, force: true });
  }

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
    store.stageResult(websiteTask.job_id, staged);
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
      "consume-current-result must read the failure disposition and then business admission");
    assert.equal(reconciled?.attempt_failure, null,
      "consume-current-result must atomically clear the obsolete first failure fact");
    assert.deepEqual(reconciled?.staged_result, staged,
      "consume-current-result must retain the exact staged result for admission");
    assert.equal(reconciled?.current_reason, "BUSINESS_ADMISSION_PENDING");
  } finally {
    store.close();
    await rm(temporary, { recursive: true, force: true });
  }
};
