import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { OpenCapability, OpenChildCapabilityId, OpenDrawer, OpenPlatformId } from "./contract.js";
import { createOpenFacebookCapability, DEFAULT_FACEBOOK_OPEN_TITLE, DEFAULT_FACEBOOK_OPEN_URL } from "./open-facebook/capability.js";
import { createOpenLocalWorkbenchCapability, DEFAULT_LOCAL_WORKBENCH_TITLE } from "./open-local-workbench/capability.js";
import { createOpenTikTokCapability, DEFAULT_TIKTOK_OPEN_TITLE, DEFAULT_TIKTOK_OPEN_URL } from "./open-tiktok/capability.js";

type CreateOpenDrawerInput = {
  browserController: BrowserController;
  localWorkbenchUrl: string;
};

export function createOpenDrawer(input: CreateOpenDrawerInput): OpenDrawer {
  const capabilities = new Map<OpenChildCapabilityId, OpenCapability>([
    ["open-tiktok", createOpenTikTokCapability()],
    ["open-facebook", createOpenFacebookCapability()],
    ["open-local-workbench", createOpenLocalWorkbenchCapability()],
  ]);

  return {
    listCapabilityIds() {
      return [...capabilities.keys()];
    },
    async openPlatform(openInput) {
      const capability = capabilities.get(resolveOpenCapabilityIdFromPlatform(openInput.platformId));
      if (!capability) {
        throw new Error(`Open drawer capability is not registered for platform ${openInput.platformId}`);
      }

      const defaults = resolvePlatformDefaults(openInput.platformId);
      return capability.open({
        browserController: input.browserController,
        reason: openInput.reason,
        targetUrl: openInput.targetUrl ?? defaults.targetUrl,
        targetTitle: openInput.targetTitle ?? defaults.targetTitle,
        roundId: openInput.roundId ?? null,
      });
    },
    async openLocalWorkbench(openInput) {
      const capability = capabilities.get("open-local-workbench");
      if (!capability) {
        throw new Error("Open drawer capability is not registered for the local workbench");
      }

      return capability.open({
        browserController: input.browserController,
        reason: openInput.reason,
        targetUrl: openInput.targetUrl ?? input.localWorkbenchUrl,
        targetTitle: openInput.targetTitle ?? DEFAULT_LOCAL_WORKBENCH_TITLE,
        roundId: openInput.roundId ?? null,
      });
    },
  };
}

export function resolveOpenCapabilityIdFromPlatform(
  platformId: OpenPlatformId,
): OpenChildCapabilityId {
  return platformId === "facebook-web" ? "open-facebook" : "open-tiktok";
}

function resolvePlatformDefaults(platformId: OpenPlatformId): {
  targetUrl: string;
  targetTitle: string;
} {
  if (platformId === "facebook-web") {
    return {
      targetUrl: DEFAULT_FACEBOOK_OPEN_URL,
      targetTitle: DEFAULT_FACEBOOK_OPEN_TITLE,
    };
  }

  return {
    targetUrl: DEFAULT_TIKTOK_OPEN_URL,
    targetTitle: DEFAULT_TIKTOK_OPEN_TITLE,
  };
}