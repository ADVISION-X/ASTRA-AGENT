import type { DomainInspector } from "./schema.js";

import { runtimeOpsControlInspectorRegistry } from "./inspector-registry-runtime-ops-control.js";
import { runtimeOpsLoggingInspectorRegistry } from "./inspector-registry-runtime-ops-logging.js";

export const runtimeOpsInspectorRegistry: Record<string, DomainInspector> = {
  ...runtimeOpsControlInspectorRegistry,
  ...runtimeOpsLoggingInspectorRegistry,
};