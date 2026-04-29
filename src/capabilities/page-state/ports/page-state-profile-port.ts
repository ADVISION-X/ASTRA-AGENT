import type { PageStatePlatformProfile } from "../shared/page-state-profile.js";
import type { PageStateResolvedPlatformProfile } from "../shared/page-state-types.js";

export interface PageStateProfilePort {
  listProfiles(): readonly PageStatePlatformProfile[];
  resolve(currentUrl: string, expectedProfileId: string): PageStateResolvedPlatformProfile | null;
}