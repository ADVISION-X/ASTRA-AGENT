import type {
  PageStateChildCapabilityId,
} from "./contract.js";
import { PAGE_STATE_CHILD_CAPABILITY_IDS } from "./schema.js";
import type { PageStateChildCapability } from "./runtime/page-state-child-contract.js";
import { createDetectCommentPanelStateCapability } from "./children/detect-comment-panel-state/implementation.js";
import { createDetectFeedReadyCapability } from "./children/detect-feed-ready/implementation.js";
import { createDetectLoginStateCapability } from "./children/detect-login-state/implementation.js";
import { createDetectModalOverlayStateCapability } from "./children/detect-modal-overlay-state/implementation.js";
import { createDetectPageAbnormalityCapability } from "./children/detect-page-abnormality/implementation.js";
import { createDetectPlatformPageKindCapability } from "./children/detect-platform-page-kind/implementation.js";
import { createDetectSafetyPageCapability } from "./children/detect-safety-page/implementation.js";
import { createDetectVideoStableCapability } from "./children/detect-video-stable/implementation.js";

export function createPageStateRegistry(): Map<PageStateChildCapabilityId, PageStateChildCapability> {
  return new Map<PageStateChildCapabilityId, PageStateChildCapability>([
    ["detect-login-state", createDetectLoginStateCapability()],
    ["detect-safety-page", createDetectSafetyPageCapability()],
    ["detect-feed-ready", createDetectFeedReadyCapability()],
    ["detect-video-stable", createDetectVideoStableCapability()],
    ["detect-comment-panel-state", createDetectCommentPanelStateCapability()],
    ["detect-modal-overlay-state", createDetectModalOverlayStateCapability()],
    ["detect-page-abnormality", createDetectPageAbnormalityCapability()],
    ["detect-platform-page-kind", createDetectPlatformPageKindCapability()],
  ]);
}

export function listPageStateChildren(): PageStateChildCapabilityId[] {
  return [...PAGE_STATE_CHILD_CAPABILITY_IDS];
}