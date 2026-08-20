import type {
  BrowserActionResult,
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import type { WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import {
  acquireWebChatBrowserPatrolLease,
  acquireWebChatBrowserMutationLease,
  type WebChatRuntimeLease,
} from "./web-chat-concurrency-lease.js";
import { focusBoundWebChatConversation } from "./web-chat-single-tab-routing.js";

type SingleTabBrowserInput = {
  base: BrowserTargetLease;
  dataDir: string;
  executionId: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
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
      reject(
        new Error("browser wait aborted during single-tab web-chat polling."),
      );
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });

export type SingleTabWebChatBrowser = {
  browser: BrowserTargetLease;
  globalBrowser: BrowserTargetLease;
  runExclusivePatrol<T>(
    operation: (browser: BrowserTargetLease) => Promise<T>,
  ): Promise<T>;
  bindObservedConversation(submission: WebChatSubmissionProof): void;
  bindConversationIdentity(submission: WebChatSubmissionProof): void;
  releaseInitialMutationLease(): Promise<void>;
};

type MutationOptions = {
  route?: boolean;
  allowMissingProviderTab?: boolean;
};

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

const createMutationRunner =
  (
    input: SingleTabBrowserInput,
    state: SingleTabState,
    mode: "submission_then_patrol" | "global_survival",
  ): MutationRunner =>
  async <T>(
    operation: () => Promise<T>,
    options: MutationOptions = {},
  ): Promise<T> => {
    const initialLease =
      mode === "submission_then_patrol" ? state.initialMutationLease : null;
    const lease =
      initialLease ??
      (mode === "global_survival"
        ? await acquireWebChatBrowserMutationLease({
            dataDir: input.dataDir,
            timeoutMs: input.timeoutMs,
          })
        : await acquireWebChatBrowserPatrolLease({
            dataDir: input.dataDir,
            executionId: input.executionId,
            timeoutMs: input.timeoutMs,
            ...(input.signal ? { signal: input.signal } : {}),
          }));
    const ownsLease = lease !== initialLease;
    try {
      let routed = false;
      if (
        !input.base.getTarget?.() &&
        !options.allowMissingProviderTab &&
        options.route !== false &&
        state.submission
      ) {
        await routeToBoundConversation(input, state);
        routed = true;
      }
      if (!input.base.getTarget?.() && !options.allowMissingProviderTab) {
        throw new Error(
          "review_required: the exact provider target is not acquired.",
        );
      }
      if (options.route !== false && !routed)
        await routeToBoundConversation(input, state);
      return await operation();
    } finally {
      if (ownsLease) await lease.release();
    }
  };

const createBrowserFacade = (
  input: SingleTabBrowserInput,
  withMutation: MutationRunner,
  routeByDefault: boolean,
): BrowserTargetLease => {
  const browser = {
    ...createInteractiveBrowserFacade(input, withMutation, routeByDefault),
    ...createObservationBrowserFacade(input, withMutation, routeByDefault),
  } as BrowserTargetLease;
  if (input.base.move) {
    browser.move = (value) =>
      withMutation(() => input.base.move!(value), {
        route: routeByDefault,
      });
  }
  return browser;
};

type InteractiveBrowserFacade = Pick<
  BrowserTargetLease,
  | "getHealth"
  | "getLeaseState"
  | "getGeometrySnapshot"
  | "open"
  | "scroll"
  | "click"
  | "clickLocatedDomElement"
  | "fillLocatedDomElement"
  | "textInput"
>;

const createInteractiveBrowserFacade = (
  input: SingleTabBrowserInput,
  withMutation: MutationRunner,
  routeByDefault: boolean,
): InteractiveBrowserFacade => ({
  getHealth: () => input.base.getHealth(),
  getLeaseState: () => input.base.getLeaseState(),
  getGeometrySnapshot: () =>
    withMutation(() => input.base.getGeometrySnapshot(), {
      route: routeByDefault,
    }),
  open: (value) =>
    withMutation(
      () => input.base.open(value),
      { route: false, allowMissingProviderTab: true },
    ),
  scroll: (value) =>
    withMutation(() => input.base.scroll(value), { route: routeByDefault }),
  click: (value) =>
    withMutation(() => input.base.click(value), { route: routeByDefault }),
  clickLocatedDomElement: (value) =>
    withMutation(() => input.base.clickLocatedDomElement(value), {
      route: routeByDefault,
    }),
  fillLocatedDomElement: (value) =>
    withMutation(() => input.base.fillLocatedDomElement!(value), {
      route: routeByDefault,
    }),
  textInput: (value) =>
    withMutation(() => input.base.textInput(value), {
      route: routeByDefault,
    }),
});

type ObservationBrowserFacade = Pick<
  BrowserTargetLease,
  | "screenshotRegion"
  | "evaluate"
  | "setFileInputFiles"
  | "wait"
  | "closeTarget"
  | "close"
>;

const createObservationBrowserFacade = (
  input: SingleTabBrowserInput,
  withMutation: MutationRunner,
  routeByDefault: boolean,
): ObservationBrowserFacade => ({
  screenshotRegion: (value) =>
    withMutation(() => input.base.screenshotRegion(value), {
      route: routeByDefault,
    }),
  evaluate: <T>(value: Parameters<BrowserTargetLease["evaluate"]>[0]) =>
    withMutation(() => input.base.evaluate<T>(value), {
      route: routeByDefault,
    }),
  setFileInputFiles: (value) =>
    withMutation(() => input.base.setFileInputFiles(value), {
      route: routeByDefault,
    }),
  wait: async (durationMs: number): Promise<BrowserActionResult> => {
    await delay(durationMs, input.signal);
    return {
      browserActionId: "single-tab-web-chat-wait",
      ok: true,
      message: `waited ${durationMs}ms without occupying the single browser mutation slot`,
      createdAt: new Date().toISOString(),
    };
  },
  closeTarget: async (): Promise<BrowserActionResult> => ({
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
});

const bindConversationIdentity = (
  state: SingleTabState,
  submission: WebChatSubmissionProof,
): void => {
  if (isRoutableWebChatSubmission(submission)) state.submission = submission;
};

const bindObservedConversation = (
  state: SingleTabState,
  submission: WebChatSubmissionProof,
): void => {
  if (isRoutableWebChatSubmission(submission)) state.submission = submission;
};

const releaseInitialMutationLease = async (
  state: SingleTabState,
): Promise<void> => {
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
  const withSubmissionThenPatrol = createMutationRunner(
    input,
    state,
    "submission_then_patrol",
  );
  const withGlobalSurvival = createMutationRunner(
    input,
    state,
    "global_survival",
  );
  return {
    browser: createBrowserFacade(input, withSubmissionThenPatrol, true),
    globalBrowser: createBrowserFacade(input, withGlobalSurvival, false),
    async runExclusivePatrol<T>(
      operation: (browser: BrowserTargetLease) => Promise<T>,
    ): Promise<T> {
      const lease = await acquireWebChatBrowserPatrolLease({
        dataDir: input.dataDir,
        executionId: input.executionId,
        timeoutMs: input.timeoutMs,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      try {
        if (!input.base.getTarget?.() && state.submission) {
          await routeToBoundConversation(input, state);
        }
        if (!input.base.getTarget?.()) {
          throw new Error(
            "review_required: the exact provider target is not acquired.",
          );
        }
        return await operation(input.base);
      } finally {
        await lease.release();
      }
    },
    bindObservedConversation: (submission) =>
      bindObservedConversation(state, submission),
    bindConversationIdentity: (submission) =>
      bindConversationIdentity(state, submission),
    releaseInitialMutationLease: () => releaseInitialMutationLease(state),
  };
};
