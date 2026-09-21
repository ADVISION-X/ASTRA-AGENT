import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductionRuntimeStore as RuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executeClaim } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { createRuntimeLogger, type RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { HASH_A, claimTask, deviceStatusWithoutAdmission, task } from
  "./agent-production-runtime-fixtures.js";

export const mismatchEvidenceRef = "browser-gpt-dialog-unrecognized:typed-authority";

export const typedDialogFailure = (
  code: "BROWSER_GPT_DIALOG_UNRECOGNIZED" | "BROWSER_KNOWN_GPT_RATE_LIMIT",
  evidenceRef: string,
  evidenceHash: `sha256:${string}`,
) => executionFailure("failed", code, {
  metadata: Object.freeze({
    evidence: Object.freeze({ evidenceRef, evidenceHash }),
    knownGptDialogAuthority: Object.freeze({ evidenceRef, evidenceHash }),
  }),
});

const assertMismatchRuntimeLog = async (logger: RuntimeLogger): Promise<void> => {
  const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>);
  const terminal = events.find((event) => {
    const failure = event.failure as Readonly<Record<string, unknown>> | undefined;
    return event.kind === "span.terminal" && failure?.code === "BROWSER_GPT_DIALOG_UNRECOGNIZED";
  });
  assert.equal(terminal?.authorityRef, mismatchEvidenceRef,
    "runtime diagnosis must bind the mismatch terminal to its Browser authority");
  assert.equal(terminal?.authorityHash, HASH_A,
    "runtime diagnosis must retain the Browser mismatch evidence hash");
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
    await assertMismatchRuntimeLog(runtimeLogger);
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
