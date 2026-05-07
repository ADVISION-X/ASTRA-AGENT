import type {
  BrowserSessionSnapshot,
  OpenBrowserNavigationResult,
  OpenNavigationDecision,
} from "../contract.js";
import { OpenNavigationDecisionSchema } from "../schema.js";
import { buildRedirectChain } from "../shared/open-url.js";

export type SessionSnapshotResult = {
  ok: boolean;
  snapshot: BrowserSessionSnapshot | null;
  reason: string | null;
};

export type OpenNavigationRunResult = {
  ok: boolean;
  failureCode: "navigation_timeout" | "navigation_failed" | "session_snapshot_failed" | null;
  reason: string | null;
  navigationResult: OpenBrowserNavigationResult | null;
  afterSession: BrowserSessionSnapshot;
  sessionSnapshotAvailable: boolean;
  sessionSnapshotFailureReason: string | null;
  decision: OpenNavigationDecision;
};

export type NavigationDecisionInput = {
  status: "already_on_target" | "timed_out" | "failed" | "executed";
  reason: string | null;
  browserActionId: string | null;
  openedUrl: string;
  pageTitleAfter: string | null;
  navigationAttemptRef: string;
  navigationCallId: string;
  redirectChain: ReturnType<typeof buildRedirectChain>;
  timeoutDecision: "within_limit" | "timed_out";
  abortDecision: "not_requested" | "timeout_abort_requested";
  browserOpenStillRunningGuard: boolean;
  alreadyOnTargetHandlingMode: "not_applicable" | "session_reused";
};

export const buildSessionSnapshotFailureReason = (error: unknown): string =>
  error instanceof Error ? error.message : "open browser session snapshot failed after navigation";

export const buildNavigationDecision = (input: NavigationDecisionInput): OpenNavigationDecision => OpenNavigationDecisionSchema.parse({
  status: input.status,
  reason: input.reason,
  browserActionId: input.browserActionId,
  openedUrl: input.openedUrl,
  pageTitleAfter: input.pageTitleAfter,
  navigationAttemptRef: input.navigationAttemptRef,
  navigationCallId: input.navigationCallId,
  redirectChain: input.redirectChain,
  timeoutDecision: input.timeoutDecision,
  abortDecision: input.abortDecision,
  circuitBreakerState: "closed",
  browserOpenStillRunningGuard: input.browserOpenStillRunningGuard,
  alreadyOnTargetHandlingMode: input.alreadyOnTargetHandlingMode,
});

export const buildNavigationResponse = (input: OpenNavigationRunResult): OpenNavigationRunResult => input;