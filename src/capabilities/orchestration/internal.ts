/**
 * Internal-only types shared between orchestration ability-group, children, and runtime.
 * NOT exported via index.ts.
 */
import type { OrchestrationClockPort } from "./ports/orchestration-clock-port.js";
import type { OrchestrationIdempotencyPort } from "./ports/orchestration-idempotency-port.js";
import type { OrchestrationMapStorePort } from "./ports/orchestration-map-store-port.js";
import type { OrchestrationNerveBusPort } from "./ports/orchestration-nerve-bus-port.js";
import type { OrchestrationStatePort } from "./ports/orchestration-state-port.js";
import type { OrchestrationAbilityGroupId, OrchestrationChildCapabilityId } from "./contract.js";

export type OrchestrationForensicsPort = {
  writeStructuredRuntimeEvent(input: unknown): Promise<unknown>;
  writeStructuredActionLog(input: unknown): Promise<unknown>;
};

export type OrchestrationRuntimeContext = {
  readonly clock: OrchestrationClockPort;
  readonly idempotency: OrchestrationIdempotencyPort;
  readonly mapStore: OrchestrationMapStorePort;
  readonly nerveBus: OrchestrationNerveBusPort;
  readonly statePort: OrchestrationStatePort;
  readonly forensics: OrchestrationForensicsPort;
};

export interface OrchestrationChildCapability<InputValue, OutputValue> {
  readonly abilityGroupId: OrchestrationAbilityGroupId;
  readonly childCapabilityId: OrchestrationChildCapabilityId;
  execute(input: InputValue, context: OrchestrationRuntimeContext): Promise<OutputValue>;
}
