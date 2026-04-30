import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./ast-utils.js";

const ACTIVE_MAP_REGISTRY = "src/map-plugins/registry/active-map-registry.ts";
const MAP_SELECTION_GATE = "src/capabilities/orchestration/runtime/map-selection-gate.ts";
const TASK_TEMPLATE_REGISTRY = "src/features/commander-console/task-template-registry.ts";
const TASK_API_HANDLERS = "src/app/task-api-handlers.ts";

export function runBoundaryAttack(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];

  const registrySource = getSource(project, ACTIVE_MAP_REGISTRY);
  if (!hasCallExpression(registrySource, "toDeveloperBinding") || !hasCallExpression(registrySource, "toActiveOperationalMapRecord")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1",
      file: ACTIVE_MAP_REGISTRY,
      line: 1,
      severity: "error",
      message: "Active map registry must normalize developer binding and active map record through dedicated helpers.",
    }));
  }

  const selectionGateSource = getSource(project, MAP_SELECTION_GATE);
  if (!hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecord"])
    || !hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecordByTaskTemplateId"])
    || !hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecordByActivationId"])) {
    findings.push(createFinding({
      lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1",
      file: MAP_SELECTION_GATE,
      line: 1,
      severity: "fatal",
      message: "Map selection gate must resolve map id, taskTemplateId, and activationId through the active map store seam.",
    }));
  }

  const taskTemplateRegistrySource = getSource(project, TASK_TEMPLATE_REGISTRY);
  if (!hasCallExpression(taskTemplateRegistrySource, "listOrdinaryTaskTemplates") || hasCallExpression(taskTemplateRegistrySource, "listApprovedTaskTemplates")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-005-V1",
      file: TASK_TEMPLATE_REGISTRY,
      line: 1,
      severity: "fatal",
      message: "Commander task-template registry must read ordinary task feeds instead of the developer/internal feed.",
    }));
  }

  const taskApiSource = getSource(project, TASK_API_HANDLERS);
  if (!hasCallExpression(taskApiSource, "resolveMissionStartBinding") || !hasCallExpression(taskApiSource, "getDefaultMapPluginRegistry")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
      file: TASK_API_HANDLERS,
      line: 1,
      severity: "fatal",
      message: "Task API must resolve task-template launches through the active registry instead of trusting raw ordinary-mode bindings.",
    }));
  }

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