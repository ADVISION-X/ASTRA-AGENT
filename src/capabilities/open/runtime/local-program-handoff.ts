import type { OpenNavigationDecision, OpenResult, PostOpenStateDecision } from "../contract.js";
import type { OpenLocalProgramLaunchResult, OpenLocalProgramSnapshot } from "../ports/open-local-program-port.js";

export function buildLocalProgramNavigationDecision(input: {
  idempotencyKey: string;
  launchResult: OpenLocalProgramLaunchResult | null;
  timedOut: boolean;
  reason: string | null;
}): OpenNavigationDecision {
  const status = input.timedOut ? "timed_out" : input.launchResult?.ok ? "executed" : "failed";
  return {
    status,
    reason: input.reason,
    browserActionId: input.launchResult?.localProgramActionId ?? null,
    openedUrl: null,
    pageTitleAfter: null,
    navigationAttemptRef: `${input.idempotencyKey}:local-program-open-attempt`,
    navigationCallId: `${input.idempotencyKey}:local-program-open-call`,
    redirectChain: [],
    timeoutDecision: input.timedOut ? "timed_out" : "within_limit",
    abortDecision: input.timedOut ? "timeout_abort_requested" : "not_requested",
    circuitBreakerState: "closed",
    browserOpenStillRunningGuard: input.timedOut,
    alreadyOnTargetFreshnessDecision: "not_applicable",
  };
}

export function buildLocalProgramPostOpenDecision(input: {
  status: OpenResult["status"];
  reason: string | null;
  pageStateHandoffRef: string | null;
}): PostOpenStateDecision {
  return {
    status: input.status,
    classification: "local_program",
    reason: input.reason,
    openedUrl: null,
    pageTitleAfter: null,
    pageStateHandoffRequired: true,
    pageStateHandoffRef: input.status === "success" ? input.pageStateHandoffRef : null,
    authoritative: false,
    documentReadyState: null,
  };
}

export function resolveHandoffRefs(input: {
  launchResult: OpenLocalProgramLaunchResult | null;
  snapshot: OpenLocalProgramSnapshot | null;
}) {
  return {
    windowHandoffRef: input.snapshot?.windowHandoffRef ?? input.launchResult?.windowHandoffRef ?? null,
    localAppStateHandoffRef: input.snapshot?.localAppStateHandoffRef ?? input.launchResult?.localAppStateHandoffRef ?? null,
  };
}
