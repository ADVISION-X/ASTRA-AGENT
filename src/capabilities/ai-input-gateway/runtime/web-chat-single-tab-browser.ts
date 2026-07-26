import type {
  BrowserActionResult,
  BrowserController,
} from "../../../lib/browser/browser-controller.js";
import type { WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import {
  acquireWebChatBrowserMutationLease,
  type WebChatRuntimeLease,
} from "./web-chat-concurrency-lease.js";
import { focusBoundWebChatConversation } from "./web-chat-single-tab-routing.js";

type SingleTabBrowserInput = {
  base: BrowserController;
  dataDir: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  systemChatTitle: string | null;
  turnMarker: string;
  timeoutMs: number;
  signal?: AbortSignal;
  initialMutationLease: WebChatRuntimeLease | null;
  resumeSubmission: WebChatSubmissionProof | null;
};

type SingleTabState = {
  initialMutationLease: WebChatRuntimeLease | null;
  submission: WebChatSubmissionProof | null;
};

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

export type SingleTabWebChatBrowser = {
  browser: BrowserController;
  bindConversationIdentity(submission: WebChatSubmissionProof): void;
  releaseInitialMutationLease(): Promise<void>;
};

type MutationRunner = <T>(operation: () => Promise<T>, route?: boolean) => Promise<T>;

const routeToBoundConversation = async (
  input: SingleTabBrowserInput,
  state: SingleTabState,
): Promise<void> => {
  if (!state.submission) return;
  await focusBoundWebChatConversation({
    base: input.base,
    providerKind: input.providerKind,
    systemChatTitle: input.systemChatTitle,
    submission: state.submission,
    turnMarker: input.turnMarker,
    ...(input.signal ? { signal: input.signal } : {}),
  });
};

const createMutationRunner = (
  input: SingleTabBrowserInput,
  state: SingleTabState,
): MutationRunner => async <T>(
  operation: () => Promise<T>,
  route = true,
): Promise<T> => {
  const lease = state.initialMutationLease ?? await acquireWebChatBrowserMutationLease({
    dataDir: input.dataDir,
    timeoutMs: input.timeoutMs,
    ...(input.signal ? { signal: input.signal } : {}),
  });
  const ownsLease = lease !== state.initialMutationLease;
  try {
    if (route) await routeToBoundConversation(input, state);
    return await operation();
  } finally {
    if (ownsLease) await lease.release();
  }
};

const createBrowserFacade = (
  input: SingleTabBrowserInput,
  withMutation: MutationRunner,
): BrowserController => {
  const browser = {
    getHealth: () => input.base.getHealth(),
    getSessionState: () => input.base.getSessionState(),
    getGeometrySnapshot: () => withMutation(() => input.base.getGeometrySnapshot()),
    open: (value) => withMutation(
      () => input.base.open({ ...value, reusePolicy: "reuse-active-tab" }),
      false,
    ),
    scroll: (value) => withMutation(() => input.base.scroll(value)),
    click: (value) => withMutation(() => input.base.click(value)),
    clickLocatedDomElement: (value) => withMutation(() => input.base.clickLocatedDomElement(value)),
    textInput: (value) => withMutation(() => input.base.textInput(value)),
    screenshotRegion: (value) => withMutation(() => input.base.screenshotRegion(value)),
    evaluateActiveTab: <T>(value: Parameters<BrowserController["evaluateActiveTab"]>[0]) =>
      withMutation(() => input.base.evaluateActiveTab<T>(value)),
    setFileInputFiles: (value) => withMutation(() => input.base.setFileInputFiles(value)),
    wait: async (durationMs: number): Promise<BrowserActionResult> => {
      await delay(durationMs, input.signal);
      return {
        browserActionId: "single-tab-web-chat-wait",
        ok: true,
        message: `waited ${durationMs}ms without occupying the single browser mutation slot`,
        createdAt: new Date().toISOString(),
      };
    },
    closeActiveTab: async (): Promise<BrowserActionResult> => ({
      browserActionId: "single-tab-web-chat-leave-open",
      ok: true,
      message: "left the single controlled web-chat tab open",
      createdAt: new Date().toISOString(),
    }),
    close: async (): Promise<BrowserActionResult> => ({
      browserActionId: "single-tab-web-chat-leave-open",
      ok: true,
      message: "left the single controlled web-chat tab open",
      createdAt: new Date().toISOString(),
    }),
  } as BrowserController;
  if (input.base.move) {
    browser.move = (value) => withMutation(() => input.base.move!(value));
  }
  if (input.base.selectFilesInNativePicker) {
    browser.selectFilesInNativePicker = (value) =>
      withMutation(() => input.base.selectFilesInNativePicker!(value));
  }
  return browser;
};

const bindConversationIdentity = (
  input: SingleTabBrowserInput,
  state: SingleTabState,
  submission: WebChatSubmissionProof,
): void => {
  if (
    input.providerKind === "gpt-web-chat"
    && (
      submission.systemChatTitle !== input.systemChatTitle
      || !submission.chatTitleVerifiedAt
    )
  ) {
    throw new Error("review_required: unverified ChatGPT system title cannot be bound for polling.");
  }
  state.submission = submission;
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
    submission: input.resumeSubmission,
  };
  const withMutation = createMutationRunner(input, state);
  return {
    browser: createBrowserFacade(input, withMutation),
    bindConversationIdentity: (submission) =>
      bindConversationIdentity(input, state, submission),
    releaseInitialMutationLease: () => releaseInitialMutationLease(state),
  };
};
