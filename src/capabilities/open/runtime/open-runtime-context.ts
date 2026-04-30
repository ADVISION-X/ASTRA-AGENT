import type { ZodTypeAny } from "zod";

import type { CreateOpenAbilityGroupInput, OpenAbilityGroupId, OpenChildCapabilityId, OpenResult, OpenTargetProfile } from "../contract.js";
import type { OpenClockPort } from "../ports/open-clock-port.js";
import type { OpenIdempotencyPort } from "../ports/open-idempotency-port.js";
import type { OpenProfilePort } from "../ports/open-profile-port.js";
import { createSystemOpenClock } from "./open-clock.js";
import { createInMemoryOpenIdempotencyPort } from "./open-idempotency.js";

export type OpenRuntimeContext = {
  browser: CreateOpenAbilityGroupInput["browser"];
  clock: OpenClockPort;
  idempotency: OpenIdempotencyPort;
  profilePort?: OpenProfilePort;
};

export type OpenChildExecutionContext = OpenRuntimeContext;

export interface OpenChildCapability {
  readonly abilityGroupId: OpenAbilityGroupId;
  readonly childCapabilityId: OpenChildCapabilityId;
  readonly inputSchema: ZodTypeAny;
  readonly outputSchema: ZodTypeAny;

  execute(input: unknown, context: OpenChildExecutionContext, profile: OpenTargetProfile): Promise<OpenResult>;
}

export type OpenRegistryEntry = OpenTargetProfile & {
  readonly inputSchema: ZodTypeAny;
  readonly outputSchema: ZodTypeAny;
  readonly implementation: OpenChildCapability;
};

export function createOpenRuntimeContext(input: CreateOpenAbilityGroupInput): OpenRuntimeContext {
  return {
    browser: input.browser,
    clock: input.clock ?? createSystemOpenClock(),
    idempotency: input.idempotency ?? createInMemoryOpenIdempotencyPort(),
    ...(input.profilePort ? { profilePort: input.profilePort } : {}),
  };
}