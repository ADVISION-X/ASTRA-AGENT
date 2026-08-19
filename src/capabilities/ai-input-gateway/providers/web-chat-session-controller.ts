import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  ProviderExecutionProfileProof,
  WebChatConversationTitleProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { enforceGptWebExecutionProfile } from "./gpt-web-execution-profile.js";
import { finalizeGptWebConversationTitle } from "./gpt-web-conversation-title.js";

export const prepareWebChatSessionForSubmission = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
}): Promise<ProviderExecutionProfileProof | null> => {
  if (input.request.providerKind !== "gpt-web-chat") return null;
  return enforceGptWebExecutionProfile(input);
};

export const finalizeWebChatSessionAfterResult = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  submission: WebChatSubmissionProof;
}): Promise<WebChatConversationTitleProof | null> => {
  if (input.request.providerKind !== "gpt-web-chat") return null;
  return finalizeGptWebConversationTitle(input);
};
