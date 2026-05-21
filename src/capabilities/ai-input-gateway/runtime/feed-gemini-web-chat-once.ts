import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapter } from "../contracts/ai-provider-adapter.contract.js";
import { geminiWebChatAdapter } from "../providers/gemini-web-chat.adapter.js";
import type {
  AiFeedInput,
  AiFeedResult,
} from "../schema.js";
import { executeAiFeedOnce } from "./feed-provider-once.js";

export const feedGeminiWebChatOnce = async (input: {
  request: AiFeedInput;
  dataDir: string;
  browser?: BrowserController;
  adapter?: AiProviderAdapter;
  signal?: AbortSignal;
}): Promise<AiFeedResult> => {
  return executeAiFeedOnce({
    request: input.request,
    dataDir: input.dataDir,
    adapter: input.adapter ?? geminiWebChatAdapter,
    childCapabilityId: "feed-gemini-web-chat-once",
    transport: "web-chat",
    ...(input.browser ? { browser: input.browser } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
};
