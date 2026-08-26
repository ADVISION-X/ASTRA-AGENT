import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
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
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
}): Promise<ProviderExecutionProfileProof | null> => {
  if (input.request.providerKind !== "gpt-web-chat") return null;
  const checkpoint = input.context.webChatExecution?.providerExecutionProfileCheckpointCurrent === true
    ? input.context.webChatExecution.providerExecutionProfileProof : null;
  if (checkpoint) {
    if (checkpoint.profileHash !== input.request.providerExecutionProfile?.profileHash) {
      throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_PROOF_BINDING_MISMATCH");
    }
    return checkpoint;
  }
  return enforceGptWebExecutionProfile(input);
};

export const finalizeWebChatSessionAfterResult = async (input: {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  submission: WebChatSubmissionProof;
}): Promise<WebChatConversationTitleProof | null> => {
  if (input.request.providerKind !== "gpt-web-chat") return null;
  return finalizeGptWebConversationTitle(input);
};
