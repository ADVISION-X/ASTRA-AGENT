import type {
  BrowserActionResult,
  BrowserController,
} from "../../../lib/browser/browser-controller.js";
import type { WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import {
  acquireWebChatBrowserPatrolLease,
  acquireWebChatBrowserMutationLease,
  type WebChatRuntimeLease,
} from "./web-chat-concurrency-lease.js";
import { focusSingleProviderTab } from "./web-chat-single-provider-tab.js";
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
      reject(
        new Error("browser wait aborted during single-tab web-chat polling."),
      );
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });

export type SingleTabWebChatBrowser = {
  browser: BrowserController;
  globalBrowser: BrowserController;
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
            timeoutMs: input.timeoutMs,
            ...(input.signal ? { signal: input.signal } : {}),
          }));
    const ownsLease = lease !== initialLease;
    try {
      const providerTab = await focusSingleProviderTab({
        providerKind: input.providerKind,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      if (providerTab === "ambiguous") {
        throw new Error(
          "review_required: more than one physical provider tab is open.",
        );
      }
      if (providerTab === "not_found" && !options.allowMissingProviderTab) {
        throw new Error(
          "review_required: the single controlled provider tab is not open.",
        );
      }
      if (options.route !== false) await routeToBoundConversation(input, state);
      return await operation();
    } finally {
      if (ownsLease) await lease.release();
    }
  };

const createBrowserFacade = (
  input: SingleTabBrowserInput,
  withMutation: MutationRunner,
  routeByDefault: boolean,
): BrowserController => {
  const browser = {
    ...createInteractiveBrowserFacade(input, withMutation, routeByDefault),
    ...createObservationBrowserFacade(input, withMutation, routeByDefault),
  } as BrowserController;
  if (input.base.move) {
    browser.move = (value) =>
      withMutation(() => input.base.move!(value), {
        route: routeByDefault,
      });
  }
  if (input.base.selectFilesInNativePicker) {
    browser.selectFilesInNativePicker = (value) =>
      withMutation(() => input.base.selectFilesInNativePicker!(value), {
        route: routeByDefault,
      });
  }
  return browser;
};

type InteractiveBrowserFacade = Pick<
  BrowserController,
  | "getHealth"
  | "getSessionState"
  | "getGeometrySnapshot"
  | "open"
  | "scroll"
  | "click"
  | "clickLocatedDomElement"
  | "textInput"
>;

const createInteractiveBrowserFacade = (
  input: SingleTabBrowserInput,
  withMutation: MutationRunner,
  routeByDefault: boolean,
): InteractiveBrowserFacade => ({
    getHealth: () => input.base.getHealth(),
    getSessionState: () => input.base.getSessionState(),
    getGeometrySnapshot: () =>
      withMutation(() => input.base.getGeometrySnapshot(), {
        route: routeByDefault,
      }),
    open: (value) =>
      withMutation(
        () => input.base.open({ ...value, reusePolicy: "reuse-host-tab" }),
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
    textInput: (value) =>
      withMutation(() => input.base.textInput(value), {
        route: routeByDefault,
      }),
});

type ObservationBrowserFacade = Pick<
  BrowserController,
  | "screenshotRegion"
  | "evaluateActiveTab"
  | "setFileInputFiles"
  | "wait"
  | "closeActiveTab"
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
    evaluateActiveTab: <T>(
      value: Parameters<BrowserController["evaluateActiveTab"]>[0],
    ) =>
      withMutation(() => input.base.evaluateActiveTab<T>(value), {
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
});

const bindConversationIdentity = (
  state: SingleTabState,
  submission: WebChatSubmissionProof,
): void => {
  state.submission = submission;
};

const bindObservedConversation = (
  state: SingleTabState,
  submission: WebChatSubmissionProof,
): void => {
  state.submission = submission;
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
    submission: input.resumeSubmission,
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
    bindObservedConversation: (submission) =>
      bindObservedConversation(state, submission),
    bindConversationIdentity: (submission) =>
      bindConversationIdentity(state, submission),
    releaseInitialMutationLease: () => releaseInitialMutationLease(state),
  };
};
