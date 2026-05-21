import type {
  AiProviderAdapter,
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { runWebChatAdapter } from "./web-chat-shared.js";

export const geminiWebChatAdapter: AiProviderAdapter = {
  providerKind: "gemini-web-chat",

  feed(
    input: AiFeedInput,
    context: AiProviderAdapterContext,
  ): Promise<AiProviderRawResponse> {
    return runWebChatAdapter({
      request: input,
      context,
      providerUrl: "https://gemini.google.com/app",
      runtimeName: "gemini-web-chat",
    });
  },
};
