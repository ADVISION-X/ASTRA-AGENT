import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";

type DiscoveryInput = Readonly<{
  browser: BrowserTargetLease;
  context?: AiProviderAdapterContext;
  canonicalConversationUrl: string;
  turnMarker: string;
}>;

/**
 * ChatGPT's Search chats dialog has not yet been observed through the approved
 * single-tab Browser authority. There is deliberately no selector guess,
 * generic page evaluation, or alternate navigation path here. Canonical
 * sidebar routing remains the only production-evidenced recovery route.
 */
export const discoverChatGptConversationViaSearch = async (
  input: DiscoveryInput,
): Promise<void> => {
  void input.browser;
  void input.context;
  void input.canonicalConversationUrl;
  void input.turnMarker;
  throw new Error(
    "review_required: NOT_PRODUCTION_VERIFIED: ChatGPT Search chats dialog recovery has no approved live DOM evidence",
  );
};
