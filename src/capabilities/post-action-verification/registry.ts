import type { PostActionVerificationChildCapability } from "./runtime/post-action-verification-runtime-context.js";
import type { PostActionVerificationChildCapabilityId } from "./contract.js";
import { POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS } from "./contract.js";
import { createObservePostActionCapability } from "./children/post-action-observation-child.js";

export function createPostActionVerificationRegistry(): Map<PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability> {
  const entries: Array<readonly [PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability]> = POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS.map((childCapabilityId) => [
    childCapabilityId,
    createObservePostActionCapability(childCapabilityId),
  ]);
  return new Map<PostActionVerificationChildCapabilityId, PostActionVerificationChildCapability>(entries);
}

export function listPostActionVerificationChildren(): PostActionVerificationChildCapabilityId[] {
  return [...POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS];
}
