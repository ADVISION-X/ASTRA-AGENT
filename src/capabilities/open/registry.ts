import type { OpenChildCapabilityId, OpenRegistryEntry } from "./contract.js";
import { createOpenFacebookCapability } from "./children/open-facebook/implementation.js";
import { createOpenLocalWorkbenchCapability } from "./children/open-local-workbench/implementation.js";
import { createOpenTikTokCapability } from "./children/open-tiktok/implementation.js";
import {
  DEFAULT_LOCAL_WORKBENCH_TIMEOUT_MS,
  DEFAULT_LOCALHOST_HOSTNAMES,
  DEFAULT_OPEN_TIMEOUT_MS,
} from "./shared/open-policy.js";

const OPEN_CHILDREN = [
  {
    childCapabilityId: "open-tiktok",
    targetKind: "platform-feed",
    platformId: "tiktok-web",
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
    },
    pageStateHandoffRequired: true,
    allowReplay: false,
    implementation: createOpenTikTokCapability(),
  },
  {
    childCapabilityId: "open-facebook",
    targetKind: "platform-feed",
    platformId: "facebook-web",
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
    },
    pageStateHandoffRequired: true,
    allowReplay: false,
    implementation: createOpenFacebookCapability(),
  },
  {
    childCapabilityId: "open-local-workbench",
    targetKind: "local-workbench",
    platformId: "local-workbench",
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
    },
    pageStateHandoffRequired: true,
    allowReplay: false,
    implementation: createOpenLocalWorkbenchCapability(),
  },
] as const satisfies readonly OpenRegistryEntry[];

export function createOpenRegistry(): Map<OpenChildCapabilityId, OpenRegistryEntry> {
  return new Map(OPEN_CHILDREN.map((entry) => [entry.childCapabilityId, entry]));
}

export function listOpenChildren(): OpenChildCapabilityId[] {
  return OPEN_CHILDREN.map((entry) => entry.childCapabilityId);
}