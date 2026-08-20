import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { verifyLastUserMessageAttachments } from "./web-chat-submit-page-actions.js";

export const waitForSubmittedUserMessageAttachments = async (input: {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  expectedCount: number;
  expectedKind: "image" | "file";
  expectedFileNames: readonly string[];
  promptText: string;
  timeoutMs: number;
  acknowledgeRateLimit: () => Promise<void>;
}): Promise<void> => {
  if (input.expectedCount <= 0) return;
  const deadline = Date.now() + input.timeoutMs;
  let lastMessage = "provider submitted attachment binding was not checked";
  let lastEvaluation: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    await input.acknowledgeRateLimit();
    try {
      const evaluation = await verifyLastUserMessageAttachments(
        input.browser,
        input.context,
        input.expectedCount,
        input.expectedKind,
        input.expectedFileNames,
        input.promptText,
      );
      lastEvaluation = evaluation;
      lastMessage = `${evaluation.status}: ${evaluation.message}`;
      if (evaluation.status === "success") return;
      if (evaluation.status === "review_required" || evaluation.status === "failed") {
        throw new Error(lastMessage);
      }
    } catch (error) {
      throw new Error(`verify_last_user_message_bound_attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
    await input.browser.wait(500);
  }
  const missingKind = input.expectedKind === "image"
    ? "provider_missing_bound_image" : "provider_missing_bound_file";
  throw new Error(
    `review_required: ${missingKind}; expected=${input.expectedCount}; detected=${String(lastEvaluation?.boundAttachmentCount ?? 0)}; last=${lastMessage}`,
  );
};
