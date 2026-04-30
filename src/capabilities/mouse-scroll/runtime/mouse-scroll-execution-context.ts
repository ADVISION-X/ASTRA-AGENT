import type { MouseScrollPrimitivePort } from "../ports/mouse-scroll-primitive-port.js";
import { createSystemMouseScrollClock } from "./mouse-scroll-clock.js";
import { createMouseScrollIdempotencyRegistry } from "./mouse-scroll-idempotency.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

export function createMouseScrollExecutionContext(input: {
  primitivePort: MouseScrollPrimitivePort;
}): MouseScrollExecutionContext {
  return {
    primitivePort: input.primitivePort,
    clock: createSystemMouseScrollClock(),
    idempotency: createMouseScrollIdempotencyRegistry(),
  };
}