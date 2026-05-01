import type { MouseClickAbilityContext } from "../contract.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

export type PrimitiveCallFrame = {
  startedSnapshot: ReturnType<MouseClickAbilityContext["clock"]["now"]>;
  primitiveCallId: string;
  primitiveStartedAt: string;
};

export const createPrimitiveCallFrame = (context: MouseClickAbilityContext, actionExecutionRef: string): PrimitiveCallFrame => {
  const startedSnapshot = context.clock.now();
  return {
    startedSnapshot,
    primitiveCallId: buildStableMouseClickRef("mouse-click-primitive-call", [
      actionExecutionRef,
      startedSnapshot.isoTimestamp,
      startedSnapshot.monotonicMs,
    ]),
    primitiveStartedAt: startedSnapshot.isoTimestamp,
  };
};
