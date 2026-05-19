import { readFileSync } from "node:fs";

import { pathFromRepoRoot } from "../../core/paths.js";
import { finalizeInspectorResult, createFinding } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorResult } from "../../core/schema.js";
import {
  DOM_AUTOMATION_AUDIT_PLAN,
  DOM_AUTOMATION_BLUEPRINT_SECTION_IDS,
  DOM_AUTOMATION_LAW_IDS,
} from "./dom-automation-audit-plan.js";
import { loadDomAutomationAuditProject } from "./components/collect-dom-automation-project.js";
import { validateAcceptanceRuntime } from "./components/validate-acceptance-runtime.js";
import { validateAuditPlanCoverage } from "./components/validate-audit-plan-coverage.js";
import { validateCatalogRegistry } from "./components/validate-catalog-registry.js";
import { validateCiEntry } from "./components/validate-ci-entry.js";
import { validateImportBoundaries } from "./components/validate-import-boundaries.js";
import { validatePhaseCoverage } from "./components/validate-phase-coverage.js";
import { validateRuntimeContracts } from "./components/validate-runtime-contracts.js";
import { validateSensitiveDataAntiEscape } from "./components/validate-sensitive-data-anti-escape.js";
import { validateStructure } from "./components/validate-structure.js";
import { validateSymbolBoundaries } from "./components/validate-symbol-boundaries.js";

const MANIFEST_PATH = pathFromRepoRoot("scripts/audit/domains/dom-automation/manifest.json");

const manifestFinding = (
  lawId: string,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file: "scripts/audit/domains/dom-automation/manifest.json",
  line: 1,
  severity: "fatal",
  message,
  hint,
});

const validateManifest = (): Finding[] => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    capabilityDomain?: string;
    allowedLawIds?: string[];
    entry?: string;
  };
  const findings: Finding[] = [];
  if (manifest.capabilityDomain !== "dom-automation") {
    findings.push(manifestFinding("GRASSEYE-DOM-001-V1", "manifest capabilityDomain is not dom-automation", "Bind the owner manifest to the dom-automation capability domain."));
  }
  for (const lawId of DOM_AUTOMATION_LAW_IDS) {
    if (!(manifest.allowedLawIds ?? []).includes(lawId)) {
      findings.push(manifestFinding(lawId, `manifest allowedLawIds is missing ${lawId}`, "Authorize every active DOM law in the owner manifest."));
    }
  }
  if (manifest.entry !== "scripts/audit/domains/dom-automation/inspector.ts") {
    findings.push(manifestFinding("GRASSEYE-DOM-001-V1", "manifest entry does not point at the DOM owner inspector", "Keep the DOM owner manifest bound to scripts/audit/domains/dom-automation/inspector.ts."));
  }
  return findings;
};

export async function runDomAutomationInspector(_context: InspectorContext): Promise<InspectorResult> {
  const auditProject = loadDomAutomationAuditProject();
  const manifestFindings = validateManifest();
  const validatorResults = [
    validateStructure(),
    validateImportBoundaries(auditProject),
    validateSymbolBoundaries(auditProject),
    validateSensitiveDataAntiEscape(auditProject),
    validateRuntimeContracts(auditProject),
    validateCatalogRegistry(auditProject),
    validateCiEntry(auditProject),
    validateAcceptanceRuntime(auditProject),
    validatePhaseCoverage(auditProject),
  ];
  const coverageResult = validateAuditPlanCoverage({
    implementedPhases: validatorResults.map((result) => result.phase.name),
    coveredClauseIds: validatorResults.flatMap((result) => result.coveredClauseIds),
  });
  const allFindings = [
    ...manifestFindings,
    ...validatorResults.flatMap((result) => result.findings),
    ...coverageResult.findings,
  ];
  const allPhases = [
    ...validatorResults.map((result) => result.phase),
    coverageResult.phase,
  ];
  const coveredClauseIds = new Set<string>([
    ...validatorResults.flatMap((result) => result.coveredClauseIds),
    ...coverageResult.coveredClauseIds,
  ]);
  const coveredLawIds = new Set(
    DOM_AUTOMATION_AUDIT_PLAN
      .filter((clause) => clause.source === "law" && coveredClauseIds.has(clause.clauseId))
      .map((clause) => clause.lawId),
  );
  const coveredBlueprintSections = new Set(
    DOM_AUTOMATION_AUDIT_PLAN
      .filter((clause) => clause.source === "blueprint" && coveredClauseIds.has(clause.clauseId))
      .map((clause) => clause.clauseId),
  );

  return finalizeInspectorResult({
    inspector: "dom-automation",
    inspectorId: "dom-automation-owner",
    capabilityDomain: "dom-automation",
    findings: allFindings,
    phases: allPhases,
    summary: `lawIdsCovered=${coveredLawIds.size}/${DOM_AUTOMATION_LAW_IDS.length} blueprintSectionsCovered=${coveredBlueprintSections.size}/${DOM_AUTOMATION_BLUEPRINT_SECTION_IDS.length} activeClausesCovered=${coveredClauseIds.size}/${DOM_AUTOMATION_AUDIT_PLAN.length}`,
  });
}
