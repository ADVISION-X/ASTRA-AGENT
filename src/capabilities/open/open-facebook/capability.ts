import type { OpenCapability, OpenCapabilityInput } from "../contract.js";
import { executeBrowserOpenCapability } from "../shared/browser-open-support.js";

export const DEFAULT_FACEBOOK_OPEN_URL = "https://www.facebook.com/reel/";
export const DEFAULT_FACEBOOK_OPEN_TITLE = "Facebook Reels";

export function createOpenFacebookCapability(): OpenCapability {
  return {
    drawer: "open",
    childCapabilityId: "open-facebook",
    targetKind: "platform-feed",
    open(input: OpenCapabilityInput) {
      return executeBrowserOpenCapability({
        childCapabilityId: "open-facebook",
        targetKind: "platform-feed",
        browserController: input.browserController,
        targetUrl: input.targetUrl,
        targetTitle: input.targetTitle,
        roundId: input.roundId ?? null,
      });
    },
  };
}