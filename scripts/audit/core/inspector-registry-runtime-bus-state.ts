import type { DomainInspector } from "./schema.js";

import { nerveBusCapabilityInspector } from "../domains/nerve-bus-capability/inspector.js";

export const runtimeBusStateInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/nerve-bus-capability/inspector.ts": nerveBusCapabilityInspector,
};