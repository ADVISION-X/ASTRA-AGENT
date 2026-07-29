import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext, WebChatSubmissionProof } from "../contracts/ai-provider-adapter.contract.js";
import { copyTextToMacClipboard, pasteMacClipboardIntoChrome } from "./web-chat-clipboard.js";
import {
  buildConversationLinkTargetScript,
  buildConversationOptionsTargetScript,
  buildFocusedSubmittedConversationScript,
  buildRenamedIdentityVerificationScript,
  buildRenameTextboxTargetScript,
  buildRenameTextboxValueScript,
  RENAME_MENU_TARGET_SCRIPT,
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
const RENAME_PATROL_SLICE_MS = 4_000;
const RENAME_RETRY_DELAY_MS = 500;

const renameNotReady = (message: string): Error =>
  new Error(`${CHATGPT_RENAME_NOT_READY}: ${message}`);

const isRenameNotReady = (error: unknown): boolean =>
  error instanceof Error && error.message.includes(CHATGPT_RENAME_NOT_READY);

const remainingRenameMs = (deadline: number, capMs: number): number => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw renameNotReady("atomic rename patrol slice expired");
  }
  return Math.max(1, Math.min(remaining, capMs));
};

const locateTarget = async (input: { browser: BrowserController; context: AiProviderAdapterContext; description: string; script: string; timeoutMs: number }): Promise<LocatedTarget> => {
  const deadline = Date.now() + input.timeoutMs;
  let last: LocatedTarget | null = null;
  while (Date.now() < deadline) {
    last = await input.browser.evaluateActiveTab<LocatedTarget>({
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

const locateAndClick = async (input: { browser: BrowserController; context: AiProviderAdapterContext; description: string; script: string; timeoutMs: number }): Promise<LocatedTarget> => {
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

const focusSubmittedConversation = async (input: { browser: BrowserController; context: AiProviderAdapterContext; canonicalConversationUrl: string; turnMarker: string; timeoutMs: number }): Promise<void> => {
  const deadline = Date.now() + input.timeoutMs;
  await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "open the just-submitted ChatGPT conversation before renaming",
    script: buildConversationLinkTargetScript({
      canonicalConversationUrl: input.canonicalConversationUrl,
    }),
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  });
  while (Date.now() < deadline) {
    const observation = await input.browser.evaluateActiveTab<{
      status: "success" | "pending" | "review_required";
      pageUrl: string;
      markerCount: number;
    }>({
      description: "verify the just-submitted ChatGPT conversation is current before renaming",
      script: buildFocusedSubmittedConversationScript({
        canonicalConversationUrl: input.canonicalConversationUrl,
        turnMarker: input.turnMarker,
      }),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (observation.status === "success") return;
    if (observation.status === "review_required") {
      throw new Error(`review_required: submitted ChatGPT conversation marker is ambiguous before rename; count=${observation.markerCount}`);
    }
    await input.browser.wait(250);
  }
  throw renameNotReady(
    "just-submitted ChatGPT conversation did not become current before rename",
  );
};

const applySystemChatTitle = async (input: { browser: BrowserController; context: AiProviderAdapterContext; canonicalConversationUrl: string; systemChatTitle: string; turnMarker: string; timeoutMs: number }): Promise<string | null> => {
  const deadline = Date.now() + input.timeoutMs;
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
  await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "click ChatGPT rename menu item",
    script: RENAME_MENU_TARGET_SCRIPT,
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
  return options.observedTitle?.trim() || null;
};

const writeExactSystemChatTitle = async (input: { browser: BrowserController; context: AiProviderAdapterContext; canonicalConversationUrl: string; systemChatTitle: string; turnMarker: string }): Promise<void> => {
  let last: TextboxValueVerification | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await input.browser.textInput({
      targetLabel: "ChatGPT chat title textbox",
      action: "clear-input",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    await copyTextToMacClipboard(input.systemChatTitle, input.context.abortSignal);
    await pasteMacClipboardIntoChrome(input.context.abortSignal);
    await input.browser.wait(250);
    last = await input.browser.evaluateActiveTab<TextboxValueVerification>({
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
      const committed = await input.browser.evaluateActiveTab<RenameVerification>({
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

const waitForRenamedIdentity = async (input: { browser: BrowserController; context: AiProviderAdapterContext; canonicalConversationUrl: string; systemChatTitle: string; turnMarker: string; timeoutMs: number }): Promise<RenameVerification> => {
  const deadline = Date.now() + input.timeoutMs;
  let last: RenameVerification = {
    status: "pending",
    titleLinkCount: 0,
    markerCount: 0,
    currentPathMatches: false,
    documentTitleMatches: false,
  };
  while (Date.now() < deadline) {
    last = await input.browser.evaluateActiveTab<RenameVerification>({
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
  browser: BrowserController;
  context: AiProviderAdapterContext;
  canonicalConversationUrl: string;
  systemChatTitle: string;
  turnMarker: string;
};

const recoverOpenTitleEditor = async (
  input: RenameTransactionInput & { timeoutMs: number },
): Promise<boolean> => {
  const deadline = Date.now() + input.timeoutMs;
  const openTitleEditor = await input.browser.evaluateActiveTab<LocatedTarget>({
    description: "detect an interrupted ChatGPT title editor before rename recovery",
    script: buildRenameTextboxTargetScript(),
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
  if (await recoverOpenTitleEditor({
    ...input.renameInput,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  })) return null;
  await focusSubmittedConversation({
    ...input.renameInput,
    timeoutMs: remainingRenameMs(deadline, input.timeoutMs),
  });
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

export const renameSubmittedChatGptConversation = async (input: { browser: BrowserController; context: AiProviderAdapterContext; submission: WebChatSubmissionProof; timeoutMs: number }): Promise<WebChatSubmissionProof> => {
  const execution = input.context.webChatExecution;
  if (!execution || execution.providerKind !== "gpt-web-chat") return input.submission;
  if (!execution.systemChatTitle || !input.submission.canonicalConversationUrl) {
    throw new Error("review_required: ChatGPT submission is missing the durable name or canonical conversation URL.");
  }
  let observedAutoChatTitle: string | null = null;
  const deadline = Date.now() + input.timeoutMs;
  let lastRenameNotReady: Error | null = null;
  while (Date.now() < deadline) {
    try {
      const patrolSliceMs = Math.min(
        RENAME_PATROL_SLICE_MS,
        Math.max(1, deadline - Date.now()),
      );
      const renamed = await execution.runExclusivePatrol(async (browser) => {
        const renameInput = {
          browser,
          context: input.context,
          canonicalConversationUrl: input.submission.canonicalConversationUrl!,
          systemChatTitle: execution.systemChatTitle!,
          turnMarker: execution.turnMarker,
        };
        const observedTitle = await runRenameTransaction({
          renameInput,
          timeoutMs: patrolSliceMs,
        });
        observedAutoChatTitle ??= observedTitle;
        return true;
      });
      if (!renamed) {
        throw renameNotReady("exclusive rename patrol returned without proof");
      }
      return {
        ...input.submission,
        systemChatTitle: execution.systemChatTitle,
        observedAutoChatTitle,
        chatTitleVerifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (!isRenameNotReady(error)) throw error;
      lastRenameNotReady = error instanceof Error
        ? error
        : new Error(String(error));
      await input.browser.wait(
        Math.min(RENAME_RETRY_DELAY_MS, Math.max(1, deadline - Date.now())),
      );
    }
  }
  throw renameNotReady(
    `rename recovery deadline exceeded; last=${lastRenameNotReady?.message ?? "none"}`,
  );
};
