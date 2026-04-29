import type { OpenBrowserPort } from "./ports/open-browser-port.js";
import type { OpenClockPort } from "./ports/open-clock-port.js";
import type { OpenIdempotencyPort } from "./ports/open-idempotency-port.js";
import type { OpenProfilePort } from "./ports/open-profile-port.js";
import { type OpenAbilityGroup, type OpenRequest, type OpenResult } from "./contract.js";
import { OpenResultSchema } from "./schema.js";
import { createOpenRegistry, listOpenChildren } from "./registry.js";
import { createSystemOpenClock } from "./runtime/open-clock.js";
import { buildOpenDispatchFailure } from "./runtime/open-dispatch-failure.js";
import { createInMemoryOpenIdempotencyPort } from "./runtime/open-idempotency.js";
import { extractOpenFailureTrace, parseOpenAbilityInput } from "./runtime/open-input-gate.js";

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
        const trace = extractOpenFailureTrace(rawInput);
        const ended = context.clock.now();
        return buildOpenDispatchFailure({
          trace,
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
          trace: {
            childCapabilityId: { value: parsed.data.childCapabilityId, source: "provided" },
            platformId: { value: parsed.data.platformId, source: "provided" },
            targetKind: { value: parsed.data.targetKind, source: "provided" },
            missionId: { value: parsed.data.missionId, source: "provided" },
            runId: { value: parsed.data.runId, source: "provided" },
            sessionId: { value: parsed.data.sessionId, source: "provided" },
            targetUrl: { value: parsed.data.targetUrl, source: parsed.data.targetUrl ? "provided" : "unavailable" },
            roundId: parsed.data.roundId,
            videoVisitId: parsed.data.videoVisitId,
            sourceAbilityGroupId: parsed.data.sourceAbilityGroupId,
            sourceChildCapabilityId: parsed.data.sourceChildCapabilityId,
            targetTitle: parsed.data.targetTitle,
            sourceRef: parsed.data.sourceRef,
            requestedBy: parsed.data.requestedBy,
            parseDecision: "parsed",
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
          trace: {
            childCapabilityId: { value: parsed.data.childCapabilityId, source: "provided" },
            platformId: { value: parsed.data.platformId, source: "provided" },
            targetKind: { value: parsed.data.targetKind, source: "provided" },
            missionId: { value: parsed.data.missionId, source: "provided" },
            runId: { value: parsed.data.runId, source: "provided" },
            sessionId: { value: parsed.data.sessionId, source: "provided" },
            targetUrl: { value: parsed.data.targetUrl, source: parsed.data.targetUrl ? "provided" : "unavailable" },
            roundId: parsed.data.roundId,
            videoVisitId: parsed.data.videoVisitId,
            sourceAbilityGroupId: parsed.data.sourceAbilityGroupId,
            sourceChildCapabilityId: parsed.data.sourceChildCapabilityId,
            targetTitle: parsed.data.targetTitle,
            sourceRef: parsed.data.sourceRef,
            requestedBy: parsed.data.requestedBy,
            parseDecision: "parsed",
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