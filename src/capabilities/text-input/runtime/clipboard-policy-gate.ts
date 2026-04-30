import type { ParsedTextInputAbilityInput } from "../contract.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";

export function validateClipboardPolicy(input: { request: ParsedTextInputAbilityInput }) {
  const usesClipboard = input.request.childCapabilityId === "paste-text"
    || (input.request.childCapabilityId === "replace-input" && input.request.policy.replacePolicy.writeMode === "paste-text");

  if (!usesClipboard) {
    return {
      ok: true as const,
      clipboardProofRef: null,
      clipboardDecision: "not_used" as const,
      dataQualityFlags: [] as string[],
    };
  }

  if (input.request.policy.clipboardPolicy.allowPaste !== true || input.request.policy.clipboardPolicy.requiredForPaste !== true) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "paste_policy_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input paste operations require clipboardPolicy.allowPaste=true and requiredForPaste=true.",
      policyDecision: "block" as const,
      clipboardProofRef: null,
      clipboardDecision: "failed" as const,
      dataQualityFlags: ["clipboard_policy_blocked"],
    };
  }

  return {
    ok: true as const,
    clipboardProofRef: buildStableTextInputRef("text-input-clipboard-policy", [input.request.policy.clipboardPolicy]),
    clipboardDecision: "not_used" as const,
    dataQualityFlags: [] as string[],
  };
}