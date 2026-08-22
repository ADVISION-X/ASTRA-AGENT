import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  acquireWebChatBrowserMutationLease,
  pendingWebChatSubmissionCount,
  registerPendingWebChatSubmission,
} from "../runtime/web-chat-concurrency-lease.js";

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const submissionAdmission = (grant: string, priorityKey: string) => ({
  admissionRef: `sha256:${createHash("sha256").update(grant).digest("hex")}` as const,
  priorityKey,
});

export const registerDeadProcessSubmissionTicket = async (
  dataDir: string,
  executionId: string,
): Promise<void> => {
  const waiter = registerPendingWebChatSubmission(
    dataDir,
    executionId,
    submissionAdmission("cloud-attempt-1", "2026-08-22T00:00:00.000Z:oldest:0001"),
  );
  await writeFile(
    path.join(dataDir, "dead-process-submission-ticket.json"),
    JSON.stringify({ waiterId: waiter.waiterId, ticket: waiter.ticket }),
    "utf8",
  );
};

export const assertWebChatSchedulerAdmissionRecovery = async (
  dataDir: string,
  deadProcessTicket: { waiterId: string; ticket: number },
): Promise<void> => {
  const afterRestart = registerPendingWebChatSubmission(
    dataDir,
    "dead-process-submission",
    submissionAdmission("cloud-attempt-2", "2026-08-22T00:00:00.000Z:oldest:0001"),
  );
  assert.equal(pendingWebChatSubmissionCount(dataDir), 1,
    "a dead-process ticket without a current Cloud grant must not block the same durable execution after a fresh current Cloud grant");
  assert.notEqual(afterRestart.waiterId, deadProcessTicket.waiterId,
    "the same durable execution must receive a new waiter after dead-owner cleanup and fresh Cloud admission");
  assert.ok(afterRestart.ticket > deadProcessTicket.ticket,
    "restart preserves monotonic scheduler accounting after stale ticket cleanup");
  afterRestart.release();

  const liveAdmission = registerPendingWebChatSubmission(
    dataDir,
    "live-admission-drift",
    submissionAdmission("live-cloud-attempt-1", "2026-08-22T00:00:01.000Z:live:0001"),
  );
  assert.throws(() => registerPendingWebChatSubmission(
    dataDir,
    "live-admission-drift",
    submissionAdmission("live-cloud-attempt-2", "2026-08-22T00:00:01.000Z:live:0001"),
  ), /WEB_CHAT_SUBMISSION_ADMISSION_DRIFT/u,
  "a live waiter cannot replace its current Cloud admission in place");
  liveAdmission.release();

  const newer = registerPendingWebChatSubmission(
    dataDir,
    "newer-by-business-age",
    submissionAdmission("newer-cloud-grant", "2026-08-22T00:00:03.000Z:newer:0001"),
  );
  const oldest = registerPendingWebChatSubmission(
    dataDir,
    "oldest-by-business-age",
    submissionAdmission("oldest-cloud-grant", "2026-08-22T00:00:02.000Z:oldest:0001"),
  );
  let newerEntered = false;
  const newerLease = acquireWebChatBrowserMutationLease({
    dataDir,
    timeoutMs: 4_000,
    submissionWaiter: newer,
  }).then((lease) => {
    newerEntered = true;
    return lease;
  });
  await delay(250);
  assert.equal(newerEntered, false,
    "reverse async registration must not overtake the globally oldest claimable task");
  const oldestLease = await acquireWebChatBrowserMutationLease({
    dataDir,
    timeoutMs: 2_000,
    submissionWaiter: oldest,
  });
  oldest.release();
  await oldestLease.release();
  const admittedNewerLease = await newerLease;
  newer.release();
  await admittedNewerLease.release();
};
