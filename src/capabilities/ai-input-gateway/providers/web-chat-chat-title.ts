import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import { focusBoundWebChatConversation } from "../runtime/web-chat-single-tab-routing.js";
import type { AiProviderAdapterContext, WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import {
  buildConversationLinkTargetScript,
  buildConversationOptionsTargetScript,
  buildInterruptedRenameTextboxTargetScript,
  buildRenameMenuTargetScript,
  buildRenamedIdentityVerificationScript,
  buildRenameTextboxTargetScript,
  buildRenameTextboxValueScript,
} from "./web-chat-chat-title-scripts.js";

type LocatedTarget = {
  status: "success" | "pending" | "review_required";
  message: string;
  pageUrl: string;
  observedTitle?: string | null;
  targetPoint?: { x: number; y: number };
};

type RenameVerification = {
  status: "success" | "pending" | "review_required";
  titleLinkCount: number;
  markerCount: number;
  currentPathMatches: boolean;
  documentTitleMatches: boolean;
};

type TextboxValueVerification = {
  status: "success" | "pending" | "review_required";
  observedValue: string | null;
};

const CHATGPT_RENAME_NOT_READY = "WEB_CHAT_RENAME_NOT_READY";
export const RENAME_PATROL_SLICE_MS = 15_000;
const RENAME_RETRY_DELAY_MS = 500;

const renameNotReady = (message: string): Error =>
  new Error(`${CHATGPT_RENAME_NOT_READY}: ${message}`);

const isRenameNotReady = (error: unknown): boolean =>
  error instanceof Error && error.message.includes(CHATGPT_RENAME_NOT_READY);

export const runBoundedRenamePatrols = async <T>(input: {
  timeoutMs: number;
  now: () => number;
  wait: (durationMs: number) => Promise<void>;
  runExclusivePatrol: (operation: (browser: BrowserTargetSession) => Promise<T>) => Promise<T>;
  runTransaction: (browser: BrowserTargetSession, patrolSliceMs: number) => Promise<T>;
}): Promise<T> => {
  const deadline = input.now() + input.timeoutMs;
  let lastRenameNotReady: Error | null = null;
  while (input.now() < deadline) {
    const patrolSliceMs = Math.min(
      RENAME_PATROL_SLICE_MS,
      Math.max(1, deadline - input.now()),
    );
    try {
      return await input.runExclusivePatrol((browser) =>
        input.runTransaction(browser, patrolSliceMs));
    } catch (error) {
      if (!isRenameNotReady(error)) throw error;
      lastRenameNotReady = error instanceof Error ? error : new Error(String(error));
      const remainingMs = deadline - input.now();
      if (remainingMs <= 0) break;
      await input.wait(Math.min(RENAME_RETRY_DELAY_MS, remainingMs));
    }
  }
  throw renameNotReady(
    `rename recovery deadline exceeded; last=${lastRenameNotReady?.message ?? "none"}`,
  );
};

const remainingRenameMs = (deadline: number, capMs: number): number => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw renameNotReady("atomic rename patrol slice expired");
  }
  return Math.max(1, Math.min(remaining, capMs));
};

const locateTarget = async (input: { browser: BrowserTargetSession; context: AiProviderAdapterContext; description: string; script: string; timeoutMs: number }): Promise<LocatedTarget> => {
  const deadline = Date.now() + input.timeoutMs;
  let last: LocatedTarget | null = null;
  while (Date.now() < deadline) {
    last = await input.browser.evaluate<LocatedTarget>({
      description: input.description,
      script: input.script,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}`);
    }
    if (last.status === "success" && last.targetPoint) {
      return last;
    }
    await input.browser.wait(250);
  }
  throw renameNotReady(
    `${input.description} did not become uniquely clickable; last=${last?.message ?? "none"}`,
  );
};

const locateAndClick = async (input: { browser: BrowserTargetSession; context: AiProviderAdapterContext; description: string; script: string; timeoutMs: number }): Promise<LocatedTarget> => {
  const target = await locateTarget(input);
  const clicked = await input.browser.click({
    targetLabel: input.description,
    point: target.targetPoint!,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!clicked.ok) {
    throw renameNotReady(
      `${input.description} real click did not commit; ${clicked.message}`,
    );
  }
  return target;
};

const applySystemChatTitle = async (input: { browser: BrowserTargetSession; context: AiProviderAdapterContext; canonicalConversationUrl: string; systemChatTitle: string; turnMarker: string; timeoutMs: number }): Promise<string | null> => {
  const deadline = Date.now() + input.timeoutMs;
  const renameMenuScript = buildRenameMenuTargetScript({
    canonicalConversationUrl: input.canonicalConversationUrl,
  });
  const openRenameMenu = await input.browser.evaluate<LocatedTarget>({
    description:
      "detect an interrupted exact-conversation rename menu",
    script: renameMenuScript,
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  if (openRenameMenu.status === "review_required") {
    throw new Error(
      `review_required: ${openRenameMenu.message}`,
    );
  }
  let observedTitle: string | null = null;
  if (openRenameMenu.status !== "success") {
    const conversationLink = await locateTarget({
      browser: input.browser,
      context: input.context,
      description: "locate the submitted ChatGPT conversation title before revealing its options",
      script: buildConversationLinkTargetScript({
        canonicalConversationUrl: input.canonicalConversationUrl,
      }),
      timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
    });
    if (!input.browser.move) {
      throw new Error("review_required: browser cannot hover the submitted ChatGPT conversation title.");
    }
    const moved = await input.browser.move({
      targetLabel: "hover the submitted ChatGPT conversation title",
      point: conversationLink.targetPoint!,
      coordinateSpace: "browserViewport",
    });
    if (!moved.ok) {
      throw new Error(`review_required: submitted ChatGPT conversation hover failed; ${moved.message}`);
    }
    const options = await locateAndClick({
      browser: input.browser,
      context: input.context,
      description: "click the submitted ChatGPT conversation options control",
      script: buildConversationOptionsTargetScript({
        canonicalConversationUrl: input.canonicalConversationUrl,
      }),
      timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
    });
    observedTitle = options.observedTitle?.trim() || null;
  }
  await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "click ChatGPT rename menu item",
    script: renameMenuScript,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  });
  await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "focus ChatGPT chat title textbox",
    script: buildRenameTextboxTargetScript(),
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  });
  await writeExactSystemChatTitle(input);
  return observedTitle;
};

const writeExactSystemChatTitle = async (input: { browser: BrowserTargetSession; context: AiProviderAdapterContext; canonicalConversationUrl: string; systemChatTitle: string; turnMarker: string }): Promise<void> => {
  let last: TextboxValueVerification | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await input.browser.textInput({
      targetLabel: "ChatGPT chat title textbox",
      action: "clear-input",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    await input.browser.textInput({
      targetLabel: "ChatGPT chat title textbox",
      action: "type-text",
      text: input.systemChatTitle,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    await input.browser.wait(250);
    last = await input.browser.evaluate<TextboxValueVerification>({
      description: "verify exact system title text before committing ChatGPT rename",
      script: buildRenameTextboxValueScript(input.systemChatTitle),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (last.status === "review_required") {
      throw new Error("review_required: ChatGPT chat title textbox became ambiguous before rename commit.");
    }
    if (last.status === "success") {
      await input.browser.textInput({
        targetLabel: "ChatGPT chat title textbox",
        action: "press-key",
        key: "Enter",
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      });
      return;
    }
    if (last.observedValue === null) {
      const committed = await input.browser.evaluate<RenameVerification>({
        description: "verify whether ChatGPT committed the exact pasted title before the textbox disappeared",
        script: buildRenamedIdentityVerificationScript(input),
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      });
      if (committed.status === "success") return;
      if (committed.status === "review_required") {
        throw new Error("review_required: ChatGPT committed an ambiguous title identity after paste.");
      }
    }
  }
  throw renameNotReady(
    `exact ChatGPT system title was not present before rename commit; observed=${last?.observedValue ?? "none"}`,
  );
};

const waitForRenamedIdentity = async (input: { browser: BrowserTargetSession; context: AiProviderAdapterContext; canonicalConversationUrl: string; systemChatTitle: string; turnMarker: string; timeoutMs: number }): Promise<RenameVerification> => {
  const deadline = Date.now() + input.timeoutMs;
  let last: RenameVerification = {
    status: "pending",
    titleLinkCount: 0,
    markerCount: 0,
    currentPathMatches: false,
    documentTitleMatches: false,
  };
  while (Date.now() < deadline) {
    last = await input.browser.evaluate<RenameVerification>({
      description: "verify exact system title and marker after ChatGPT rename",
      script: buildRenamedIdentityVerificationScript(input),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (last.status !== "pending") return last;
    await input.browser.wait(250);
  }
  return last;
};

type RenameTransactionInput = {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  canonicalConversationUrl: string;
  systemChatTitle: string;
  turnMarker: string;
  submission: WebChatSubmissionProof;
};

type InterruptedRenameEditorObservation = LocatedTarget & {
  rowConversationUrl?: string;
  markerCount?: number;
  rowTriggerId?: string | null;
  rowTriggerControls?: string | null;
  textboxLabelledBy?: string | null;
  textboxControls?: string | null;
};

export const interruptedRenameEditorIdentityMatches = (input: {
  canonicalConversationUrl: string;
  observation: InterruptedRenameEditorObservation;
}): boolean => {
  try {
    const expectedPath = new URL(input.canonicalConversationUrl).pathname;
    const pagePath = new URL(input.observation.pageUrl).pathname;
    const rowPath = new URL(input.observation.rowConversationUrl ?? "").pathname;
    const labelledByMatches = Boolean(input.observation.rowTriggerId)
      && input.observation.textboxLabelledBy === input.observation.rowTriggerId;
    const controlsMatch = Boolean(input.observation.rowTriggerControls)
      && input.observation.textboxControls === input.observation.rowTriggerControls;
    return pagePath === expectedPath && rowPath === expectedPath
      && input.observation.markerCount === 1 && (labelledByMatches || controlsMatch);
  } catch {
    return false;
  }
};

const recoverOpenTitleEditor = async (
  input: RenameTransactionInput & { timeoutMs: number },
): Promise<boolean> => {
  const deadline = Date.now() + input.timeoutMs;
  const openTitleEditor = await input.browser.evaluate<InterruptedRenameEditorObservation>({
    description: "detect an interrupted ChatGPT title editor before rename recovery",
    script: buildInterruptedRenameTextboxTargetScript({
      canonicalConversationUrl: input.canonicalConversationUrl,
      turnMarker: input.turnMarker,
    }),
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  if (openTitleEditor.status === "review_required") {
    throw new Error(
      "review_required: interrupted ChatGPT title editor is ambiguous.",
    );
  }
  if (openTitleEditor.status !== "success" || !openTitleEditor.targetPoint) {
    return false;
  }
  if (!interruptedRenameEditorIdentityMatches({
    canonicalConversationUrl: input.canonicalConversationUrl,
    observation: openTitleEditor,
  })) {
    throw new Error(
      "review_required: interrupted ChatGPT title editor does not belong to the exact canonical conversation row trigger.",
    );
  }
  const focusedEditor = await input.browser.click({
    targetLabel: "resume interrupted ChatGPT chat title textbox",
    point: openTitleEditor.targetPoint,
    coordinateSpace: "browserViewport",
    button: "left",
    clickCount: 1,
  });
  if (!focusedEditor.ok) {
    throw renameNotReady(
      `interrupted ChatGPT title editor could not be focused; ${focusedEditor.message}`,
    );
  }
  await writeExactSystemChatTitle(input);
  const recoveredRename = await waitForRenamedIdentity({
    ...input,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  });
  if (recoveredRename.status === "success") return true;
  if (recoveredRename.status === "review_required") {
    throw new Error(
      "review_required: interrupted ChatGPT rename resolved to an ambiguous identity.",
    );
  }
  throw renameNotReady(
    "interrupted ChatGPT title editor did not commit the exact durable title",
  );
};

const runRenameTransaction = async (input: {
  renameInput: RenameTransactionInput;
  timeoutMs: number;
}): Promise<string | null> => {
  const deadline = Date.now() + input.timeoutMs;
  await focusBoundWebChatConversation({
    base: input.renameInput.browser,
    providerKind: "gpt-web-chat",
    systemChatTitle: input.renameInput.systemChatTitle,
    submission: input.renameInput.submission,
    turnMarker: input.renameInput.turnMarker,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
    ...(input.renameInput.context.abortSignal
      ? { signal: input.renameInput.context.abortSignal }
      : {}),
  });
  if (await recoverOpenTitleEditor({
    ...input.renameInput,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  })) return null;
  const alreadyRenamed = await waitForRenamedIdentity({
    ...input.renameInput,
    timeoutMs: remainingRenameMs(deadline, 500),
  });
  if (alreadyRenamed.status === "success") return null;
  if (alreadyRenamed.status === "review_required") {
    throw new Error(
      `review_required: pre-rename ChatGPT identity is ambiguous; titleLinks=${String(alreadyRenamed.titleLinkCount)}; markers=${String(alreadyRenamed.markerCount)}`,
    );
  }
  const observedTitle = await applySystemChatTitle({
    ...input.renameInput,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  });
  const verified = await waitForRenamedIdentity({
    ...input.renameInput,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  });
  if (verified.status === "review_required") {
    throw new Error(
      `review_required: manually renamed ChatGPT identity is ambiguous; titleLinks=${String(verified.titleLinkCount)}; markers=${String(verified.markerCount)}`,
    );
  }
  if (verified.status !== "success") {
    throw renameNotReady(
      `rename commit is not visible yet; titleLinks=${String(verified.titleLinkCount)}; markers=${String(verified.markerCount)}`,
    );
  }
  return observedTitle;
};

export const renameSubmittedChatGptConversation = async (input: { browser: BrowserTargetSession; context: AiProviderAdapterContext; submission: WebChatSubmissionProof; timeoutMs: number }): Promise<WebChatSubmissionProof> => {
  const execution = input.context.webChatExecution;
  if (!execution || execution.providerKind !== "gpt-web-chat") return input.submission;
  if (!execution.systemChatTitle || !input.submission.canonicalConversationUrl) {
    throw new Error("review_required: ChatGPT submission is missing the durable name or canonical conversation URL.");
  }
  const observedAutoChatTitle = await runBoundedRenamePatrols<string | null>({
    timeoutMs: input.timeoutMs,
    now: Date.now,
    wait: async (durationMs) => {
      await input.browser.wait(durationMs);
    },
    runExclusivePatrol: execution.runExclusivePatrol,
    runTransaction: async (browser, patrolSliceMs) => {
        const renameInput = {
          browser,
          context: input.context,
          canonicalConversationUrl: input.submission.canonicalConversationUrl!,
          systemChatTitle: execution.systemChatTitle!,
          turnMarker: execution.turnMarker,
          submission: input.submission,
        };
        const observedTitle = await runRenameTransaction({
          renameInput,
          timeoutMs: patrolSliceMs,
        });
        return observedTitle;
      },
  });
  return {
    ...input.submission,
    systemChatTitle: execution.systemChatTitle,
    observedAutoChatTitle,
    chatTitleVerifiedAt: new Date().toISOString(),
  };
};
