import type { PostActionVerificationChildCapability } from "./runtime/post-action-verification-runtime-context.js";
import type { PostActionVerificationChildCapabilityId } from "./contract.js";
import { POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS } from "./contract.js";
import { createVerifyCommentsPanelClosedCapability } from "./children/verify-comments-panel-closed/implementation.js";
import { createVerifyCommentsPanelOpenedCapability } from "./children/verify-comments-panel-opened/implementation.js";
import { createVerifyNotInterestedResultCapability } from "./children/verify-not-interested-result/implementation.js";
import { createVerifyPageOpenedCapability } from "./children/verify-page-opened/implementation.js";
import { createVerifyTargetStateChangedCapability } from "./children/verify-target-state-changed/implementation.js";

export function createPostActionVerificationRegistry(): Map<PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability> {
  const entries: Array<readonly [PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability]> = [
    ["verify-page-opened", createVerifyPageOpenedCapability()],
    ["verify-comments-panel-opened", createVerifyCommentsPanelOpenedCapability()],
    ["verify-comments-panel-closed", createVerifyCommentsPanelClosedCapability()],
    ["verify-not-interested-result", createVerifyNotInterestedResultCapability()],
    ["verify-target-state-changed", createVerifyTargetStateChangedCapability()],
  ];
  return new Map<PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability>(entries);
}

export function listPostActionVerificationChildren(): PostActionVerificationChildCapabilityId[] {
  return [...POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS];
}
