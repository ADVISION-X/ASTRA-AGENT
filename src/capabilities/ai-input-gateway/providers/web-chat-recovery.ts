import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  isAmazonProductMiningGptRequest,
  openProviderPage,
} from "./web-chat-open.js";
import {
  assertActiveProviderPage,
  restoreSourcePage,
} from "./web-chat-shared-support.js";
import {
  resolveWebChatWorkspaceId,
  saveWorkspaceUrl,
} from "./web-chat-workspace.js";

type RecoveryInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
};

const saveRecoveryWorkspace = (input: RecoveryInput): void => {
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (!workspaceId) return;
  saveWorkspaceUrl({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    url: input.providerUrl,
  });
};

const reopenRecoveryProvider = async (input: RecoveryInput): Promise<void> => {
  await openProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    runtimeName: input.runtimeName,
    context: input.context,
    request: input.request,
  });
};

export const recoverPick3NoResultConversation = async (
  input: RecoveryInput,
): Promise<string> => {
  const timedOutUrl = input.browser.getSessionState().currentUrl;
  if (input.request.providerKind === "gemini-web-chat") {
    saveRecoveryWorkspace(input);
    await reopenRecoveryProvider(input);
    return "pick3_no_result_recovery_reopened_gemini_new_chat";
  }
  if (!timedOutUrl.startsWith("https://chatgpt.com/c/")) {
    return `pick3_no_result_recovery_skipped_non_conversation_url:${timedOutUrl}`;
  }
  await input.browser.open({
    url: timedOutUrl,
    title: "Refresh timed-out Pick3 ChatGPT conversation",
    reusePolicy: "reuse-active-tab",
  });
  await input.browser.wait(1_800);
  saveRecoveryWorkspace(input);
  await reopenRecoveryProvider(input);
  return "pick3_no_result_recovery_refreshed_without_history_delete_and_reopened_new_chat";
};

export const recoverPick3MissingBoundImageConversation = async (
  input: RecoveryInput,
): Promise<string> => {
  await recoverPick3NoResultConversation(input);
  return "pick3_missing_bound_image_recovery_without_history_delete_and_reopened_new_chat";
};

const appendWarning = (
  response: AiProviderRawResponse,
  warning: string,
): void => {
  response.transportWarnings = [...(response.transportWarnings ?? []), warning];
};

const closeProviderTabAfterResponse = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  providerUrl: string;
  response: AiProviderRawResponse;
}): Promise<void> => {
  try {
    await assertActiveProviderPage({
      browser: input.browser,
      providerUrl: input.providerUrl,
      phase: "provider tab close",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    const closeResult = await input.browser.closeActiveTab({
      reason: "AI provider answer captured",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (!closeResult.ok) appendWarning(input.response, `PROVIDER_TAB_CLOSE_FAILED:${closeResult.message}`);
  } catch (error) {
    appendWarning(
      input.response,
      `PROVIDER_TAB_CLOSE_FAILED:${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const restoreSourceAfterResponse = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  sourcePageUrlBeforeFeed: string | null;
  response: AiProviderRawResponse;
}): Promise<void> => {
  try {
    const restored = await restoreSourcePage(
      input.browser,
      input.sourcePageUrlBeforeFeed,
      input.context.abortSignal,
    );
    input.response.restoredSourcePage = restored;
    if (restored === false) appendWarning(input.response, "SOURCE_PAGE_RESTORE_FAILED");
  } catch (error) {
    input.response.restoredSourcePage = false;
    appendWarning(
      input.response,
      `SOURCE_PAGE_RESTORE_FAILED:${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const restoreAfterWebChatFeed = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  providerUrl: string;
  request: AiFeedInput;
  sourcePageUrlBeforeFeed: string | null;
  response: AiProviderRawResponse | null;
}): Promise<void> => {
  if (!input.response) return;
  if (isAmazonProductMiningGptRequest(input)) {
    await closeProviderTabAfterResponse({ ...input, response: input.response });
  }
  await restoreSourceAfterResponse({ ...input, response: input.response });
};
