import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import {
  hasGovernedTaskStartBindingResolution,
  hasTaskStartDelegation,
  TASK_API_HANDLERS,
  TASK_START_BINDING,
} from "./task-start-launch-inspection.js";

const ACTIVE_MAP_REGISTRY = "src/map-plugins/registry/active-map-registry.ts";
const MAP_SELECTION_GATE = "src/capabilities/orchestration/runtime/map-selection-gate.ts";
const TASK_TEMPLATE_REGISTRY = "src/lib/local-app-shell/task-template-registry.ts";
const inspectActiveRegistry = (project: Project): Finding[] => {
  const registrySource = getSource(project, ACTIVE_MAP_REGISTRY);
  return hasCallExpression(registrySource, "toDeveloperBinding") && hasCallExpression(registrySource, "toActiveOperationalMapRecord")
    ? []
    : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: ACTIVE_MAP_REGISTRY, line: 1, severity: "error", message: "Active map registry must normalize developer binding and active map record through dedicated helpers." })];
};

const inspectSelectionGate = (project: Project): Finding[] => {
  const selectionGateSource = getSource(project, MAP_SELECTION_GATE);
  return hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecord"]) && hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecordByTaskTemplateId"]) && hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecordByActivationId"])
    ? []
    : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: MAP_SELECTION_GATE, line: 1, severity: "fatal", message: "Map selection gate must resolve map id, taskTemplateId, and activationId through the active map store seam." })];
};

const inspectTaskTemplateRegistry = (project: Project): Finding[] => {
  const taskTemplateRegistrySource = getSource(project, TASK_TEMPLATE_REGISTRY);
  return hasCallExpression(taskTemplateRegistrySource, "listOrdinaryTaskTemplates") && !hasCallExpression(taskTemplateRegistrySource, "listApprovedTaskTemplates")
    ? []
    : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-005-V1", file: TASK_TEMPLATE_REGISTRY, line: 1, severity: "fatal", message: "Commander task-template registry must read ordinary task feeds instead of the developer/internal feed." })];
};

const inspectTaskApi = (project: Project): Finding[] => {
  if (!hasTaskStartDelegation(project)) {
    return [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: TASK_API_HANDLERS, line: 1, severity: "fatal", message: "Task API must route task-template launches through the dedicated task-start control path." })];
  }

  return hasGovernedTaskStartBindingResolution(project)
    ? []
    : [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: TASK_START_BINDING, line: 1, severity: "fatal", message: "Task start launch binding must resolve task-template launches through the active registry instead of trusting raw ordinary-mode bindings." })];
};

export function runBoundaryAttack(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...inspectActiveRegistry(project),
    ...inspectSelectionGate(project),
    ...inspectTaskTemplateRegistry(project),
    ...inspectTaskApi(project),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      passed ? "PASS" : "ENFORCEMENT MISS",
      passed,
      passed
        ? "Schema ownership, active map resolution, and ordinary task-template launch boundaries are enforced through the right seams."
        : "One or more map-plugin to Orchestration or Commander boundaries still route through the wrong seam.",
    ),
  };
}