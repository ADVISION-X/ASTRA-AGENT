import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { hasMethodNamed } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { missingFiles } from "./audit-files.js";
import { REQUIRED_AUDIT_FILES, REQUIRED_SOURCE_FILES, SCORECARD_PATH } from "./file-lists.js";
import { createBootstrappedRegistry } from "./registry-bootstrap.js";
import {
  hasGovernedTaskStartBindingResolution,
  hasTaskStartDelegation,
  TASK_API_HANDLERS,
  TASK_START_BINDING,
  TASK_START_FLOW,
} from "./task-start-launch-inspection.js";

const OPERATIONAL_MAP_PACKAGE_SCHEMA = "src/map-plugins/schema/operational-map-package.schema.ts";
const TASK_TEMPLATE_PACKAGE_SCHEMA = "src/map-plugins/schema/task-template-package.schema.ts";
const ACTIVE_MAP_REGISTRY = "src/map-plugins/registry/active-map-registry.ts";
const MAP_SELECTION_GATE = "src/capabilities/orchestration/runtime/map-selection-gate.ts";
const ORCHESTRATION_SCHEMA = "src/capabilities/orchestration/schema.ts";
const TASK_TEMPLATE_REGISTRY = "src/lib/local-app-shell/task-template-registry.ts";
const inspectMissingIntegrationFiles = async (): Promise<Finding[]> => {
  const missing = await missingFiles([...REQUIRED_SOURCE_FILES, ...REQUIRED_AUDIT_FILES]);
  return missing.map((filePath) => createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: filePath, line: 1, severity: "fatal", message: "Map-plugin orchestration integration required file is missing." }));
};

const inspectPackageSchemas = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const operationalMapPackageText = await readTextFile(pathFromRepoRoot(OPERATIONAL_MAP_PACKAGE_SCHEMA));
  const taskTemplateSchemaText = await readTextFile(pathFromRepoRoot(TASK_TEMPLATE_PACKAGE_SCHEMA));

  if (!operationalMapPackageText.includes("MapPluginOperationalMapSchema")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: OPERATIONAL_MAP_PACKAGE_SCHEMA, line: 1, severity: "fatal", message: "Operational map package schema must parse through the map-plugin-owned operational map schema." }));
  }
  if (!taskTemplateSchemaText.includes('./platform-id.schema.js')) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: TASK_TEMPLATE_PACKAGE_SCHEMA, line: 1, severity: "fatal", message: "Task template package schema must consume the map-plugin-owned platform id schema." }));
  }

  return findings;
};

const inspectActiveRegistrySource = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const activeRegistrySource = getSource(project, ACTIVE_MAP_REGISTRY);

  for (const requiredMethod of ["listOrdinaryTaskTemplates", "getTaskTemplateDeveloperBinding", "getActiveOperationalMapRecord", "getActiveOperationalMapRecordByTaskTemplateId", "getActiveOperationalMapRecordByActivationId"]) {
    if (!hasMethodNamed(activeRegistrySource, requiredMethod)) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: ACTIVE_MAP_REGISTRY, line: 1, severity: "fatal", message: `Active map registry must expose ${requiredMethod} for governed integration reads.` }));
    }
  }

  return findings;
};

const inspectSelectionGateSource = (project: Project): Finding[] => {
  const selectionGateSource = getSource(project, MAP_SELECTION_GATE);
  return hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecordByTaskTemplateId"]) && hasCallExpressionPath(selectionGateSource, ["input", "mapStore", "getActiveMapRecordByActivationId"])
    ? []
    : [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: MAP_SELECTION_GATE, line: 1, severity: "fatal", message: "Map selection gate must resolve active approved maps through taskTemplateId and activationId seams." })];
};

const inspectOrchestrationSchema = async (): Promise<Finding[]> => {
  const orchestrationSchemaText = await readTextFile(pathFromRepoRoot(ORCHESTRATION_SCHEMA));
  for (const fragment of ['taskTemplateId: z.string().min(1).nullable().optional().default(null)', 'mapPackageId: z.string().min(1).nullable().optional().default(null)', 'mapPackageVersion: z.string().min(1).nullable().optional().default(null)', 'mapVersion: z.string().min(1).nullable().optional().default(null)']) {
    if (!orchestrationSchemaText.includes(fragment)) {
      return [createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: ORCHESTRATION_SCHEMA, line: 1, severity: "fatal", message: "Orchestration schema must carry task-template and map-package proof metadata." })];
    }
  }

  return [];
};

const inspectCommanderConsumers = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const taskTemplateRegistrySource = getSource(project, TASK_TEMPLATE_REGISTRY);

  if (!hasCallExpression(taskTemplateRegistrySource, "listOrdinaryTaskTemplates") || hasCallExpression(taskTemplateRegistrySource, "getTaskTemplateDeveloperBinding")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-005-V1", file: TASK_TEMPLATE_REGISTRY, line: 1, severity: "fatal", message: "Commander task-template registry must consume only ordinary task feed fields for normal launch." }));
  }
  if (!hasTaskStartDelegation(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: TASK_API_HANDLERS, line: 1, severity: "fatal", message: "Task API must delegate /api/tasks/start through the dedicated task-start control path before mission dispatch." }));
  }
  if (!hasGovernedTaskStartBindingResolution(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: TASK_START_FLOW, line: 1, severity: "fatal", message: "Task start flow must resolve approved launch bindings through the governed active registry before mission dispatch." }));
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: TASK_START_BINDING, line: 1, severity: "fatal", message: "Task start binding must source approved launch records from the governed active registry." }));
  }

  return findings;
};

const inspectConsumerSources = async (project: Project): Promise<Finding[]> => {
  return [
    ...inspectSelectionGateSource(project),
    ...(await inspectOrchestrationSchema()),
    ...inspectCommanderConsumers(project),
  ];
};

const inspectBootstrappedRegistry = (): Finding[] => {
  const findings: Finding[] = [];
  const registry = createBootstrappedRegistry();
  const ordinaryTemplates = registry.active.listOrdinaryTaskTemplates();

  if (ordinaryTemplates.length === 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-005-V1", file: ACTIVE_MAP_REGISTRY, line: 1, severity: "fatal", message: "Active registry must expose ordinary task templates after builtin bootstrap." }));
  }
  if (ordinaryTemplates.some((template) => "mapId" in (template as object) || "requestedPlatformId" in (template as object))) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-005-V1", file: ACTIVE_MAP_REGISTRY, line: 1, severity: "fatal", message: "Ordinary task-template feed must not expose mapId or requestedPlatformId as public fields." }));
  }
  if (ordinaryTemplates.some((template) => template.availability !== "ready")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-005-V1", file: ACTIVE_MAP_REGISTRY, line: 1, severity: "fatal", message: "Draft, quarantined, disabled, or rejected maps must not appear in the ordinary runnable task-template feed." }));
  }

  return findings;
};

const inspectScorecard = async (): Promise<Finding[]> => {
  const scorecardText = await readTextFile(pathFromRepoRoot(SCORECARD_PATH));
  return scorecardText.includes("MAP_PLUGIN_ORCHESTRATION_INTEGRATION_READY_TO_ESTABLISH")
    ? []
    : [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: SCORECARD_PATH, line: 1, severity: "error", message: "Integration scorecard must declare the ready-to-establish target state." })];
};

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectMissingIntegrationFiles()),
    ...(await inspectPackageSchemas()),
    ...inspectActiveRegistrySource(project),
    ...(await inspectConsumerSources(project)),
    ...inspectBootstrappedRegistry(),
    ...(await inspectScorecard()),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Map-plugin integration required schema, registry, task-template, and proof shape are established."
        : "Map-plugin integration required schema, registry, task-template, or proof shape is incomplete.",
    ),
  };
}
