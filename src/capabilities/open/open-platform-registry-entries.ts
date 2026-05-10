import { OpenFacebookRequestSchema, OpenFacebookResultSchema } from "./children/open-facebook/schema.js";
import {
  OPEN_FACEBOOK_BOUNDARY_POLICY,
  OPEN_FACEBOOK_FAILURE_POLICY,
  OPEN_FACEBOOK_OUTPUT_POLICY,
  OPEN_FACEBOOK_PROOF_POLICY,
} from "./children/open-facebook/contract.js";
import { createOpenFacebookCapability } from "./children/open-facebook/implementation.js";
import { OpenTikTokRequestSchema, OpenTikTokResultSchema } from "./children/open-tiktok/schema.js";
import {
  OPEN_TIKTOK_BOUNDARY_POLICY,
  OPEN_TIKTOK_FAILURE_POLICY,
  OPEN_TIKTOK_OUTPUT_POLICY,
  OPEN_TIKTOK_PROOF_POLICY,
} from "./children/open-tiktok/contract.js";
import { createOpenTikTokCapability } from "./children/open-tiktok/implementation.js";
import { getPlatformProfile } from "../../platforms/index.js";
import type { OpenRegistryEntry } from "./runtime/open-runtime-types.js";
import { DEFAULT_MAX_RESERVATIONS, DEFAULT_IDEMPOTENCY_TTL_MS } from "./open-registry-policy.js";
import { DEFAULT_OPEN_TIMEOUT_MS } from "./shared/open-policy.js";

const getRequiredPlatformProfile = (platformId: "facebook-web" | "tiktok-web") => {
  const profile = getPlatformProfile(platformId);
  if (!profile) {
    throw new Error(`Missing PlatformRegistry profile for ${platformId}.`);
  }
  return profile;
};

const toNonEmptyHostnames = (
  allowedHosts: readonly string[],
  platformId: "facebook-web" | "tiktok-web",
): [string, ...string[]] => {
  const [firstHostname, ...remainingHostnames] = allowedHosts;
  if (!firstHostname) {
    throw new Error(`PlatformRegistry allowedHosts is empty for ${platformId}.`);
  }
  return [firstHostname, ...remainingHostnames];
};

const TIKTOK_WEB_PROFILE = getRequiredPlatformProfile("tiktok-web");
const FACEBOOK_WEB_PROFILE = getRequiredPlatformProfile("facebook-web");

export const OPEN_PLATFORM_CHILDREN = [
  {
    childCapabilityId: "open-tiktok",
    targetKind: "platform-feed",
    platformId: "tiktok-web",
    inputSchema: OpenTikTokRequestSchema,
    outputSchema: OpenTikTokResultSchema,
    purpose: "Open the governed TikTok For You feed through the Open ability-group contract only.",
    allowedCaller: ["orchestration", "nerve-bus"],
    requiresNerveBus: true,
    allowedHostnames: toNonEmptyHostnames(TIKTOK_WEB_PROFILE.allowedHosts, "tiktok-web"),
    defaultUrl: TIKTOK_WEB_PROFILE.entryUrl,
    defaultTitle: TIKTOK_WEB_PROFILE.targetTitle,
    requiresRealChromeSession: true,
    allowsLocalhost: false,
    maxOpenDurationMs: DEFAULT_OPEN_TIMEOUT_MS,
    allowedSchemes: ["https"],
    postOpenStatePolicy: {
      allowLoginWallReview: true,
      allowSecurityWallReview: true,
      allowBlankPageReview: true,
      requirePageTitle: true,
      classifyCaptchaWall: true,
      classifyPermissionWall: true,
    },
    pageStateHandoffRequired: true,
    allowReplay: false,
    timeoutPolicy: {
      maxOpenDurationMs: DEFAULT_OPEN_TIMEOUT_MS,
      timeoutFailureCode: "navigation_timeout",
    },
    idempotencyPolicy: {
      allowReplay: false,
      scope: "session_target_round_video_visit",
      duplicateStatus: "review_required",
      ttlMs: DEFAULT_IDEMPOTENCY_TTL_MS,
      maxReservations: DEFAULT_MAX_RESERVATIONS,
    },
    boundaryPolicy: OPEN_TIKTOK_BOUNDARY_POLICY,
    proofPolicy: OPEN_TIKTOK_PROOF_POLICY,
    outputPolicy: OPEN_TIKTOK_OUTPUT_POLICY,
    failurePolicy: OPEN_TIKTOK_FAILURE_POLICY,
    implementation: createOpenTikTokCapability(),
  },
  {
    childCapabilityId: "open-facebook",
    targetKind: "platform-feed",
    platformId: "facebook-web",
    inputSchema: OpenFacebookRequestSchema,
    outputSchema: OpenFacebookResultSchema,
    purpose: "Open the governed Facebook Reels feed through the Open ability-group contract only.",
    allowedCaller: ["orchestration", "nerve-bus"],
    requiresNerveBus: true,
    allowedHostnames: toNonEmptyHostnames(FACEBOOK_WEB_PROFILE.allowedHosts, "facebook-web"),
    defaultUrl: FACEBOOK_WEB_PROFILE.entryUrl,
    defaultTitle: FACEBOOK_WEB_PROFILE.targetTitle,
    requiresRealChromeSession: true,
    allowsLocalhost: false,
    maxOpenDurationMs: DEFAULT_OPEN_TIMEOUT_MS,
    allowedSchemes: ["https"],
    postOpenStatePolicy: {
      allowLoginWallReview: true,
      allowSecurityWallReview: true,
      allowBlankPageReview: true,
      requirePageTitle: true,
      classifyCaptchaWall: true,
      classifyPermissionWall: true,
    },
    pageStateHandoffRequired: true,
    allowReplay: false,
    timeoutPolicy: {
      maxOpenDurationMs: DEFAULT_OPEN_TIMEOUT_MS,
      timeoutFailureCode: "navigation_timeout",
    },
    idempotencyPolicy: {
      allowReplay: false,
      scope: "session_target_round_video_visit",
      duplicateStatus: "review_required",
      ttlMs: DEFAULT_IDEMPOTENCY_TTL_MS,
      maxReservations: DEFAULT_MAX_RESERVATIONS,
    },
    boundaryPolicy: OPEN_FACEBOOK_BOUNDARY_POLICY,
    proofPolicy: OPEN_FACEBOOK_PROOF_POLICY,
    outputPolicy: OPEN_FACEBOOK_OUTPUT_POLICY,
    failurePolicy: OPEN_FACEBOOK_FAILURE_POLICY,
    implementation: createOpenFacebookCapability(),
  },
] as const satisfies readonly OpenRegistryEntry[];
