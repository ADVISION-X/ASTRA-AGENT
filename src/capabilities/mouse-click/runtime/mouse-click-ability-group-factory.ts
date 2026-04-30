import type { MouseClickPrimitivePort } from "../ports/mouse-click-primitive-port.js";
import { createMouseClickAbilityGroup } from "../ability-group.js";
import { createSystemMouseClickClock } from "./mouse-click-clock.js";
import { createMouseClickIdempotencyRegistry } from "./mouse-click-idempotency.js";

export function createMouseClickAbilityGroupWithPrimitivePort(input: {
  primitivePort: MouseClickPrimitivePort;
}) {
  return createMouseClickAbilityGroup({
    context: {
      primitivePort: input.primitivePort,
      clock: createSystemMouseClickClock(),
      idempotency: createMouseClickIdempotencyRegistry(),
    },
  });
}