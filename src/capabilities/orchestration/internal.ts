/**
 * Internal-only types shared between orchestration ability-group, children, and runtime.
 * NOT exported via index.ts.
 */
import type { OrchestrationClockPort } from "./ports/orchestration-clock-port.js";
import type { OrchestrationIdempotencyPort } from "./ports/orchestration-idempotency-port.js";
import type { OrchestrationNerveBusPort } from "./ports/orchestration-nerve-bus-port.js";
import type { OrchestrationStatePort } from "./ports/orchestration-state-port.js";
import type { OrchestrationAbilityGroupId, OrchestrationChildCapabilityId } from "./contract.js";
import type {
  ForensicsPersistenceAbilityResult,
  ForensicsStructuredActionLogInput,
  ForensicsStructuredRuntimeEventInput,
} from "../forensics-persistence/contract.js";

export type OrchestrationForensicsPort = {
  writeStructuredRuntimeEvent(input: ForensicsStructuredRuntimeEventInput): Promise<ForensicsPersistenceAbilityResult>;
  writeStructuredActionLog(input: ForensicsStructuredActionLogInput): Promise<ForensicsPersistenceAbilityResult>;
};

export type OrchestrationRuntimeContext = {
  readonly clock: OrchestrationClockPort;
  readonly idempotency: OrchestrationIdempotencyPort;
  readonly nerveBus: OrchestrationNerveBusPort;
  readonly statePort: OrchestrationStatePort;
  readonly forensics: OrchestrationForensicsPort;
};

export interface OrchestrationChildCapability<InputValue, OutputValue> {
  readonly abilityGroupId: OrchestrationAbilityGroupId;
  readonly childCapabilityId: OrchestrationChildCapabilityId;
  execute(input: InputValue, context: OrchestrationRuntimeContext): Promise<OutputValue>;
}
