import type { DomainInspector } from "./schema.js";

import { openCapabilityInspector } from "../domains/open-capability/inspector.js";
import { screenshotCapabilityInspector } from "../domains/screenshot-capability/inspector.js";

export const platformOpenScreenInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/open-capability/inspector.ts": openCapabilityInspector,
  "scripts/audit/domains/screenshot-capability/inspector.ts": screenshotCapabilityInspector,
};