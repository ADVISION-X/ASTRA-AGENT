import type { BrowserLoginState } from "../../../types/local-browser-session.js";
import {
  OPEN_DRAWER_ID,
  type OpenCapabilityResult,
  type OpenCapabilityTargetKind,
  type OpenChildCapabilityId,
} from "../contract.js";

type OpenCapabilityResultInput = {
  childCapabilityId: OpenChildCapabilityId;
  targetKind: OpenCapabilityTargetKind;
  sessionId: string;
  roundId: string | null;
  startedAt: string;
  durationMs: number;
  status: OpenCapabilityResult["status"];
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

export function buildOpenCapabilityResult(input: OpenCapabilityResultInput): OpenCapabilityResult {
  return {
    drawer: OPEN_DRAWER_ID,
    capabilityId: OPEN_DRAWER_ID,
    childCapabilityId: input.childCapabilityId,
    targetKind: input.targetKind,
    sessionId: input.sessionId,
    roundId: input.roundId,
    startedAt: input.startedAt,
    endedAt: new Date().toISOString(),
    durationMs: input.durationMs,
    status: input.status,
    targetUrl: input.targetUrl,
    openedUrl: input.openedUrl,
    targetTitle: input.targetTitle,
    message: input.message,
    failureReason: input.failureReason,
    nextCapability: input.nextCapability,
    fallbackUsed: input.fallbackUsed,
    loginState: input.loginState,
    reviewRequiredReason: input.reviewRequiredReason,
  };
}