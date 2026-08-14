import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type { AiProviderAdapter } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatAttachmentUploadProof } from "../contracts/ai-provider-adapter.contract.js";
import type { AiInputGatewayProgress } from "../contract.js";
import { gptWebChatAdapter } from "../providers/gpt-web-chat.adapter.js";
import type {
  AiFeedInput,
  AiFeedResult,
} from "../schema.js";
import { executeAiFeedOnce } from "./feed-provider-once.js";

export const feedGptWebChatOnce = async (input: {
  request: AiFeedInput;
  dataDir: string;
  browser?: BrowserTargetSession;
  runtimeLogger?: RuntimeLogger;
  adapter?: AiProviderAdapter;
  signal?: AbortSignal;
  executionId?: string;
  supersededExecutionId?: string;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  onProgress?: (progress: AiInputGatewayProgress) => Promise<void>;
}): Promise<AiFeedResult> => {
  return executeAiFeedOnce({
    request: input.request,
    dataDir: input.dataDir,
    adapter: input.adapter ?? gptWebChatAdapter,
    childCapabilityId: "feed-gpt-web-chat-once",
    transport: "web-chat",
    ...(input.browser ? { browser: input.browser } : {}),
    ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.executionId ? { executionId: input.executionId } : {}),
    ...(input.supersededExecutionId
      ? { supersededExecutionId: input.supersededExecutionId }
      : {}),
    ...(input.onAttachmentUploadCompleted
      ? { onAttachmentUploadCompleted: input.onAttachmentUploadCompleted }
      : {}),
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
  });
};
