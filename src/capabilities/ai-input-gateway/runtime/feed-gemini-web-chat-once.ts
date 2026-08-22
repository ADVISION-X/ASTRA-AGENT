import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type { AiProviderAdapter } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatAttachmentUploadProof, WebChatPageActionProof } from "../contracts/ai-provider-adapter.contract.js";
import type { AiInputGatewayProgress, AiInputGatewaySubmissionAdmission } from "../contract.js";
import { geminiWebChatAdapter } from "../providers/gemini-web-chat.adapter.js";
import type {
  AiFeedInput,
  AiFeedResult,
} from "../schema.js";
import { executeAiFeedOnce } from "./feed-provider-once.js";

export const feedGeminiWebChatOnce = async (input: {
  request: AiFeedInput;
  dataDir: string;
  browser?: BrowserTargetLease;
  runtimeLogger?: RuntimeLogger;
  adapter?: AiProviderAdapter;
  signal?: AbortSignal;
  executionId?: string;
  supersededExecutionId?: string;
  submissionAdmission?: AiInputGatewaySubmissionAdmission;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  onProgress?: (progress: AiInputGatewayProgress) => Promise<void>;
  onPageActionCommitted?: (proof: WebChatPageActionProof) => Promise<void>;
}): Promise<AiFeedResult> => {
  return executeAiFeedOnce({
    request: input.request,
    dataDir: input.dataDir,
    adapter: input.adapter ?? geminiWebChatAdapter,
    childCapabilityId: "feed-gemini-web-chat-once",
    transport: "web-chat",
    ...(input.browser ? { browser: input.browser } : {}),
    ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.executionId ? { executionId: input.executionId } : {}),
    ...(input.supersededExecutionId
      ? { supersededExecutionId: input.supersededExecutionId }
      : {}),
    ...(input.submissionAdmission
      ? { submissionAdmission: input.submissionAdmission }
      : {}),
    ...(input.onAttachmentUploadCompleted
      ? { onAttachmentUploadCompleted: input.onAttachmentUploadCompleted }
      : {}),
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    ...(input.onPageActionCommitted
      ? { onPageActionCommitted: input.onPageActionCommitted }
      : {}),
  });
};
