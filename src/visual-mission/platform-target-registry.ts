import { resolveOpenTargetDefaults } from "../capabilities/open/registry.js";

type VisualMissionPlatformId = "facebook-web" | "tiktok-web";

type VisualMissionPlatformTargetBinding = {
  platformId: VisualMissionPlatformId;
  targetProfileRef: string;
  targetUrl: string;
  targetTitle: string;
};

const PLATFORM_TARGET_SEEDS = {
  "facebook-web": {
    targetProfileRef: "open-target-profile:open-facebook",
  },
  "tiktok-web": {
    targetProfileRef: "open-target-profile:open-tiktok",
  },
} as const satisfies Record<VisualMissionPlatformId, {
  targetProfileRef: string;
}>;

function buildPlatformTargetBinding(platformId: VisualMissionPlatformId): VisualMissionPlatformTargetBinding {
  const seed = PLATFORM_TARGET_SEEDS[platformId];
  const defaults = resolveOpenTargetDefaults(seed.targetProfileRef);
  if (!defaults) {
    throw new Error(`Missing governed open target defaults for ${platformId}.`);
  }

  return {
    platformId,
    targetProfileRef: defaults.targetProfileRef,
    targetUrl: defaults.targetUrl,
    targetTitle: defaults.targetTitle,
  };
}

const PLATFORM_TARGET_BINDINGS = {
  "facebook-web": buildPlatformTargetBinding("facebook-web"),
  "tiktok-web": buildPlatformTargetBinding("tiktok-web"),
} as const;

export function listVisualMissionPlatformTargets(): VisualMissionPlatformTargetBinding[] {
  return Object.values(PLATFORM_TARGET_BINDINGS);
}

export function resolveVisualMissionPlatformTarget(platformId: VisualMissionPlatformId | null | undefined): VisualMissionPlatformTargetBinding | null {
  return platformId ? PLATFORM_TARGET_BINDINGS[platformId] ?? null : null;
}

export type {
  VisualMissionPlatformId,
  VisualMissionPlatformTargetBinding,
};