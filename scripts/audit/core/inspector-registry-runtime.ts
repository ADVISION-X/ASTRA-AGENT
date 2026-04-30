import type { DomainInspector } from "./schema.js";

import { runtimeBusStateInspectorRegistry } from "./inspector-registry-runtime-bus-state.js";
import { runtimeOpsInspectorRegistry } from "./inspector-registry-runtime-ops.js";
import { runtimePostInspectorRegistry } from "./inspector-registry-runtime-post.js";

export const runtimeInspectorRegistry: Record<string, DomainInspector> = {
  ...runtimeOpsInspectorRegistry,
  ...runtimeBusStateInspectorRegistry,
  ...runtimePostInspectorRegistry,
};