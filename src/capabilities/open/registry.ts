import type { OpenChildCapabilityId } from "./contract.js";
import { OpenFacebookRequestSchema, OpenFacebookResultSchema } from "./children/open-facebook/schema.js";
import {
  OPEN_FACEBOOK_BOUNDARY_POLICY,
  OPEN_FACEBOOK_FAILURE_POLICY,
  OPEN_FACEBOOK_OUTPUT_POLICY,
  OPEN_FACEBOOK_PROOF_POLICY,
} from "./children/open-facebook/contract.js";
import { createOpenFacebookCapability } from "./children/open-facebook/implementation.js";
import { OpenLocalWorkbenchRequestSchema, OpenLocalWorkbenchResultSchema } from "./children/open-local-workbench/schema.js";
import {
  OPEN_LOCAL_WORKBENCH_BOUNDARY_POLICY,
  OPEN_LOCAL_WORKBENCH_FAILURE_POLICY,
  OPEN_LOCAL_WORKBENCH_OUTPUT_POLICY,
  OPEN_LOCAL_WORKBENCH_PROOF_POLICY,
} from "./children/open-local-workbench/contract.js";
import { createOpenLocalWorkbenchCapability } from "./children/open-local-workbench/implementation.js";
import { OpenTikTokRequestSchema, OpenTikTokResultSchema } from "./children/open-tiktok/schema.js";
import {
  OPEN_TIKTOK_BOUNDARY_POLICY,
  OPEN_TIKTOK_FAILURE_POLICY,
  OPEN_TIKTOK_OUTPUT_POLICY,
  OPEN_TIKTOK_PROOF_POLICY,
} from "./children/open-tiktok/contract.js";
import { createOpenTikTokCapability } from "./children/open-tiktok/implementation.js";
import type { OpenRegistryEntry } from "./runtime/open-runtime-context.js";
import {
  DEFAULT_LOCAL_WORKBENCH_TIMEOUT_MS,
  DEFAULT_LOCALHOST_HOSTNAMES,
  DEFAULT_OPEN_TIMEOUT_MS,
} from "./shared/open-policy.js";

const DEFAULT_IDEMPOTENCY_TTL_MS = 30_000;
const DEFAULT_MAX_RESERVATIONS = 512;

const OPEN_CHILDREN = [
  {
    childCapabilityId: "open-tiktok",
    targetKind: "platform-feed",
    platformId: "tiktok-web",
    inputSchema: OpenTikTokRequestSchema,
    outputSchema: OpenTikTokResultSchema,
    purpose: "Open the governed TikTok For You feed through the Open ability-group contract only.",
    allowedCaller: ["orchestration", "nerve-bus"],
    requiresNerveBus: true,
    allowedHostnames: ["tiktok.com", "www.tiktok.com"],
    defaultUrl: "https://www.tiktok.com/foryou",
    defaultTitle: "TikTok For You",
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
    allowedHostnames: ["facebook.com", "www.facebook.com", "m.facebook.com"],
    defaultUrl: "https://www.facebook.com/reel/",
    defaultTitle: "Facebook Reels",
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
  {
    childCapabilityId: "open-local-workbench",
    targetKind: "local-workbench",
    platformId: "local-workbench",
    inputSchema: OpenLocalWorkbenchRequestSchema,
    outputSchema: OpenLocalWorkbenchResultSchema,
    purpose: "Open the local Commander workbench through the same governed Open package and real Chrome session.",
    allowedCaller: ["orchestration", "nerve-bus"],
    requiresNerveBus: true,
    allowedHostnames: [...DEFAULT_LOCALHOST_HOSTNAMES],
    defaultUrl: "http://127.0.0.1:3000",
    defaultTitle: "GrassEye Local Workbench",
    requiresRealChromeSession: true,
    allowsLocalhost: true,
    maxOpenDurationMs: DEFAULT_LOCAL_WORKBENCH_TIMEOUT_MS,
    allowedSchemes: ["http", "https"],
    postOpenStatePolicy: {
      allowLoginWallReview: false,
      allowSecurityWallReview: true,
      allowBlankPageReview: true,
      requirePageTitle: true,
      classifyCaptchaWall: true,
      classifyPermissionWall: true,
    },
    pageStateHandoffRequired: true,
    allowReplay: false,
    timeoutPolicy: {
      maxOpenDurationMs: DEFAULT_LOCAL_WORKBENCH_TIMEOUT_MS,
      timeoutFailureCode: "navigation_timeout",
    },
    idempotencyPolicy: {
      allowReplay: false,
      scope: "session_target_round_video_visit",
      duplicateStatus: "review_required",
      ttlMs: DEFAULT_IDEMPOTENCY_TTL_MS,
      maxReservations: DEFAULT_MAX_RESERVATIONS,
    },
    boundaryPolicy: OPEN_LOCAL_WORKBENCH_BOUNDARY_POLICY,
    proofPolicy: OPEN_LOCAL_WORKBENCH_PROOF_POLICY,
    outputPolicy: OPEN_LOCAL_WORKBENCH_OUTPUT_POLICY,
    failurePolicy: OPEN_LOCAL_WORKBENCH_FAILURE_POLICY,
    implementation: createOpenLocalWorkbenchCapability(),
  },
] as const satisfies readonly OpenRegistryEntry[];

export function createOpenRegistry(): Map<OpenChildCapabilityId, OpenRegistryEntry> {
  return new Map(OPEN_CHILDREN.map((entry) => [entry.childCapabilityId, entry]));
}

export function listOpenChildren(): OpenChildCapabilityId[] {
  return OPEN_CHILDREN.map((entry) => entry.childCapabilityId);
}