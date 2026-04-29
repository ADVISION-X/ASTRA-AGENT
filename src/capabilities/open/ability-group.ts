import type { OpenBrowserPort } from "./ports/open-browser-port.js";
import type { OpenClockPort } from "./ports/open-clock-port.js";
import type { OpenIdempotencyPort } from "./ports/open-idempotency-port.js";
import type { OpenProfilePort } from "./ports/open-profile-port.js";
import { type OpenAbilityGroup, type OpenChildCapabilityId, type OpenPlatformId, type OpenRequest, type OpenResult, type OpenTargetKind } from "./contract.js";
import { OpenResultSchema } from "./schema.js";
import { createOpenRegistry, listOpenChildren } from "./registry.js";
import { createSystemOpenClock } from "./runtime/open-clock.js";
import { buildOpenDispatchFailure } from "./runtime/open-dispatch-failure.js";
import { createInMemoryOpenIdempotencyPort } from "./runtime/open-idempotency.js";
import { coerceOpenInputSeed, parseOpenAbilityInput } from "./runtime/open-input-gate.js";

type CreateOpenAbilityGroupInput = {
  browser: OpenBrowserPort;
  clock?: OpenClockPort;
  idempotency?: OpenIdempotencyPort;
  profilePort?: OpenProfilePort;
};

export function createOpenAbilityGroup(input: CreateOpenAbilityGroupInput): OpenAbilityGroup {
  const registry = createOpenRegistry();
  const idempotency = input.idempotency ?? createInMemoryOpenIdempotencyPort();
  const context = {
    browser: input.browser,
    clock: input.clock ?? createSystemOpenClock(),
    idempotency,
    ...(input.profilePort ? { profilePort: input.profilePort } : {}),
    reserveIdempotency: (reservationInput: Parameters<OpenIdempotencyPort["reserve"]>[0]) => idempotency.reserve(reservationInput),
  };

  return {
    listChildCapabilityIds() {
      return listOpenChildren();
    },
    async execute(rawInput: OpenRequest): Promise<OpenResult> {
      const started = context.clock.now();
      const parsed = parseOpenAbilityInput(rawInput);
      if (!parsed.success) {
        const seed = coerceOpenInputSeed(rawInput);
        const ended = context.clock.now();
        return buildOpenDispatchFailure({
          request: {
            childCapabilityId: seed.childCapabilityId as OpenChildCapabilityId,
            platformId: seed.platformId as OpenPlatformId,
            targetKind: seed.targetKind as OpenTargetKind,
            missionId: seed.missionId,
            runId: seed.runId,
            sessionId: seed.sessionId,
            roundId: seed.roundId,
            videoVisitId: seed.videoVisitId,
            sourceAbilityGroupId: seed.sourceAbilityGroupId,
            sourceChildCapabilityId: seed.sourceChildCapabilityId,
            targetUrl: seed.targetUrl,
            targetTitle: seed.targetTitle,
            sourceRef: seed.sourceRef,
          },
          failureCode: "input_schema_invalid",
          startedAt: started.isoTimestamp,
          endedAt: ended.isoTimestamp,
          startedMonotonicMs: started.monotonicMs,
          endedMonotonicMs: ended.monotonicMs,
          reason: parsed.error.message,
          status: "failed",
        });
      }

      const entry = registry.get(parsed.data.childCapabilityId);
      if (!entry) {
        const ended = context.clock.now();
        return buildOpenDispatchFailure({
          request: {
            ...parsed.data,
            targetUrl: parsed.data.targetUrl ?? "http://127.0.0.1/unknown-child",
          },
          failureCode: "unknown_child",
          startedAt: started.isoTimestamp,
          endedAt: ended.isoTimestamp,
          startedMonotonicMs: started.monotonicMs,
          endedMonotonicMs: ended.monotonicMs,
          reason: `unknown open child capability: ${parsed.data.childCapabilityId}`,
          status: "failed",
        });
      }

      try {
        return OpenResultSchema.parse(await entry.implementation.execute(parsed.data, context, entry));
      } catch (error) {
        const ended = context.clock.now();
        return buildOpenDispatchFailure({
          request: {
            ...parsed.data,
            targetUrl: parsed.data.targetUrl ?? "http://127.0.0.1/child-execution-failed",
          },
          failureCode: "child_execution_failed",
          startedAt: started.isoTimestamp,
          endedAt: ended.isoTimestamp,
          startedMonotonicMs: started.monotonicMs,
          endedMonotonicMs: ended.monotonicMs,
          reason: error instanceof Error ? error.message : "open child execution failed",
          status: "failed",
        });
      }
    },
  };
}