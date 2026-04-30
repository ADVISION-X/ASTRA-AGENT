import type { Project } from "ts-morph";

import { loadBuiltinMapPackages } from "../../../../src/map-plugins/builtins/index.js";
import { MapPluginRegistry } from "../../../../src/map-plugins/registry/map-plugin-registry.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasPropertyAccessPath } from "../_shared/ast-helpers.js";
import {
  BUILTIN_PACKAGE_FILES,
  REQUIRED_SOURCE_FILES,
  ROOT,
  getSource,
  loadBuiltinPackageRecords,
  missingFiles,
} from "./ast-utils.js";

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];

  for (const filePath of await missingFiles(REQUIRED_SOURCE_FILES)) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-003-V1",
      file: filePath,
      line: 1,
      severity: "fatal",
      message: "Map package required source or builtin file is missing.",
    }));
  }

  const builtinRecords = await loadBuiltinPackageRecords();
  for (const record of builtinRecords) {
    if (record.parseError) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-003-V1",
        file: record.file,
        line: 1,
        severity: "fatal",
        message: `Builtin map package must parse under the governed schema: ${record.parseError}`,
      }));
      continue;
    }

    if (!record.mapPackage) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-003-V1",
        file: record.file,
        line: 1,
        severity: "fatal",
        message: "Builtin map package parsed to null unexpectedly.",
      }));
      continue;
    }

    if (record.mapPackage.manifest.aiGenerated) {
      if (record.mapPackage.manifest.approvalStatus !== "draft" || record.mapPackage.taskTemplate.availabilityPolicy !== "draft") {
        findings.push(createFinding({
          lawId: "GRASSEYE-MAP-PLUGIN-006-V1",
          file: record.file,
          line: 1,
          severity: "fatal",
          message: "AI-generated map packages must remain draft-only until later governed approval flow exists.",
        }));
      }
    } else if (record.validationIssues.length > 0) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-003-V1",
        file: record.file,
        line: 1,
        severity: "fatal",
        message: `Approved builtin map package must clear validation. Found ${record.validationIssues.length} validation issues.`,
      }));
    }
  }

  if (builtinRecords.length !== BUILTIN_PACKAGE_FILES.length) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-003-V1",
      file: `${ROOT}/builtins/index.ts`,
      line: 1,
      severity: "fatal",
      message: "Builtin loader and builtin package file set drifted.",
    }));
  }

  const builtinsIndexSource = getSource(project, `${ROOT}/builtins/index.ts`);
  if (!hasCallExpressionPath(builtinsIndexSource, ["MapPackageSchema", "parse"])) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-003-V1",
      file: `${ROOT}/builtins/index.ts`,
      line: 1,
      severity: "fatal",
      message: "Builtin loader must parse builtin packages through MapPackageSchema.parse.",
    }));
  }

  const importerSource = getSource(project, `${ROOT}/import/map-package-importer.ts`);
  if (!hasCallExpression(importerSource, "validateMapPackage")
    || !hasPropertyAccessPath(importerSource, ["input", "registry", "versions", "set"])
    || !hasPropertyAccessPath(importerSource, ["input", "registry", "quarantined", "set"])) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-002-V1",
      file: `${ROOT}/import/map-package-importer.ts`,
      line: 1,
      severity: "fatal",
      message: "Map package import must validate first, store the package version, and enter quarantine.",
    }));
  }

  const activationSource = getSource(project, `${ROOT}/import/map-package-activation.ts`);
  if (!hasPropertyAccessPath(activationSource, ["input", "registry", "activations", "write"])
    || !hasPropertyAccessPath(activationSource, ["input", "registry", "active", "activate"])
    || !hasPropertyAccessPath(activationSource, ["input", "registry", "quarantined", "delete"])) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-002-V1",
      file: `${ROOT}/import/map-package-activation.ts`,
      line: 1,
      severity: "fatal",
      message: "Map package activation must create an activation record, enter the active registry, and leave quarantine.",
    }));
  }

  const rollbackSource = getSource(project, `${ROOT}/import/map-package-rollback.ts`);
  if (!hasPropertyAccessPath(rollbackSource, ["input", "registry", "active", "deactivate"])
    || !hasPropertyAccessPath(rollbackSource, ["input", "registry", "rollbacks", "write"])) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-002-V1",
      file: `${ROOT}/import/map-package-rollback.ts`,
      line: 1,
      severity: "fatal",
      message: "Map package rollback must deactivate the active map and persist a rollback record.",
    }));
  }

  try {
    const registry = new MapPluginRegistry();
    for (const builtinPackage of loadBuiltinMapPackages()) {
      registry.importPackage(builtinPackage, "audit-required-shape");
      if (builtinPackage.manifest.approvalStatus === "approved" && builtinPackage.taskTemplate.availabilityPolicy === "active") {
        registry.activatePackage(
          builtinPackage.manifest.packageId,
          builtinPackage.manifest.packageVersion,
          "audit-required-shape",
          "audit bootstrap",
        );
      }
    }

    const activePackages = registry.active.listActivePackages();
    if (activePackages.length < 2) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-002-V1",
        file: `${ROOT}/registry/map-plugin-registry.ts`,
        line: 1,
        severity: "fatal",
        message: "Approved builtin map packages must bootstrap into the active registry.",
      }));
    }

    const ordinaryTemplates = registry.active.listOrdinaryTaskTemplates();
    if (ordinaryTemplates.some((item) => item.taskTemplateId === "ai-generated-map-placeholder")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-006-V1",
        file: `${ROOT}/registry/active-map-registry.ts`,
        line: 1,
        severity: "fatal",
        message: "AI draft placeholder must never appear in the approved active task-template feed.",
      }));
    }

    if (ordinaryTemplates.some((item) => "mapId" in (item as object) || "requestedPlatformId" in (item as object))) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-005-V1",
        file: `${ROOT}/registry/active-map-registry.ts`,
        line: 1,
        severity: "fatal",
        message: "Ordinary task-template feed must not expose internal map binding fields.",
      }));
    }

    if (activePackages.some((mapPackage) => mapPackage.manifest.aiGenerated)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-006-V1",
        file: `${ROOT}/registry/active-map-registry.ts`,
        line: 1,
        severity: "fatal",
        message: "AI-generated map packages must not enter the active registry.",
      }));
    }

    if (!registry.active.getTaskTemplateDeveloperBinding("tiktok-product-discovery")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-MAP-PLUGIN-002-V1",
        file: `${ROOT}/registry/active-map-registry.ts`,
        line: 1,
        severity: "fatal",
        message: "Active registry must resolve a developer binding for an approved task template.",
      }));
    }
  } catch (error) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MAP-PLUGIN-003-V1",
      file: `${ROOT}/registry/map-plugin-registry.ts`,
      line: 1,
      severity: "fatal",
      message: error instanceof Error ? error.message : "Map registry bootstrap failed during audit.",
    }));
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Map package schema, quarantine lifecycle, builtin payloads, and registry bootstrap are present."
        : "Map package schema, builtin payload, or lifecycle enforcement shape is incomplete.",
    ),
  };
}
