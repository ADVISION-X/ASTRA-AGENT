import type { Project } from "ts-morph";
import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getSource } from "./audit-project.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";

const FORBIDDEN_FIELDS = ["defaultRunLimit", "maxAllowedRunLimit"] as const;
const FORBIDDEN_SOURCE_FILES = [
  "src/map-plugins/schema/task-template-package.schema.ts",
  "src/map-plugins/shared/map-package-registry-types.ts",
  "src/map-plugins/registry/active-map-registry.ts",
  "src/map-plugins/authoring/map-authoring-ai-output.schema.ts",
  "src/map-plugins/authoring/map-authoring-draft-normalizer.ts",
  "src/capabilities/ai/shared/ai-map-authoring-fallback.ts",
] as const;

function getTaskTemplateRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || !("taskTemplate" in raw)) {
    return null;
  }
  const taskTemplate = raw.taskTemplate;
  return taskTemplate && typeof taskTemplate === "object" ? taskTemplate as Record<string, unknown> : null;
}

async function collectBuiltinFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const record of await loadBuiltinPackageRecords()) {
    const taskTemplate = getTaskTemplateRecord(record.raw);
    if (!taskTemplate) {
      continue;
    }

    for (const fieldName of FORBIDDEN_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(taskTemplate, fieldName)) {
        findings.push(createFinding({
          lawId: MAP_PLUGIN_LAWS.SCHEMA,
          file: record.file,
          line: 1,
          severity: "fatal",
          message: `Map taskTemplate must not own run-limit field ${fieldName}; app settings are the only owner.`,
        }));
      }
    }
  }

  return findings;
}

function collectSourceFindings(project: Project): Finding[] {
  return FORBIDDEN_SOURCE_FILES.flatMap((filePath) => {
    const source = getSource(project, filePath);
    const identifiers = new Set(source.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
    return FORBIDDEN_FIELDS.flatMap((fieldName) => {
      return identifiers.has(fieldName)
        ? [createFinding({
            lawId: MAP_PLUGIN_LAWS.SCHEMA,
            file: filePath,
            line: 1,
            severity: "fatal",
            message: `Map package governance sources must not define or forward task-template run-limit field ${fieldName}.`,
          })]
        : [];
    });
  });
}

export async function runTaskTemplateRunLimitGovernance(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await collectBuiltinFindings()),
    ...collectSourceFindings(project),
  ];
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "task-template-run-limit-governance",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Map packages no longer own run-limit defaults or maxima; task-template run limits are app-owned only."
        : "Map package governance still exposes task-template-owned run-limit defaults or maxima.",
    ),
  };
}