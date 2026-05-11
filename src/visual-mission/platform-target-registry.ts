import {
  resolveOpenTargetDefaultsForPlatform,
} from "../capabilities/open/registry.js";
import {
  PlatformIdSchema,
  type PlatformId,
} from "../platforms/platform-profile.schema.js";
import { getPlatformProfile } from "../platforms/platform-registry.js";

export const VISUAL_MISSION_PLATFORM_IDS = PlatformIdSchema.options;

type VisualMissionPlatformId = PlatformId;

type VisualMissionPlatformTargetBinding = {
  platformId: VisualMissionPlatformId;
  targetProfileRef: string;
  targetUrl: string;
  targetTitle: string;
};

function buildPlatformTargetBinding(platformId: VisualMissionPlatformId): VisualMissionPlatformTargetBinding {
  const profile = getPlatformProfile(platformId);
  if (!profile) {
    throw new Error(`Missing PlatformRegistry profile for ${platformId}.`);
  }

  const defaults = resolveOpenTargetDefaultsForPlatform(platformId);
  if (!defaults) {
    throw new Error(`Missing governed open target defaults for ${platformId}.`);
  }

  return {
    platformId,
    targetProfileRef: defaults.targetProfileRef,
    targetUrl: profile.entryUrl,
    targetTitle: profile.targetTitle,
  };
}

const PLATFORM_TARGET_BINDINGS = {
  "facebook-web": buildPlatformTargetBinding("facebook-web"),
  "tiktok-web": buildPlatformTargetBinding("tiktok-web"),
} as const;

export const isVisualMissionPlatformId = (value: unknown): value is VisualMissionPlatformId => (
  PlatformIdSchema.safeParse(value).success
);

export function resolveVisualMissionPlatformTarget(platformId: VisualMissionPlatformId | null | undefined): VisualMissionPlatformTargetBinding | null {
  return platformId ? PLATFORM_TARGET_BINDINGS[platformId] ?? null : null;
}