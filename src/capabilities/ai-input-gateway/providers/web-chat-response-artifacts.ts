import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  captureChatGptBusinessHtmlArtifact,
  captureInlineChatGptBusinessHtmlArtifact,
  isBusinessHtmlReportRequest,
} from "./web-chat-html-artifact-capture.js";
import {
  captureChatGptJsonArtifact,
  captureInlineChatGptJsonArtifact,
  isJsonArtifactRequest,
} from "./web-chat-json-artifact-capture.js";

type ResponseArtifactInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  answerText: string;
  conversationUrl: string | null;
};

const captureRequiredBusinessHtmlArtifact = async (input: ResponseArtifactInput) => {
  if (!isBusinessHtmlReportRequest(input.request)) return null;
  const inlineArtifact = captureInlineChatGptBusinessHtmlArtifact({
    answerText: input.answerText,
    pageUrl: input.conversationUrl,
  });
  const artifact = inlineArtifact ?? await captureChatGptBusinessHtmlArtifact(input);
  if (!artifact) throw new Error("review_required: provider did not produce a business-report.html artifact.");
  return artifact;
};

const captureOptionalJsonArtifact = async (input: ResponseArtifactInput, htmlArtifactPresent: boolean) => {
  if (htmlArtifactPresent || !isJsonArtifactRequest(input.request)) return null;
  return captureInlineChatGptJsonArtifact({ answerText: input.answerText, pageUrl: input.conversationUrl })
    ?? await captureChatGptJsonArtifact(input);
};

export const captureWebChatResponseArtifacts = async (input: ResponseArtifactInput) => {
  const htmlArtifact = await captureRequiredBusinessHtmlArtifact(input);
  const jsonArtifact = await captureOptionalJsonArtifact(input, Boolean(htmlArtifact));
  return { htmlArtifact, jsonArtifact };
};
