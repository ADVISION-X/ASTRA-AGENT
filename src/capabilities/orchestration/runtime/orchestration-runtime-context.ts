import type { NerveBusAbilityGroup } from "../../nerve-bus/index.js";
import type { OrchestrationRuntimeContext } from "../internal.js";
export type { OrchestrationRuntimeContext } from "../internal.js";
import { createSystemOrchestrationClock } from "./orchestration-clock.js";
import { createInMemoryOrchestrationIdempotencyPort } from "./orchestration-idempotency.js";
import { createInMemoryOrchestrationStatePort } from "./mission-state-store.js";
import { createRegistryBackedMapStore } from "./orchestration-map-store.js";
import { createOrchestrationNerveBusAdapter } from "./orchestration-nerve-bus-adapter.js";

export function createOrchestrationRuntimeContext(nerveBus: NerveBusAbilityGroup): OrchestrationRuntimeContext {
  return {
    clock: createSystemOrchestrationClock(),
    idempotency: createInMemoryOrchestrationIdempotencyPort(),
    mapStore: createRegistryBackedMapStore(),
    nerveBus: createOrchestrationNerveBusAdapter(nerveBus),
    statePort: createInMemoryOrchestrationStatePort(),
  };
}
