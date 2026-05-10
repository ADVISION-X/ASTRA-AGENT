import { FACEBOOK_WEB_PROFILE } from "./builtins/facebook-web.profile.js";
import { TIKTOK_WEB_PROFILE } from "./builtins/tiktok-web.profile.js";
import { PlatformProfileSchema, type PlatformId, type PlatformProfile } from "./platform-profile.schema.js";

const PLATFORM_PROFILES = [
  PlatformProfileSchema.parse(FACEBOOK_WEB_PROFILE),
  PlatformProfileSchema.parse(TIKTOK_WEB_PROFILE),
] as const;

const PLATFORM_REGISTRY = new Map<PlatformId, PlatformProfile>(
  PLATFORM_PROFILES.map((profile) => [profile.platformId, profile]),
);

export const listPlatformProfiles = (): PlatformProfile[] => [...PLATFORM_REGISTRY.values()];

export const getPlatformProfile = (platformId: PlatformId): PlatformProfile | null =>
  PLATFORM_REGISTRY.get(platformId) ?? null;

export const resolvePlatformProfiles = (platformIds: PlatformId[]): Partial<Record<PlatformId, PlatformProfile>> => {
  const platformProfiles: Partial<Record<PlatformId, PlatformProfile>> = {};
  for (const platformId of platformIds) {
    const profile = getPlatformProfile(platformId);
    if (profile) {
      platformProfiles[platformId] = profile;
    }
  }
  return platformProfiles;
};