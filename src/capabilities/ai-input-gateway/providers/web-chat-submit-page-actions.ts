import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  buildVerifyPromptPastedScript,
  buildVerifyPromptSubmittedScript,
  buildVerifyLastUserMessageAttachmentsScript,
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";

export const verifyPromptPasted = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  input: {
    expectedLength: number;
    expectedPrefix: string;
    expectedSuffix: string;
  },
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat prompt was pasted",
    script: buildVerifyPromptPastedScript({
      expectedLength: input.expectedLength,
      expectedPrefix: input.expectedPrefix,
      expectedSuffix: input.expectedSuffix,
    }),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const verifyPromptSubmitted = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  input: {
    expectedPrefix: string;
    previousAssistantCount: number;
    wasPromptVerifiedBeforeSubmit: boolean;
  },
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat prompt was submitted",
    script: buildVerifyPromptSubmittedScript(
      input.expectedPrefix,
      input.previousAssistantCount,
      input.wasPromptVerifiedBeforeSubmit,
    ),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const verifyLastUserMessageAttachments = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat submitted user message has bound image",
    script: buildVerifyLastUserMessageAttachmentsScript(expectedCount),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
