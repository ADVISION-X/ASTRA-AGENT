import type { NerveBusAbilityGroup } from "../../nerve-bus/index.js";
import { createOrchestrationNerveBusAdapter } from "./orchestration-nerve-bus-adapter.js";

export type CreateOrchestrationAbilityGroupInput = {
  nerveBus: NerveBusAbilityGroup;
};

export function createOrchestrationNerveBusPort(input: CreateOrchestrationAbilityGroupInput) {
  return createOrchestrationNerveBusAdapter(input.nerveBus);
}