import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { BrowserLoginState } from "../../types/local-browser-session.js";

export const OPEN_DRAWER_ID = "open";

export type OpenDrawerId = typeof OPEN_DRAWER_ID;
export type OpenPlatformId = "tiktok-web" | "facebook-web";
export type OpenChildCapabilityId = "open-tiktok" | "open-facebook" | "open-local-workbench";
export type OpenCapabilityTargetKind = "platform-feed" | "local-workbench";
export type OpenCapabilityResultStatus = "success" | "failed";

export type OpenCapabilityInput = {
  browserController: BrowserController;
  reason: string;
  targetUrl: string;
  targetTitle: string;
  roundId?: string | null;
};

export type OpenCapabilityResult = {
  drawer: OpenDrawerId;
  capabilityId: OpenDrawerId;
  childCapabilityId: OpenChildCapabilityId;
  targetKind: OpenCapabilityTargetKind;
  sessionId: string;
  roundId: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: OpenCapabilityResultStatus;
  targetUrl: string;
  openedUrl: string;
  targetTitle: string;
  message: string;
  failureReason: string | null;
  nextCapability: string | null;
  fallbackUsed: boolean;
  loginState: BrowserLoginState;
  reviewRequiredReason: string | null;
};

export interface OpenCapability {
  readonly drawer: OpenDrawerId;
  readonly childCapabilityId: OpenChildCapabilityId;
  readonly targetKind: OpenCapabilityTargetKind;

  open(input: OpenCapabilityInput): Promise<OpenCapabilityResult>;
}

export interface OpenDrawer {
  listCapabilityIds(): OpenChildCapabilityId[];
  openPlatform(input: {
    platformId: OpenPlatformId;
    reason: string;
    targetUrl?: string;
    targetTitle?: string;
    roundId?: string | null;
  }): Promise<OpenCapabilityResult>;
  openLocalWorkbench(input: {
    reason: string;
    targetUrl?: string;
    targetTitle?: string;
    roundId?: string | null;
  }): Promise<OpenCapabilityResult>;
}