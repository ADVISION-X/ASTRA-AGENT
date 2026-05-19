import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  DOM_AUTOMATION_AUDIT_PLAN,
  DOM_AUTOMATION_BLUEPRINT_SECTION_IDS,
  DOM_AUTOMATION_LAW_IDS,
  type DomAutomationAuditClause,
} from "../dom-automation-audit-plan.js";
import {
  buildValidationResult,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

const PLAN_PATH = "scripts/audit/domains/dom-automation/dom-automation-audit-plan.ts";

const coverageFinding = (
  lawId: string,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file: PLAN_PATH,
  line: 1,
  severity: "fatal",
  message,
  hint,
});

export const validateAuditPlanCoverage = (input: {
  implementedPhases: readonly string[];
  coveredClauseIds: readonly string[];
}): DomAutomationValidationResult => {
  const findings: Finding[] = [];
  const planClauseIds = new Set<string>();
  const planLawIds = new Set<string>();
  const planBlueprintIds = new Set<string>();

  for (const clause of DOM_AUTOMATION_AUDIT_PLAN) {
    if (planClauseIds.has(clause.clauseId)) {
      findings.push(coverageFinding(clause.lawId, `duplicate audit plan clauseId: ${clause.clauseId}`, "Keep every DOM audit clauseId unique."));
      continue;
    }
    planClauseIds.add(clause.clauseId);
    if (clause.source === "law") {
      planLawIds.add(clause.lawId);
    }
    if (clause.source === "blueprint") {
      planBlueprintIds.add(clause.clauseId);
    }
    if (!input.implementedPhases.includes(clause.inspectorPhase)) {
      findings.push(coverageFinding(clause.lawId, `audit plan phase is not implemented: ${clause.inspectorPhase}`, "Bind every DOM audit clause to a real inspector phase."));
    }
  }

  for (const lawId of DOM_AUTOMATION_LAW_IDS) {
    if (!planLawIds.has(lawId)) {
      findings.push(coverageFinding(lawId, `lawId is missing from DOM audit plan: ${lawId}`, "Map every active DOM law to the audit plan."));
    }
  }
  for (const blueprintSectionId of DOM_AUTOMATION_BLUEPRINT_SECTION_IDS) {
    if (!planBlueprintIds.has(blueprintSectionId)) {
      findings.push(coverageFinding("GRASSEYE-DOM-001-V1", `blueprint section is missing from DOM audit plan: ${blueprintSectionId}`, "Map every DOM blueprint section to the audit plan."));
    }
  }

  const covered = new Set(input.coveredClauseIds);
  for (const clause of DOM_AUTOMATION_AUDIT_PLAN) {
    if (!covered.has(clause.clauseId)) {
      findings.push(coverageFinding(clause.lawId, `audit clause has no active inspector coverage: ${clause.clauseId}`, "Every active DOM audit clause must be covered by at least one validator."));
    }
  }

  const coveredLawIds = new Set(
    DOM_AUTOMATION_AUDIT_PLAN
      .filter((clause): clause is DomAutomationAuditClause => clause.source === "law" && covered.has(clause.clauseId))
      .map((clause) => clause.lawId),
  );
  const coveredBlueprintSections = new Set(
    DOM_AUTOMATION_AUDIT_PLAN
      .filter((clause) => clause.source === "blueprint" && covered.has(clause.clauseId))
      .map((clause) => clause.clauseId),
  );

  return buildValidationResult({
    name: "audit-plan-coverage",
    findings,
    coveredClauseIds: DOM_AUTOMATION_AUDIT_PLAN.map((clause) => clause.clauseId),
    passSummary: `lawIdsCovered=${coveredLawIds.size}/${DOM_AUTOMATION_LAW_IDS.length} blueprintSectionsCovered=${coveredBlueprintSections.size}/${DOM_AUTOMATION_BLUEPRINT_SECTION_IDS.length} activeClausesCovered=${covered.size}/${DOM_AUTOMATION_AUDIT_PLAN.length}`,
    failSummary: "law and blueprint coverage matrix is incomplete.",
    failureClassification: "ENFORCEMENT GAP",
  });
};