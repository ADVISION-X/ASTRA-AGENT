import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
export const restoreAfterWebChatFeed = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  providerUrl: string;
  request: AiFeedInput;
  sourcePageUrlBeforeFeed: string | null;
  response: AiProviderRawResponse | null;
}): Promise<void> => {
  if (!input.response) return;
  input.response.restoredSourcePage = false;
};
