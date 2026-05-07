import type { PageStatePlatformProfile } from "./page-state-profile.js";

export type PageStateResolvedPlatformProfile = {
  profile: PageStatePlatformProfile;
  profileId: string;
  expectedProfileId: string;
  matchKind: "host" | "local_workbench";
  matchedHost: string;
  hostMatched: boolean;
};

export type PageStateClockReading = {
  isoTimestamp: string;
  epochMs: number;
};