import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type {
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import { webChatFailureReason } from "../failure-classification.js";
import {
  readWebChatExecution,
  updateWebChatExecution,
  type WebChatExecutionFailure,
  type WebChatExecutionRecord,
  type WebChatTitleRenameState,
} from "./web-chat-execution-state.js";

const DEFAULT_RENAME_BATCH_SIZE = 8;
const MIN_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60_000;

export type WebChatTitleRenameExecutor = (
  record: WebChatExecutionRecord,
) => Promise<WebChatSubmissionProof>;

export type WebChatTitleHousekeepingSummary = {
  attempted: number;
  verified: number;
  pending: number;
  reviewRequired: number;
  nextAttemptAt: string | null;
};

const executionStateDir = (dataDir: string): string =>
  path.join(
    dataDir,
    "runtime-data",
    "ai-input-gateway",
    "web-chat-executions",
  );

const listExecutionIds = async (dataDir: string): Promise<string[]> => {
  try {
    const root = executionStateDir(dataDir);
    const names = await readdir(root);
    const executionIds: string[] = [];
    for (const name of names.sort()) {
      if (!name.endsWith(".json")) continue;
      const parsed = JSON.parse(
        await readFile(path.join(root, name), "utf8"),
      ) as Partial<WebChatExecutionRecord>;
      if (typeof parsed.executionId === "string") {
        executionIds.push(parsed.executionId);
      }
    }
    return executionIds;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

const isPendingPublishedRename = (
  record: WebChatExecutionRecord,
): boolean =>
  record.providerKind === "gpt-web-chat"
  && record.status === "response_captured"
  && Boolean(record.responseCheckpoint)
  && Boolean(record.submission?.canonicalConversationUrl)
  && Boolean(record.systemChatTitle)
  && record.chatTitleRename?.status === "pending";

const retryDelayMs = (attemptCount: number): number =>
  Math.min(
    MAX_RETRY_DELAY_MS,
    MIN_RETRY_DELAY_MS * (2 ** Math.max(0, Math.min(4, attemptCount - 1))),
  );

const nextPendingState = (
  current: WebChatTitleRenameState,
  input: {
    attemptCount: number;
    attemptedAt: string;
    reason: string | null;
  },
): WebChatTitleRenameState => ({
  ...current,
  status: "pending",
  attemptCount: input.attemptCount,
  lastAttemptAt: input.attemptedAt,
  nextAttemptAt: new Date(
    new Date(input.attemptedAt).getTime() + retryDelayMs(input.attemptCount),
  ).toISOString(),
  lastFailureReason: input.reason,
  verifiedAt: null,
});

const isRenameIdentityAmbiguity = (reason: string): boolean =>
  /(?:AMBIGUOUS|identity mismatch|identity changed|does not match its durable execution identity|marker is ambiguous|missing the durable name|missing canonical conversation URL)/iu
    .test(reason);

const appendHousekeepingFailure = (
  record: WebChatExecutionRecord,
  input: {
    occurredAt: string;
    reason: string;
    reviewRequired: boolean;
  },
): WebChatExecutionFailure[] => [
  ...record.failures,
  {
    occurredAt: input.occurredAt,
    attemptId: record.attemptId,
    phase: record.status,
    classification: input.reviewRequired
      ? "review_required" as const
      : "recovery_pending" as const,
    recoverable: !input.reviewRequired,
    reason: `chat_title_housekeeping: ${input.reason}`,
  },
].slice(-20);

const validateVerifiedSubmission = (
  record: WebChatExecutionRecord,
  submission: WebChatSubmissionProof,
): void => {
  if (
    !submission.chatTitleVerifiedAt
    || submission.systemChatTitle !== record.systemChatTitle
    || submission.canonicalConversationUrl
      !== record.submission?.canonicalConversationUrl
  ) {
    throw new Error(
      "review_required: persisted ChatGPT rename proof does not match its durable execution identity.",
    );
  }
};

const claimRenameAttempt = async (
  dataDir: string,
  executionId: string,
): Promise<WebChatExecutionRecord | null> => {
  const latest = await readWebChatExecution(dataDir, executionId);
  if (!latest || !isPendingPublishedRename(latest)) return null;
  const nextAttemptAt = latest.chatTitleRename?.nextAttemptAt;
  if (
    nextAttemptAt
    && new Date(nextAttemptAt).getTime() > Date.now()
  ) return null;
  const attemptedAt = new Date().toISOString();
  return updateWebChatExecution({
    dataDir,
    record: latest,
    patch: {
      chatTitleRename: nextPendingState(latest.chatTitleRename!, {
        attemptCount: latest.chatTitleRename!.attemptCount + 1,
        attemptedAt,
        reason: null,
      }),
    },
  });
};

const markRenameVerified = async (
  dataDir: string,
  claimed: WebChatExecutionRecord,
  submission: WebChatSubmissionProof,
): Promise<void> => {
  validateVerifiedSubmission(claimed, submission);
  const latest = await readWebChatExecution(dataDir, claimed.executionId);
  if (!latest || !isPendingPublishedRename(latest)) return;
  if (
    latest.inputHash !== claimed.inputHash
    || latest.turnMarker !== claimed.turnMarker
    || latest.systemChatTitle !== claimed.systemChatTitle
    || latest.submission?.canonicalConversationUrl
      !== claimed.submission?.canonicalConversationUrl
  ) {
    throw new Error(
      "review_required: ChatGPT rename execution identity changed while housekeeping was running.",
    );
  }
  await updateWebChatExecution({
    dataDir,
    record: latest,
    patch: {
      submission: {
        ...latest.submission!,
        systemChatTitle: submission.systemChatTitle,
        observedAutoChatTitle: submission.observedAutoChatTitle,
        chatTitleVerifiedAt: submission.chatTitleVerifiedAt,
      },
      chatTitleRename: {
        status: "verified",
        attemptCount: latest.chatTitleRename!.attemptCount,
        lastAttemptAt: latest.chatTitleRename!.lastAttemptAt,
        nextAttemptAt: null,
        lastFailureReason: null,
        verifiedAt: submission.chatTitleVerifiedAt,
      },
    },
  });
};

const markRenameFailure = async (
  dataDir: string,
  claimed: WebChatExecutionRecord,
  error: unknown,
): Promise<"pending" | "review_required"> => {
  const latest = await readWebChatExecution(dataDir, claimed.executionId);
  if (!latest || !isPendingPublishedRename(latest)) return "pending";
  const occurredAt = new Date().toISOString();
  const reason = webChatFailureReason(error);
  const reviewRequired = isRenameIdentityAmbiguity(reason);
  await updateWebChatExecution({
    dataDir,
    record: latest,
    patch: {
      chatTitleRename: reviewRequired
        ? {
            ...latest.chatTitleRename!,
            status: "review_required",
            lastAttemptAt: occurredAt,
            nextAttemptAt: null,
            lastFailureReason: reason,
            verifiedAt: null,
          }
        : nextPendingState(latest.chatTitleRename!, {
            attemptCount: latest.chatTitleRename!.attemptCount,
            attemptedAt: occurredAt,
            reason,
          }),
      failures: appendHousekeepingFailure(latest, {
        occurredAt,
        reason,
        reviewRequired,
      }),
    },
  });
  return reviewRequired ? "review_required" : "pending";
};

export const inspectPendingPublishedWebChatTitleRenames = async (
  dataDir: string,
): Promise<{ count: number; nextAttemptAt: string | null }> => {
  let count = 0;
  let nextAttemptAt: string | null = null;
  for (const executionId of await listExecutionIds(dataDir)) {
    const record = await readWebChatExecution(dataDir, executionId);
    if (!record || !isPendingPublishedRename(record)) continue;
    count += 1;
    const candidate = record.chatTitleRename?.nextAttemptAt;
    if (!candidate) {
      nextAttemptAt = new Date().toISOString();
    } else if (!nextAttemptAt || candidate < nextAttemptAt) {
      nextAttemptAt = candidate;
    }
  }
  return { count, nextAttemptAt };
};

export const drainWebChatTitleHousekeeping = async (input: {
  dataDir: string;
  executeRename: WebChatTitleRenameExecutor;
  batchSize?: number;
}): Promise<WebChatTitleHousekeepingSummary> => {
  const records: WebChatExecutionRecord[] = [];
  for (const executionId of await listExecutionIds(input.dataDir)) {
    const record = await readWebChatExecution(input.dataDir, executionId);
    if (record && isPendingPublishedRename(record)) records.push(record);
  }
  records.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
    || left.executionId.localeCompare(right.executionId));

  let attempted = 0;
  let verified = 0;
  let reviewRequired = 0;
  const batchSize = Math.max(
    1,
    Math.min(input.batchSize ?? DEFAULT_RENAME_BATCH_SIZE, 64),
  );
  for (const record of records.slice(0, batchSize)) {
    const claimed = await claimRenameAttempt(
      input.dataDir,
      record.executionId,
    );
    if (!claimed) continue;
    attempted += 1;
    try {
      const submission = await input.executeRename(claimed);
      await markRenameVerified(input.dataDir, claimed, submission);
      verified += 1;
    } catch (error) {
      if (
        await markRenameFailure(input.dataDir, claimed, error)
        === "review_required"
      ) {
        reviewRequired += 1;
      }
    }
  }
  const pending = await inspectPendingPublishedWebChatTitleRenames(
    input.dataDir,
  );
  return {
    attempted,
    verified,
    pending: pending.count,
    reviewRequired,
    nextAttemptAt: pending.nextAttemptAt,
  };
};
