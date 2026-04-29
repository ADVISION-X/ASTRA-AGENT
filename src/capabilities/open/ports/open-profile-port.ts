import type { OpenChildCapabilityId, OpenPlatformId } from "../contract.js";

export type OpenProfileOverride = {
  defaultUrl?: string;
  defaultTitle?: string;
  allowedHostnames?: readonly string[];
};

export interface OpenProfilePort {
  resolveProfileOverride(input: {
    childCapabilityId: OpenChildCapabilityId;
    platformId: OpenPlatformId;
  }): OpenProfileOverride | null;
}