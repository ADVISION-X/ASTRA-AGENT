import type {
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type {
  WebChatEvaluation,
} from "./web-chat-evaluation-contract.js";
import {
  clearProvenSubmittedRootDraft,
} from "./web-chat-upload-page-actions.js";
import {
  CHATGPT_FRESH_CONVERSATION_SCRIPT,
} from "./web-chat-fresh-conversation-script.js";
import {
  resolveSubmittedDraftOwnerByTurnMarker,
} from "../runtime/web-chat-canonical-binding.js";

const CHATGPT_NEW_CHAT_SCRIPT = `
const visible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalize = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const providerRoot = new URL("/", location.href);
const renderedCandidates = Array.from(document.querySelectorAll('a[data-testid="create-new-chat-button"][data-sidebar-item="true"]'))
  .filter(visible)
  .map((element) => ({
    element,
    visibleText: normalize(element instanceof HTMLElement ? element.innerText : element.textContent),
    href: element instanceof HTMLAnchorElement ? new URL(element.href, location.href) : null,
    pointerEvents: getComputedStyle(element).pointerEvents,
    rect: element.getBoundingClientRect(),
  }));
const actionableCandidates = renderedCandidates.filter(({element, visibleText, href, pointerEvents, rect}) => {
  if (
    !/^(?:新聊天|new chat)$/iu.test(visibleText)
    || !href
    || href.origin !== providerRoot.origin
    || href.pathname !== providerRoot.pathname
    || href.search !== ""
    || href.hash !== ""
    || pointerEvents === "none"
  ) return false;
  const hit = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
  const hitAnchor = hit instanceof Element
    ? hit.closest('a[data-testid="create-new-chat-button"][data-sidebar-item="true"]')
    : null;
  return hitAnchor === element;
});
const selected = actionableCandidates;
if (selected.length !== 1) {
  return {
    status: "review_required",
    message: selected.length === 0
      ? "ChatGPT new chat control was not found"
      : "CHATGPT_NEW_CHAT_CONTROL_AMBIGUOUS",
    pageUrl: location.href,
    candidateCount: selected.length,
    renderedCandidateCount: renderedCandidates.length,
    candidateLabels: renderedCandidates.map(({visibleText, pointerEvents}) =>
      [visibleText, pointerEvents].join(":")),
  };
}
selected[0].element.click();
return {
  status: "success",
  message: "clicked unique actionable ChatGPT sidebar new chat control",
  pageUrl: location.href,
};
`;

interface FreshConversationInput {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
  required: boolean;
  waitForProviderComposer: () => Promise<void>;
  isRecoverableComposerTimeout: (error: unknown) => boolean;
  emitStage: (input: {
    stage: string;
    status: "start" | "success" | "failed";
    startedAtMs: number | null;
    refs?: Record<string, string | number | boolean | null | undefined>;
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
    await input.browser.wait(1_000);
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

const readFreshChatGptConversation = (
  input: FreshConversationInput,
): Promise<WebChatEvaluation> => input.browser.evaluate<WebChatEvaluation>({
  description: "inspect ChatGPT clean root and protected draft boundary",
  script: CHATGPT_FRESH_CONVERSATION_SCRIPT,
  ...(input.context.abortSignal
    ? { abortSignal: input.context.abortSignal }
    : {}),
});

const clearUniquelyOwnedSubmittedRootDraft = async (
  input: FreshConversationInput,
): Promise<boolean> => {
  const state = await readFreshChatGptConversation(input);
  if (state.eligibleSubmittedDraftCleanup !== true) return false;
  const marker = state.composerTurnMarkers?.length === 1
    ? state.composerTurnMarkers[0]
    : null;
  if (!marker) return false;
  const owner = await resolveSubmittedDraftOwnerByTurnMarker({
    dataDir: input.context.dataDir,
    providerKind: "gpt-web-chat",
    turnMarker: marker,
  });
  if (
    owner.matchCount !== 1
    || !owner.owner
    || owner.owner.executionId === input.context.webChatExecution?.executionId
  ) return false;
  const startedAtMs = Date.now();
  input.emitStage({
    stage: "clear_uniquely_owned_submitted_root_draft",
    status: "start",
    startedAtMs: null,
    refs: {
      ownerExecutionId: owner.owner.executionId,
      canonicalConversationUrl: owner.owner.canonicalConversationUrl,
    },
  });
  const cleared = await clearProvenSubmittedRootDraft(
    input.browser,
    input.context,
    marker,
  );
  if (cleared.status !== "success") {
    throw new Error(`${cleared.status}: ${cleared.message}`);
  }
  await input.browser.wait(1_000);
  const proven = await readFreshChatGptConversation(input);
  if (proven.status !== "success") {
    throw new Error(
      `review_required: submitted root draft clear did not establish a clean root; last=${proven.status}: ${proven.message}`,
    );
  }
  input.emitStage({
    stage: "clear_uniquely_owned_submitted_root_draft",
    status: "success",
    startedAtMs,
    refs: { ownerExecutionId: owner.owner.executionId },
  });
  return true;
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
    await input.browser.wait(1_000);
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
    reusePolicy: "bind-existing-exact-origin",
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
    const initial = await readFreshChatGptConversation(input);
    const cleared = await clearUniquelyOwnedSubmittedRootDraft(input);
    if (!cleared) {
      if (
        initial.isFreshPath === true
        && initial.userCount === 0
        && initial.assistantCount === 0
        && (initial.composerTextLength ?? 0) > 0
      ) {
        throw new Error(
          "review_required: ChatGPT root composer contains a protected unknown or unproven draft.",
        );
      }
      await clickChatGptNewConversation(input);
      await clearUniquelyOwnedSubmittedRootDraft(input);
    }
  }
  await waitForFreshChatGptConversation(input);
  try {
    await input.waitForProviderComposer();
  } catch (error) {
    if (!input.isRecoverableComposerTimeout(error)) throw error;
    await recoverChatGptComposer(input);
  }
};
