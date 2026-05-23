import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  buildVerifyPromptSubmittedScript,
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";

export const verifyPromptSubmitted = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedText: string,
  previousAssistantCount: number,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat prompt was submitted",
    script: buildVerifyPromptSubmittedScript(expectedText, previousAssistantCount),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });