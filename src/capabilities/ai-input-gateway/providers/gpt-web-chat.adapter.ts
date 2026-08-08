import type {
  AiProviderAdapter,
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { runWebChatAdapter } from "./web-chat-shared.js";

export const gptWebChatAdapter: AiProviderAdapter = {
  providerKind: "gpt-web-chat",

  feed(
    input: AiFeedInput,
    context: AiProviderAdapterContext,
  ): Promise<AiProviderRawResponse> {
    return runWebChatAdapter({
      request: input,
      context,
      providerUrl: input.providerForkRef?.providerPageUrl
        ?? input.providerContinuationRef?.providerPageUrl
        ?? "https://chatgpt.com/",
      runtimeName: "gpt-web-chat",
    });
  },
};
