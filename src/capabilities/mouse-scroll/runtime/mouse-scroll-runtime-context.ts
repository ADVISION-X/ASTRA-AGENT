import type { MouseScrollAbilityResult, MouseScrollChildCapabilityId, ParsedMouseScrollAbilityInput } from "../contract.js";
import type { MouseScrollClockPort } from "../ports/mouse-scroll-clock-port.js";
import type { MouseScrollPrimitivePort } from "../ports/mouse-scroll-primitive-port.js";
import type { MouseScrollIdempotencyRegistry } from "./mouse-scroll-idempotency.js";

export type MouseScrollExecutionContext = {
  primitivePort: MouseScrollPrimitivePort;
  clock: MouseScrollClockPort;
  idempotency: MouseScrollIdempotencyRegistry;
};

export interface MouseScrollChildCapability {
  readonly abilityGroupId: "mouse-scroll";
  readonly childCapabilityId: MouseScrollChildCapabilityId;

  execute(input: ParsedMouseScrollAbilityInput, context: MouseScrollExecutionContext): Promise<MouseScrollAbilityResult>;
}