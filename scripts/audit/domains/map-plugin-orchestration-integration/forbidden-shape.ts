import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { missingFiles } from "./audit-files.js";
import { LEGACY_STATIC_MAP_FILES } from "./file-lists.js";

const OPERATIONAL_MAP_PACKAGE_SCHEMA = "src/map-plugins/schema/operational-map-package.schema.ts";
const TASK_TEMPLATE_PACKAGE_SCHEMA = "src/map-plugins/schema/task-template-package.schema.ts";
const MAP_SELECTION_GATE = "src/capabilities/orchestration/runtime/map-selection-gate.ts";
const COMMANDER_TYPES = "src/features/commander-console/types.ts";
const COMMANDER_SHELL = "src/features/commander-console/commander-console-shell-client.ts";

const inspectPackageSchemaImports = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const operationalMapPackageText = await readTextFile(pathFromRepoRoot(OPERATIONAL_MAP_PACKAGE_SCHEMA));
  const taskTemplatePackageText = await readTextFile(pathFromRepoRoot(TASK_TEMPLATE_PACKAGE_SCHEMA));

  if (operationalMapPackageText.includes("../../capabilities/orchestration/schema.js")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: OPERATIONAL_MAP_PACKAGE_SCHEMA, line: 1, severity: "fatal", message: "Operational map package schema must not import orchestration/schema as package authority." }));
  }
  if (taskTemplatePackageText.includes("../../capabilities/orchestration/schema.js")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: TASK_TEMPLATE_PACKAGE_SCHEMA, line: 1, severity: "fatal", message: "Task template package schema must not import orchestration/schema for platform ids." }));
  }

  return findings;
};

const inspectSelectionGateFragments = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const mapSelectionText = await readTextFile(pathFromRepoRoot(MAP_SELECTION_GATE));

  for (const fragment of ["resolvePreferredMapId", "platform_policy", "createStaticOrchestrationMapStore"]) {
    if (mapSelectionText.includes(fragment)) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: MAP_SELECTION_GATE, line: 1, severity: "fatal", message: `Map selection gate must not preserve forbidden integration fragment ${fragment}.` }));
    }
  }

  return findings;
};

const inspectCommanderBindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const commanderTypesText = await readTextFile(pathFromRepoRoot(COMMANDER_TYPES));
  const commanderShellText = await readTextFile(pathFromRepoRoot(COMMANDER_SHELL));

  if (commanderTypesText.includes("mapBinding:")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-005-V1", file: COMMANDER_TYPES, line: 1, severity: "fatal", message: "Commander task-template public type must not expose mapBinding on the ordinary contract." }));
  }

  for (const fragment of ["template.mapBinding.mapId", "template.mapBinding.requestedPlatformId", "draft.selectedMapId", "draft.requestedPlatformId"]) {
    if (commanderShellText.includes(fragment)) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: COMMANDER_SHELL, line: 1, severity: "fatal", message: `Commander shell must not depend on ordinary-mode binding fragment ${fragment}.` }));
    }
  }

  return findings;
};

const inspectLegacyStaticMaps = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const legacyFile of LEGACY_STATIC_MAP_FILES) {
    const missing = await missingFiles([legacyFile]);
    if (missing.length === 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1", file: legacyFile, line: 1, severity: "fatal", message: "Legacy static TypeScript map must not survive in active source truth." }));
    }
  }

  return findings;
};

export async function runForbiddenShape(_project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectPackageSchemaImports()),
    ...(await inspectSelectionGateFragments()),
    ...(await inspectCommanderBindings()),
    ...(await inspectLegacyStaticMaps()),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Forbidden reverse-schema imports, platform fallback paths, ordinary mapBinding surfaces, and legacy static maps are gone."
        : "Reverse-schema imports, platform fallback, ordinary mapBinding exposure, or legacy static maps still survive.",
    ),
  };
}