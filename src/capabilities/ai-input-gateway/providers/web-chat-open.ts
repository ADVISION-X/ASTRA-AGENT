import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";
import {
  focusExistingWorkspaceTab,
  readSavedWorkspaceUrl,
  resolveWebChatWorkspaceId,
} from "./web-chat-workspace.js";

const PROVIDER_COMPOSER_READY_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const composer = resolveComposerInput();
return {status: composer ? "success" : "pending", message: composer ? "provider composer ready" : "provider composer pending", pageUrl: location.href};
`;

const waitForProviderComposer = async (
  browser: BrowserController,
): Promise<void> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = await browser.evaluateActiveTab<WebChatEvaluation>({
      description: "wait for provider web chat composer",
      script: PROVIDER_COMPOSER_READY_SCRIPT,
    });
    if (state.status === "success") return;
    if (state.status === "review_required" || state.status === "failed") {
      throw new Error(`${state.status}: ${state.message}`);
    }
    await browser.wait(300);
  }
  throw new Error("review_required: provider composer did not become ready.");
};

export const openProviderPage = async (input: {
  browser: BrowserController;
  providerUrl: string;
  runtimeName: string;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
}): Promise<void> => {
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  const savedUrl = workspaceId
    ? readSavedWorkspaceUrl({
        dataDir: input.context.dataDir,
        providerKind: input.request.providerKind,
        workspaceId,
      })
    : null;
  const focusedExisting = workspaceId
    ? await focusExistingWorkspaceTab({
        providerHost: new URL(input.providerUrl).host,
        workspaceId,
        savedUrl,
        allowAnyProviderTab: savedUrl === null,
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      })
    : false;
  const opened = focusedExisting
    ? { ok: true, message: "focused existing provider workspace tab" }
    : await input.browser.open({
        url: savedUrl ?? input.providerUrl,
        title: `${input.runtimeName}${workspaceId ? `:${workspaceId}` : ""}`,
      });
  if (!opened.ok) {
    throw new Error(`Web chat provider page could not be opened: ${opened.message}`);
  }
  await waitForProviderComposer(input.browser);
};

