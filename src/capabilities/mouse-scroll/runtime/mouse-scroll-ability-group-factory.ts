import type { MouseScrollPrimitivePort } from "../ports/mouse-scroll-primitive-port.js";
import { createMouseScrollAbilityGroup } from "../ability-group.js";
import { createMouseScrollExecutionContext } from "./mouse-scroll-execution-context.js";

export function createMouseScrollAbilityGroupWithPrimitivePort(input: {
  primitivePort: MouseScrollPrimitivePort;
}) {
  return createMouseScrollAbilityGroup({
    context: createMouseScrollExecutionContext({
      primitivePort: input.primitivePort,
    }),
  });
}