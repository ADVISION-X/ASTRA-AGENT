import type { Finding } from "../../core/schema.js";
import { runOpenContractAbilityChecks } from "./run-open-contract-ability-checks.js";
import { runOpenSchemaShapeChecks } from "./run-open-schema-shape-checks.js";

export function runOpenSchemaContractChecks(project: import("ts-morph").Project): Finding[] {
  return [
    ...runOpenSchemaShapeChecks(project),
    ...runOpenContractAbilityChecks(project),
  ];
}