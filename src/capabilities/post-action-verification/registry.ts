import type {
  PostActionVerificationChildCapability,
  PostActionVerificationChildCapabilityId,
} from "./contract.js";
import { createVerifyCommentsPanelClosedCapability } from "./children/verify-comments-panel-closed/implementation.js";
import { createVerifyCommentsPanelOpenedCapability } from "./children/verify-comments-panel-opened/implementation.js";
import { createVerifyNotInterestedResultCapability } from "./children/verify-not-interested-result/implementation.js";
import { createVerifyPageOpenedCapability } from "./children/verify-page-opened/implementation.js";
import { createVerifyTargetStateChangedCapability } from "./children/verify-target-state-changed/implementation.js";
import { createVerifyVideoChangedAfterScrollCapability } from "./children/verify-video-changed-after-scroll/implementation.js";

export function createPostActionVerificationRegistry(): Map<PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability> {
  return new Map<PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability>([
    ["verify-page-opened", createVerifyPageOpenedCapability()],
    ["verify-comments-panel-opened", createVerifyCommentsPanelOpenedCapability()],
    ["verify-comments-panel-closed", createVerifyCommentsPanelClosedCapability()],
    ["verify-video-changed-after-scroll", createVerifyVideoChangedAfterScrollCapability()],
    ["verify-not-interested-result", createVerifyNotInterestedResultCapability()],
    ["verify-target-state-changed", createVerifyTargetStateChangedCapability()],
  ]);
}