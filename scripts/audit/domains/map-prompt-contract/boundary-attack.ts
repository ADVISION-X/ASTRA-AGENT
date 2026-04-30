import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasImportModuleSpecifier, hasLiteralTextFragment } from "../_shared/ast-helpers.js";
import { createMapPromptContractAuditProject, getSource } from "./ast-utils.js";

const LAW_ID = "GRASSEYE-MAP-PLUGIN-011-V1";

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = createMapPromptContractAuditProject();
  const validator = getSource(project, "src/map-plugins/validation/map-prompt-contract-validator.ts");
  const authoringBuilder = getSource(project, "src/map-plugins/authoring/map-authoring-prompt-builder.ts");

  if (!hasImportModuleSpecifier(validator, "capabilities/ai/prompt-contracts") || hasLiteralTextFragment(validator, "raw prompt")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/map-plugins/validation/map-prompt-contract-validator.ts",
      line: 1,
      severity: "error",
      message: "Prompt contract validator must read governed prompt contracts and must not reintroduce raw prompt branching logic.",
    }));
  }

  if (!hasImportModuleSpecifier(authoringBuilder, "capability-catalog") || !hasImportModuleSpecifier(authoringBuilder, "prompt-contracts")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/map-plugins/authoring/map-authoring-prompt-builder.ts",
      line: 1,
      severity: "error",
      message: "Map authoring builder must source capability and prompt-contract data from governed catalogs.",
    }));
  }

  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      findings.length === 0,
      findings.length === 0
        ? "Prompt contract governance stays on catalog-driven boundaries for validation and authoring."
        : "Prompt contract governance drifted away from catalog-driven boundaries.",
    ),
  };
}