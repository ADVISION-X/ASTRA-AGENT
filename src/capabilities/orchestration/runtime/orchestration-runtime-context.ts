import type { OrchestrationRuntimeContext } from "../internal.js";
export type { OrchestrationRuntimeContext } from "../internal.js";
import type { OrchestrationRuntimePlanStorePort } from "../ports/orchestration-runtime-plan-store-port.js";
import { createSystemOrchestrationClock } from "./orchestration-clock.js";
import { createInMemoryOrchestrationIdempotencyPort } from "./orchestration-idempotency.js";
import { createInMemoryOrchestrationStatePort } from "./mission-state-store.js";
import { createOrchestrationNerveBusAdapter, type OrchestrationNerveBusTransportSurface } from "./orchestration-nerve-bus-adapter.js";

type OrchestrationRuntimeNerveBus = {
  dispatchAbilityCommand: OrchestrationNerveBusTransportSurface["dispatchAbilityCommand"];
  requestAi: OrchestrationNerveBusTransportSurface["requestAi"];
};

function createNerveBusTransportSurface(nerveBus: OrchestrationRuntimeNerveBus): OrchestrationNerveBusTransportSurface {
  return {
    dispatchAbilityCommand(input) {
      return nerveBus.dispatchAbilityCommand(input);
    },
    requestAi(input) {
      return nerveBus.requestAi(input);
    },
  };
}

export function createOrchestrationRuntimeContext(input: {
  mapStore: OrchestrationRuntimePlanStorePort;
  nerveBus: OrchestrationRuntimeNerveBus;
  forensics: OrchestrationRuntimeContext["forensics"];
}): OrchestrationRuntimeContext {
  const nerveBus = createOrchestrationNerveBusAdapter(createNerveBusTransportSurface(input.nerveBus));

  return {
    clock: createSystemOrchestrationClock(),
    idempotency: createInMemoryOrchestrationIdempotencyPort(),
    forensics: input.forensics,
    mapStore: input.mapStore,
    nerveBus,
    statePort: createInMemoryOrchestrationStatePort(),
  };
}
