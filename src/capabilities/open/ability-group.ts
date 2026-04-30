import type { CreateOpenAbilityGroupInput } from "./contract.js";
import { type OpenAbilityGroup, type OpenRequest, type OpenResult } from "./contract.js";
import { OpenResultSchema } from "./schema.js";
import { createOpenRegistry, listOpenChildren } from "./registry.js";
import { buildOpenDispatchFailure } from "./runtime/open-dispatch-failure.js";
import { extractOpenFailureTrace, parseOpenAbilityInput } from "./runtime/open-input-gate.js";
import { createOpenRuntimeContext } from "./runtime/open-runtime-context.js";

const buildOpenFailureFromContext = (input: {
  context: ReturnType<typeof createOpenRuntimeContext>;
  rawInput: OpenRequest;
  failureCode: "input_schema_invalid" | "unknown_child" | "child_execution_failed";
  reason: string;
  started: ReturnType<ReturnType<typeof createOpenRuntimeContext>["clock"]["now"]>;
}) => {
  const { context, rawInput, failureCode, reason, started } = input;
  const ended = context.clock.now();
  return buildOpenDispatchFailure({
    trace: extractOpenFailureTrace(rawInput),
    failureCode,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    reason,
    status: "failed",
  });
};

const executeOpenChild = async (
  context: ReturnType<typeof createOpenRuntimeContext>,
  registry: ReturnType<typeof createOpenRegistry>,
  rawInput: OpenRequest,
  started: ReturnType<ReturnType<typeof createOpenRuntimeContext>["clock"]["now"]>,
) => {
  const parsed = parseOpenAbilityInput(rawInput);
  if (!parsed.success) {
    return buildOpenFailureFromContext({ context, rawInput, failureCode: "input_schema_invalid", reason: parsed.error.message, started });
  }

  const entry = registry.get(parsed.data.childCapabilityId);
  if (!entry) {
    return buildOpenFailureFromContext({
      context,
      rawInput: parsed.data,
      failureCode: "unknown_child",
      reason: `unknown open child capability: ${parsed.data.childCapabilityId}`,
      started,
    });
  }

  try {
    return OpenResultSchema.parse(await entry.implementation.execute(parsed.data, context, entry));
  } catch (error) {
    return buildOpenFailureFromContext({
      context,
      rawInput: parsed.data,
      failureCode: "child_execution_failed",
      reason: error instanceof Error ? error.message : "open child execution failed",
      started,
    });
  }
};

export function createOpenAbilityGroup(input: CreateOpenAbilityGroupInput): OpenAbilityGroup {
  const registry = createOpenRegistry();
  const context = createOpenRuntimeContext(input);

  return {
    listChildCapabilityIds() {
      return listOpenChildren();
    },
    async execute(rawInput: OpenRequest): Promise<OpenResult> {
      const started = context.clock.now();
      return executeOpenChild(context, registry, rawInput, started);
    },
  };
}