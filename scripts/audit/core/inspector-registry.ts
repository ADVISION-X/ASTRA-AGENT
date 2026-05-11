import type { DomainInspector } from "./schema.js";

import { coreInspectorRegistry } from "./inspector-registry-core.js";
import { evidenceInspectorRegistry } from "./inspector-registry-evidence.js";
import { platformInspectorRegistry } from "./inspector-registry-platform.js";
import { runtimeInspectorRegistry } from "./inspector-registry-runtime.js";

const inspectorRegistry: Record<string, DomainInspector> = {
  ...coreInspectorRegistry,
  ...runtimeInspectorRegistry,
  ...platformInspectorRegistry,
  ...evidenceInspectorRegistry,
};

export const getRegisteredInspector = (entry: string): DomainInspector | null =>
  inspectorRegistry[entry] ?? null;