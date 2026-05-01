import type { OrchestrationRuntimeContext } from "../internal.js";
export type { OrchestrationRuntimeContext } from "../internal.js";
import { getDefaultMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";
import type { OrchestrationNerveBusPort } from "../ports/orchestration-nerve-bus-port.js";
import { createSystemOrchestrationClock } from "./orchestration-clock.js";
import { createInMemoryOrchestrationIdempotencyPort } from "./orchestration-idempotency.js";
import { createInMemoryOrchestrationStatePort } from "./mission-state-store.js";

export function createOrchestrationRuntimeContext(input: {
  mapStore: OrchestrationMapStorePort;
  nerveBus: OrchestrationNerveBusPort;
}): OrchestrationRuntimeContext {
  const mapPluginRegistry = getDefaultMapPluginRegistry();
  mapPluginRegistry.active.listActivePackages();

  return {
    clock: createSystemOrchestrationClock(),
    idempotency: createInMemoryOrchestrationIdempotencyPort(),
    mapStore: input.mapStore,
    nerveBus: input.nerveBus,
    statePort: createInMemoryOrchestrationStatePort(),
  };
}
