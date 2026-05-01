import type { Finding } from "../../core/schema.js";

import { runOpenRegistryShapeChecks } from "./run-open-registry-shape-checks.js";
import { runOpenSchemaContractChecks } from "./run-open-schema-contract-checks.js";

export function runOpenPublicShapeChecks(project: import("ts-morph").Project): Finding[] {
  return [
    ...runOpenSchemaContractChecks(project),
    ...runOpenRegistryShapeChecks(project),
  ];
}