import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import {
  acquireWebChatBrowserPatrolLease,
  acquireWebChatBrowserMutationLease,
  type WebChatRuntimeLease,
} from "./web-chat-concurrency-lease.js";
import { focusBoundWebChatConversation } from "./web-chat-single-tab-routing.js";

type SingleTabBrowserInput = Readonly<{
  base: BrowserTargetLease;
  dataDir: string;
  executionId: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  turnMarker: string;
  timeoutMs: number;
  signal?: AbortSignal;
  initialMutationLease: WebChatRuntimeLease | null;
  resumeSubmission: WebChatSubmissionProof | null;
}>;

type SingleTabState = {
  initialMutationLease: WebChatRuntimeLease | null;
  submission: WebChatSubmissionProof | null;
};

export const isRoutableWebChatSubmission = (
  submission: WebChatSubmissionProof | null,
): submission is WebChatSubmissionProof & { canonicalConversationUrl: string } =>
  typeof submission?.canonicalConversationUrl === "string"
  && submission.canonicalConversationUrl.length > 0;

const delay = (durationMs: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, durationMs);
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("browser wait aborted during single-tab web-chat polling."));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });

export type SingleTabWebChatBrowser = Readonly<{
  browser: BrowserTargetLease;
  globalBrowser: BrowserTargetLease;
  runExclusivePatrol<T>(operation: (browser: BrowserTargetLease) => Promise<T>): Promise<T>;
  bindObservedConversation(submission: WebChatSubmissionProof): void;
  bindConversationIdentity(submission: WebChatSubmissionProof): void;
  releaseInitialMutationLease(): Promise<void>;
}>;

type MutationOptions = Readonly<{ route?: boolean }>;
type MutationRunner = <T>(
  operation: () => Promise<T>,
  options?: MutationOptions,
) => Promise<T>;

const routeToBoundConversation = async (
  input: SingleTabBrowserInput,
  state: SingleTabState,
): Promise<void> => {
  if (!isRoutableWebChatSubmission(state.submission)) return;
  await focusBoundWebChatConversation({
    base: input.base,
    providerKind: input.providerKind,
    submission: state.submission,
    turnMarker: input.turnMarker,
    ...(input.signal ? { signal: input.signal } : {}),
  });
};

const createMutationRunner = (
  input: SingleTabBrowserInput,
  state: SingleTabState,
  mode: "submission_then_patrol" | "global_survival",
): MutationRunner => async <T>(operation: () => Promise<T>, options: MutationOptions = {}): Promise<T> => {
  const initialLease = mode === "submission_then_patrol" ? state.initialMutationLease : null;
  const lease = initialLease ?? (mode === "global_survival"
    ? await acquireWebChatBrowserMutationLease({ dataDir: input.dataDir, timeoutMs: input.timeoutMs })
    : await acquireWebChatBrowserPatrolLease({
      dataDir: input.dataDir,
      executionId: input.executionId,
      timeoutMs: input.timeoutMs,
      ...(input.signal ? { signal: input.signal } : {}),
    }));
  const ownsLease = lease !== initialLease;
  try {
    if (options.route !== false) await routeToBoundConversation(input, state);
    return await operation();
  } finally {
    if (ownsLease) await lease.release();
  }
};

/**
 * This is a concurrency fence around one authenticated BrowserTargetLease, not
 * a second controller or a compatibility facade. Every operation remains one
 * of the authority lease's finite commands; waits intentionally release the
 * physical browser mutation slot so other conversations can wait concurrently.
 */
const createBrowserFacade = (
  input: SingleTabBrowserInput,
  withMutation: MutationRunner,
  routeByDefault: boolean,
): BrowserTargetLease => ({
  leaseRef: input.base.leaseRef,
  authorityRef: input.base.authorityRef,
  authorityEpoch: input.base.authorityEpoch,
  executionBindingHash: input.base.executionBindingHash,
  ownerId: input.base.ownerId,
  agentJobRefHash: input.base.agentJobRefHash,
  agentExecutionRefHash: input.base.agentExecutionRefHash,
  writerLeaseEpoch: input.base.writerLeaseEpoch,
  writerFenceHash: input.base.writerFenceHash,
  target: input.base.target,
  get document() { return input.base.document; },
  navigate: (value) => withMutation(() => input.base.navigate(value), { route: false }),
  executeDomIntent: (value) => withMutation(
    () => input.base.executeDomIntent(value),
    { route: routeByDefault },
  ),
  observeCapability: (value) => withMutation(
    () => input.base.observeCapability(value),
    { route: routeByDefault },
  ),
  captureScreenshot: (value) => withMutation(
    () => input.base.captureScreenshot(value),
    { route: routeByDefault },
  ),
  attachFile: (value) => withMutation(
    () => input.base.attachFile(value),
    { route: routeByDefault },
  ),
  wait: ({ durationMs }) => delay(durationMs, input.signal),
  close: (value) => withMutation(() => input.base.close(value), { route: false }),
});

const bindConversationIdentity = (
  state: SingleTabState,
  submission: WebChatSubmissionProof,
): void => {
  if (isRoutableWebChatSubmission(submission)) state.submission = submission;
};

const releaseInitialMutationLease = async (state: SingleTabState): Promise<void> => {
  const lease = state.initialMutationLease;
  state.initialMutationLease = null;
  await lease?.release();
};

export const createSingleTabWebChatBrowser = (
  input: SingleTabBrowserInput,
): SingleTabWebChatBrowser => {
  const state: SingleTabState = {
    initialMutationLease: input.initialMutationLease,
    submission: isRoutableWebChatSubmission(input.resumeSubmission)
      ? input.resumeSubmission
      : null,
  };
  const submissionThenPatrol = createMutationRunner(input, state, "submission_then_patrol");
  const globalSurvival = createMutationRunner(input, state, "global_survival");
  return {
    browser: createBrowserFacade(input, submissionThenPatrol, true),
    globalBrowser: createBrowserFacade(input, globalSurvival, false),
    async runExclusivePatrol<T>(operation: (browser: BrowserTargetLease) => Promise<T>): Promise<T> {
      const lease = await acquireWebChatBrowserPatrolLease({
        dataDir: input.dataDir,
        executionId: input.executionId,
        timeoutMs: input.timeoutMs,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      try {
        await routeToBoundConversation(input, state);
        return await operation(input.base);
      } finally {
        await lease.release();
      }
    },
    bindObservedConversation: (submission) => bindConversationIdentity(state, submission),
    bindConversationIdentity: (submission) => bindConversationIdentity(state, submission),
    releaseInitialMutationLease: () => releaseInitialMutationLease(state),
  };
};
