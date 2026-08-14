import type {
  BrowserTargetSession,
} from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type {
  WebChatEvaluation,
} from "./web-chat-evaluation-contract.js";
import {
  CHATGPT_FRESH_CONVERSATION_SCRIPT,
} from "./web-chat-fresh-conversation-script.js";

const CHATGPT_NEW_CHAT_SCRIPT = `
const visible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const candidates = Array.from(document.querySelectorAll('a,button,[role="link"],[role="button"]'))
  .filter(visible)
  .map((element) => ({
    element,
    visibleText: (element instanceof HTMLElement ? element.innerText : element.textContent || "")
      .replace(/\\s+/gu, " ")
      .trim(),
    ariaLabel: (element.getAttribute("aria-label") || "")
      .replace(/\\s+/gu, " ")
      .trim(),
    testId: element.getAttribute("data-testid"),
    label: [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
      .filter(Boolean)
      .join(" ")
      .replace(/\\s+/gu, " ")
      .trim(),
  }))
  .filter(({label}) => /(?:^|\\s)(?:新聊天|new chat)(?:\\s|$)/iu.test(label));
const exactTextCandidates = candidates.filter(({visibleText, testId}) =>
  testId === "create-new-chat-button"
  && /^(?:新聊天|new chat)$/iu.test(visibleText)
);
const exactAriaCandidates = candidates.filter(({ariaLabel}) =>
  /^(?:新聊天|new chat)$/iu.test(ariaLabel)
);
const selected = exactTextCandidates.length === 1
  ? exactTextCandidates
  : exactAriaCandidates.length === 1
    ? exactAriaCandidates
    : candidates;
if (selected.length !== 1) {
  return {
    status: "review_required",
    message: selected.length === 0
      ? "ChatGPT new chat control was not found"
      : "CHATGPT_NEW_CHAT_CONTROL_AMBIGUOUS",
    pageUrl: location.href,
    candidateCount: candidates.length,
    candidateLabels: candidates.map(({label}) => label),
  };
}
selected[0].element.click();
return {
  status: "success",
  message: "clicked unique visible ChatGPT new chat control",
  pageUrl: location.href,
};
`;

interface FreshConversationInput {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
  required: boolean;
  waitForProviderComposer: () => Promise<void>;
  isRecoverableComposerTimeout: (error: unknown) => boolean;
  emitStage: (input: {
    stage: string;
    status: string;
    startedAtMs: number | null;
    refs?: Record<string, unknown>;
  }) => void;
}

const isTransientProviderEvaluationTimeout = (error: unknown): boolean =>
  error instanceof Error
  && /COMMAND_TIMEOUT|browser command .*exceeded/iu.test(error.message);

const waitForFreshChatGptConversation = async (
  input: FreshConversationInput,
): Promise<void> => {
  const startedAtMs = Date.now();
  const deadline = Date.now() + 30_000;
  let lastMessage = "ChatGPT fresh conversation was not checked";
  input.emitStage({
    stage: "fresh_chatgpt_conversation",
    status: "start",
    startedAtMs: null,
    refs: { timeoutMs: 30_000 },
  });
  while (Date.now() < deadline) {
    if (input.context.abortSignal?.aborted) {
      throw new Error(
        "review_required: ChatGPT fresh conversation wait aborted.",
      );
    }
    try {
      const state = await input.browser.evaluate<WebChatEvaluation>({
        description: "verify isolated ChatGPT fresh conversation",
        script: CHATGPT_FRESH_CONVERSATION_SCRIPT,
        ...(input.context.abortSignal
          ? { abortSignal: input.context.abortSignal }
          : {}),
      });
      lastMessage =
        `${state.status}: ${state.message}; `
        + `pageUrl=${state.pageUrl ?? "unknown"}`;
      if (state.status === "success") {
        input.emitStage({
          stage: "fresh_chatgpt_conversation",
          status: "success",
          startedAtMs,
        });
        return;
      }
      if (state.status === "review_required" || state.status === "failed") {
        throw new Error(`${state.status}: ${state.message}`);
      }
    } catch (error) {
      if (!isTransientProviderEvaluationTimeout(error)) throw error;
      lastMessage = error instanceof Error ? error.message : String(error);
    }
    await input.browser.wait(300);
  }
  input.emitStage({
    stage: "fresh_chatgpt_conversation",
    status: "failed",
    startedAtMs,
    refs: { reason: lastMessage },
  });
  throw new Error(
    `review_required: ChatGPT fresh conversation was not established; `
    + `last=${lastMessage}`,
  );
};

const alreadyOnFreshChatGptConversation = async (
  input: FreshConversationInput,
): Promise<boolean> => {
  const state = await input.browser.evaluate<WebChatEvaluation>({
    description:
      "check whether ChatGPT is already on a clean unsubmitted root conversation",
    script: CHATGPT_FRESH_CONVERSATION_SCRIPT,
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  if (state.status === "review_required" || state.status === "failed") {
    throw new Error(`${state.status}: ${state.message}`);
  }
  return state.status === "success";
};

const clickChatGptNewConversation = async (
  input: FreshConversationInput,
): Promise<void> => {
  const deadline = Date.now() + 30_000;
  let lastState: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    let state: WebChatEvaluation;
    try {
      state = await input.browser.evaluate<WebChatEvaluation>({
        description: "click ChatGPT new chat before isolated GPT prompt",
        script: CHATGPT_NEW_CHAT_SCRIPT,
        ...(input.context.abortSignal
          ? { abortSignal: input.context.abortSignal }
          : {}),
      });
    } catch (error) {
      if (!isTransientProviderEvaluationTimeout(error)) throw error;
      await input.browser.wait(500);
      continue;
    }
    lastState = state;
    if (state.status === "success") break;
    if (
      state.status !== "review_required"
      || !state.message.includes("not found")
    ) {
      throw new Error(`${state.status}: ${state.message}`);
    }
    await input.browser.wait(300);
  }
  if (lastState?.status !== "success") {
    throw new Error(
      `${lastState?.status ?? "review_required"}: `
      + `${lastState?.message ?? "ChatGPT new chat control was not found"}`,
    );
  }
};

const recoverChatGptComposer = async (
  input: FreshConversationInput,
): Promise<void> => {
  const reopened = await input.browser.open({
    url: input.providerUrl,
    title: "recover-provider-composer",
    reusePolicy: "reuse-exact-url",
  });
  if (!reopened.ok) {
    throw new Error(
      `Web chat provider page could not be opened: ${reopened.message}`,
    );
  }
  await waitForFreshChatGptConversation(input);
  await input.waitForProviderComposer();
};

export const startFreshChatGptConversation = async (
  input: FreshConversationInput,
): Promise<void> => {
  if (!input.required) return;
  if (!await alreadyOnFreshChatGptConversation(input)) {
    await clickChatGptNewConversation(input);
  }
  await waitForFreshChatGptConversation(input);
  try {
    await input.waitForProviderComposer();
  } catch (error) {
    if (!input.isRecoverableComposerTimeout(error)) throw error;
    await recoverChatGptComposer(input);
  }
};
