import type { CreateOpenAbilityGroupInput } from "../contract.js";
import { createSystemOpenClock } from "./open-clock.js";
import { createInMemoryOpenIdempotencyPort } from "./open-idempotency.js";
import type { OpenRuntimeContext } from "./open-runtime-types.js";

export function createOpenRuntimeContext(input: CreateOpenAbilityGroupInput): OpenRuntimeContext {
  return {
    browser: input.browser,
    clock: input.clock ?? createSystemOpenClock(),
    idempotency: input.idempotency ?? createInMemoryOpenIdempotencyPort(),
    ...(input.profilePort ? { profilePort: input.profilePort } : {}),
  };
}