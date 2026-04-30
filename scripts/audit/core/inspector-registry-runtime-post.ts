import type { DomainInspector } from "./schema.js";

import { inspectPostActionVerificationCapability as postActionVerificationCapabilityInspector } from "../domains/post-action-verification-capability/inspector.js";

export const runtimePostInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/post-action-verification-capability/inspector.ts": postActionVerificationCapabilityInspector,
};