import type { OpenResult, OpenTargetProfile, ParsedOpenRequest } from "../contract.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import { OpenResultSchema } from "../schema.js";
import { createOpenFailure } from "../shared/open-failure.js";
import { buildOpenChildResult } from "./open-executor-flow-support.js";
import type { OpenChildPreflightState } from "./open-executor-preflight.js";
import { evaluatePostOpenState } from "./post-open-state-gate.js";
import { runOpenNavigation } from "./navigation-runner.js";
import { resolveOpenTimeoutMs } from "./open-timeout-policy.js";

export async function completeOpenChildExecution(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  state: OpenChildPreflightState;
}): Promise<OpenResult> {
  const pageStateHandoffRef = `page-state:${input.request.runId}:${input.request.childCapabilityId}`;
  const beforeSession = input.state.sessionGate.sessionSnapshot!;
  const navigation = await runOpenNavigation({
    browser: input.context.browser,
    request: input.request,
    profile: input.profile,
    targetUrl: input.state.normalizedTargetUrl,
    targetTitle: input.state.targetPolicy.resolvedTargetTitle ?? input.profile.defaultTitle,
    timeoutMs: resolveOpenTimeoutMs(input.profile),
    idempotencyKey: input.state.idempotency.idempotencyKey,
    reservationDecision: input.state.idempotency.decision === "already_on_target" ? "already_on_target" : "reserved",
    alreadyOnTargetDecision: input.state.idempotency.alreadyOnTargetDecision,
    targetProfileRef: input.state.targetPolicy.decision.targetProfileRef,
    beforeSession,
  });

  const postOpenState = evaluatePostOpenState({
    profile: input.profile,
    beforeSession,
    afterSession: navigation.afterSession,
    navigationDecision: navigation.decision,
    pageStateHandoffRef,
  });

  const ended = input.context.clock.now();
  if (postOpenState.status === "success") {
    input.context.idempotency.commitSuccess({ idempotencyKey: input.state.idempotency.idempotencyKey });
  } else if (input.state.idempotency.decision === "reserved") {
    input.context.idempotency.releaseOnFailure({ idempotencyKey: input.state.idempotency.idempotencyKey });
  }

  return OpenResultSchema.parse(buildOpenChildResult({
    request: input.request,
    profile: input.profile,
    targetPolicy: input.state.targetPolicy,
    urlSafety: input.state.urlSafety,
    sessionGate: input.state.sessionGate,
    navigation,
    postOpenState,
    idempotency: input.state.idempotency,
    beforeSession,
    started: input.state.started,
    ended,
    pageStateHandoffRef,
  }));
}
