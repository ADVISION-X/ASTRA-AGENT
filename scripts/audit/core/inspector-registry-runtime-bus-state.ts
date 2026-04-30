import type { DomainInspector } from "./schema.js";

import { nerveBusCapabilityInspector } from "../domains/nerve-bus-capability/inspector.js";
import { inspectPageStateCapability as pageStateCapabilityInspector } from "../domains/page-state-capability/inspector.js";

export const runtimeBusStateInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/nerve-bus-capability/inspector.ts": nerveBusCapabilityInspector,
  "scripts/audit/domains/page-state-capability/inspector.ts": pageStateCapabilityInspector,
};