import type { OpenCapability, OpenCapabilityInput } from "../contract.js";
import { executeBrowserOpenCapability } from "../shared/browser-open-support.js";

export const DEFAULT_TIKTOK_OPEN_URL = "https://www.tiktok.com/foryou";
export const DEFAULT_TIKTOK_OPEN_TITLE = "TikTok For You";

export function createOpenTikTokCapability(): OpenCapability {
  return {
    drawer: "open",
    childCapabilityId: "open-tiktok",
    targetKind: "platform-feed",
    open(input: OpenCapabilityInput) {
      return executeBrowserOpenCapability({
        childCapabilityId: "open-tiktok",
        targetKind: "platform-feed",
        browserController: input.browserController,
        targetUrl: input.targetUrl,
        targetTitle: input.targetTitle,
        roundId: input.roundId ?? null,
      });
    },
  };
}