import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasLiteralTextFragment, hasTypeReference } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const {
  ABILITY_GROUP_PATH,
  CONTRACT_PATH,
  LAW_BOUNDARY,
  LAW_PUBLIC_CONTRACT,
  LAW_RUNTIME_GOVERNANCE,
} = openInspectionConstants;
const { getOpenSourceOrThrow } = openInspectionUtils;

const collectContractFindings = (project: import("ts-morph").Project): Finding[] => {
  const contractSource = getOpenSourceOrThrow(project, CONTRACT_PATH);
  const openAbilityGroupInterface = contractSource.getInterface("OpenAbilityGroup");
  const abilityGroupMethods = openAbilityGroupInterface?.getMethods().map((method) => method.getName()) ?? [];
  const findings: Finding[] = [];

  if (!openAbilityGroupInterface || abilityGroupMethods.join(",") !== "listChildCapabilityIds,execute") {
    findings.push(createFinding({ lawId: LAW_PUBLIC_CONTRACT, file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Open public contract must expose only listChildCapabilityIds and execute." }));
  }
  if (hasTypeReference(contractSource, "BrowserController")) {
    findings.push(createFinding({ lawId: LAW_PUBLIC_CONTRACT, file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Open public contract must not expose BrowserController." }));
  }

  return findings;
};

const collectAbilityGroupFindings = (project: import("ts-morph").Project): Finding[] => {
  const abilityGroupSource = getOpenSourceOrThrow(project, ABILITY_GROUP_PATH);
  const findings: Finding[] = [];

  if (!hasCallExpression(abilityGroupSource, "parseOpenAbilityInput") || !hasCallExpression(abilityGroupSource, "extractOpenFailureTrace") || !hasCallExpression(abilityGroupSource, "createOpenRegistry") || !hasCallExpressionPath(abilityGroupSource, ["entry", "implementation", "execute"])) {
    findings.push(createFinding({ lawId: LAW_BOUNDARY, file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Open ability-group must parse input, build trace-only failure envelope, resolve metadata registry, and dispatch only through child execute." }));
  }
  if (hasLiteralTextFragment(abilityGroupSource, "127.0.0.1/unknown-child") || hasLiteralTextFragment(abilityGroupSource, "127.0.0.1/child-execution-failed")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Open ability-group must not fabricate fallback targetUrl values on failure paths." }));
  }

  return findings;
};

export function runOpenContractAbilityChecks(project: import("ts-morph").Project): Finding[] {
  return [
    ...collectContractFindings(project),
    ...collectAbilityGroupFindings(project),
  ];
}