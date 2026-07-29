import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  buildVerifyPromptPastedScript,
  buildVerifyPromptSubmittedScript,
} from "./web-chat-evaluation.js";
import { buildVerifyLastUserMessageAttachmentsScript } from "./web-chat-submitted-attachment-evaluation.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";

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
    expectedSuffix: string;
    previousUserMessageCount: number;
    wasPromptVerifiedBeforeSubmit: boolean;
  },
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat prompt was submitted",
    script: buildVerifyPromptSubmittedScript(input),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const verifyLastUserMessageAttachments = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedKind: "image" | "file",
  expectedFileNames: readonly string[],
  turnMarker: string,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: `verify AI web chat submitted user message has bound ${expectedKind} attachment`,
    script: buildVerifyLastUserMessageAttachmentsScript(
      expectedCount,
      expectedKind,
      expectedFileNames,
      turnMarker,
    ),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
