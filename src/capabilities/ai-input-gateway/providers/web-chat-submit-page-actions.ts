import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  buildVerifyPromptSubmittedScript,
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";
import {
  CLICK_SUBMIT_BUTTON_SCRIPT,
  FIND_SUBMIT_BUTTON_POINT_SCRIPT,
} from "./web-chat-page-action-scripts.js";

export const clickSubmitButton = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "click AI web chat submit button",
    script: CLICK_SUBMIT_BUTTON_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const findSubmitButtonPoint = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "locate AI web chat submit button point",
    script: FIND_SUBMIT_BUTTON_POINT_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

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