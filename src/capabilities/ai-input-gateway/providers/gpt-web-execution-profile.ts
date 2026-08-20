import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  ProviderExecutionProfileProof,
} from "../contracts/ai-provider-adapter.contract.js";
import { assertProviderExecutionProfileIntegrity } from "../provider-execution-profile.js";
import type { AiFeedInput } from "../schema.js";
import { assertStableWebChatDocument } from "./web-chat-page-action-contract.js";

type ExecutionProfileInput = Readonly<{
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
}>;

/**
 * The request still binds gpt-web-execution-profile.v1, including medium,
 * high, extra_high, pro_standard, pro_extended and GPT-5.6 Sol. The current
 * approved Chrome construction session, however, has not reached one unique
 * pre-submit model/reasoning control with a verified readback. A proof marked
 * provider_ui_observation must therefore not be manufactured from the request
 * or from a post-response “switch model” menu.
 */
export const enforceGptWebExecutionProfile = async (
  input: ExecutionProfileInput,
): Promise<ProviderExecutionProfileProof | null> => {
  const profile = input.request.providerExecutionProfile;
  if (input.request.providerKind !== "gpt-web-chat" || !profile) return null;
  assertProviderExecutionProfileIntegrity(profile);
  const expectedDocumentRef = input.browser.document.documentRef;
  assertStableWebChatDocument({
    browser: input.browser,
    expectedDocumentRef,
    actionId: "verify_execution_profile",
  });
  void input.context;
  void input.providerUrl;
  throw new Error(
    "review_required: NOT_PRODUCTION_VERIFIED: GPT pre-submit model and reasoning controls have no exact verified readback; GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH",
  );
};
