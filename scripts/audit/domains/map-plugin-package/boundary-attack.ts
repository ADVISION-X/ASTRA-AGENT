import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { LEGACY_MAP_IDS, getSource } from "./ast-utils.js";

const ORCHESTRATION_RUNTIME_CONTEXT = "src/capabilities/orchestration/runtime/orchestration-runtime-context.ts";
const ORCHESTRATION_MAP_SELECTION_GATE = "src/capabilities/orchestration/runtime/map-selection-gate.ts";
const ORCHESTRATION_ABILITY_GROUP = "src/capabilities/orchestration/ability-group.ts";
const COMMANDER_TASK_TEMPLATE_REGISTRY = "src/features/commander-console/task-template-registry.ts";
const COMMANDER_VIEW_MODEL = "src/features/commander-console/commander-console-view-model.ts";

export function runBoundaryAttack(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];

  const mapSelectionGate = getSource(project, ORCHESTRATION_MAP_SELECTION_GATE);
  if (!hasCallExpression(mapSelectionGate, "getActiveMapRecordByTaskTemplateId") || !hasCallExpression(mapSelectionGate, "getActiveMapRecordByActivationId")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-002-V1",
      file: ORCHESTRATION_MAP_SELECTION_GATE,
      line: 1,
      severity: "fatal",
      message: "Orchestration map selection must resolve active approved bindings through taskTemplateId and activationId seams.",
    }));
  }
  if (mapSelectionGate.getFullText().includes("resolvePreferredMapId") || mapSelectionGate.getFullText().includes("platform_policy")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-002-V1",
      file: ORCHESTRATION_MAP_SELECTION_GATE,
      line: 1,
      severity: "fatal",
      message: "Orchestration map selection must not preserve platform-policy fallback after plugin integration cutover.",
    }));
  }
  if (mapSelectionGate.getFullText().includes("product-video-detection")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-001-V1",
      file: ORCHESTRATION_MAP_SELECTION_GATE,
      line: 1,
      severity: "fatal",
      message: "Orchestration map selection must not hardcode legacy builtin map ids.",
    }));
  }

  const runtimeContext = getSource(project, ORCHESTRATION_RUNTIME_CONTEXT);
  if (!hasCallExpression(runtimeContext, "getDefaultMapPluginRegistry")
    || !hasCallExpression(runtimeContext, "listActivePackages")
    || !hasImportModuleSpecifier(runtimeContext, "map-plugin-registry")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-001-V1",
      file: ORCHESTRATION_RUNTIME_CONTEXT,
      line: 1,
      severity: "fatal",
      message: "Orchestration runtime context must consume the governed active map registry.",
    }));
  }
  if (runtimeContext.getFullText().includes("../maps/")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-001-V1",
      file: ORCHESTRATION_RUNTIME_CONTEXT,
      line: 1,
      severity: "fatal",
      message: "Orchestration runtime context must not stitch static map modules directly.",
    }));
  }

  const abilityGroup = getSource(project, ORCHESTRATION_ABILITY_GROUP);
  if (!hasCallExpression(abilityGroup, "getDefaultMapPluginRegistry") || !hasCallExpression(abilityGroup, "listActivePackages")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-001-V1",
      file: ORCHESTRATION_ABILITY_GROUP,
      line: 1,
      severity: "fatal",
      message: "Orchestration ability-group must list governed active maps from the registry.",
    }));
  }
  if (["STATIC_MAP_IDS", "OPERATIONAL_MAP_IDS"].some((fragment) => abilityGroup.getFullText().includes(fragment))) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-001-V1",
      file: ORCHESTRATION_ABILITY_GROUP,
      line: 1,
      severity: "fatal",
      message: "Orchestration ability-group must not preserve static map id truth beside the registry.",
    }));
  }

  const taskTemplateRegistry = getSource(project, COMMANDER_TASK_TEMPLATE_REGISTRY);
  if (!hasCallExpression(taskTemplateRegistry, "listOrdinaryTaskTemplates") || !hasCallExpression(taskTemplateRegistry, "getTaskTemplateDeveloperBinding") || !hasCallExpression(taskTemplateRegistry, "getDefaultMapPluginRegistry")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-005-V1",
      file: COMMANDER_TASK_TEMPLATE_REGISTRY,
      line: 1,
      severity: "fatal",
      message: "Commander task template registry must source ordinary task templates separately from developer bindings.",
    }));
  }
  if (["STATIC_TASK_TEMPLATE_DEFINITIONS", ...LEGACY_MAP_IDS].some((fragment) => taskTemplateRegistry.getFullText().includes(fragment))) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-005-V1",
      file: COMMANDER_TASK_TEMPLATE_REGISTRY,
      line: 1,
      severity: "fatal",
      message: "Commander task template registry must not preserve a static parallel task-template source of truth.",
    }));
  }

  const commanderViewModel = getSource(project, COMMANDER_VIEW_MODEL);
  if (!hasCallExpression(commanderViewModel, "listDeveloperCatalog") || !hasCallExpression(commanderViewModel, "getDefaultMapPluginRegistry")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-005-V1",
      file: COMMANDER_VIEW_MODEL,
      line: 1,
      severity: "fatal",
      message: "Commander developer map catalog must come from the governed map package registry.",
    }));
  }
  if (commanderViewModel.getFullText().includes("selectedMapId 与 requestedPlatformId") || commanderViewModel.getFullText().includes("Selected ${dashboard.mission.selectedMapId}")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-005-V1",
      file: COMMANDER_VIEW_MODEL,
      line: 1,
      severity: "fatal",
      message: "Commander ordinary-mode copy must not expose internal map identifier fields directly.",
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
        ? "Orchestration and Commander consume governed map packages instead of preserving static parallel map truth."
        : "Orchestration or Commander still preserves a legacy static path that bypasses governed map packages.",
    ),
  };
}