import type { CreateOpenAbilityGroupInput } from "./contract.js";
import { type OpenAbilityGroup, type OpenRequest, type OpenResult } from "./contract.js";
import { OpenResultSchema } from "./schema.js";
import { createOpenRegistry, listOpenChildren } from "./registry.js";
import { buildOpenDispatchFailure } from "./runtime/open-dispatch-failure.js";
import { extractOpenFailureTrace, parseOpenAbilityInput } from "./runtime/open-input-gate.js";
import { createOpenRuntimeContext } from "./runtime/open-runtime-context.js";

export function createOpenAbilityGroup(input: CreateOpenAbilityGroupInput): OpenAbilityGroup {
  const registry = createOpenRegistry();
  const context = createOpenRuntimeContext(input);

  return {
    listChildCapabilityIds() {
      return listOpenChildren();
    },
    async execute(rawInput: OpenRequest): Promise<OpenResult> {
      const started = context.clock.now();
      const parsed = parseOpenAbilityInput(rawInput);
      if (!parsed.success) {
        const ended = context.clock.now();
        return buildOpenDispatchFailure({
          trace: extractOpenFailureTrace(rawInput),
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
          trace: extractOpenFailureTrace(parsed.data),
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
          trace: extractOpenFailureTrace(parsed.data),
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