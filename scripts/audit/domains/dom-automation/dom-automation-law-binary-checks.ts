import { readFileSync } from "node:fs";
import { pathFromRepoRoot } from "../../core/paths.js";
import { loadDomAutomationAuditProject } from "./components/collect-dom-automation-project.js";
import type { ClauseCheckOutcome, DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import type { LawEnforcementMatrixItem } from "./dom-automation-law-enforcement-types.js";
import { fail, runCommand } from "./dom-automation-binary-outcome.js";
import { checkLaw001Sovereignty, checkLaw002SnapshotSummary, checkLaw003LocatorSemantic, checkLaw004FillApprovedText, checkLaw005ClickLocatedElement } from "./dom-automation-law-checks-001-005.js";
import { checkLaw006UploadApprovedFile, checkLaw007VerifyEvidence, checkLaw008PluginBoundary, checkLaw009ReviewBoundary, checkLaw010EvidenceLogging } from "./dom-automation-law-checks-006-010.js";
import { checkBlueprintStructure, checkBlueprintCatalog, checkBlueprintCommands, checkCiUniqueEntry } from "./dom-automation-blueprint-checks.js";

const CHECKS: Record<string, (context: DomAutomationBinaryCheckContext) => ClauseCheckOutcome | Promise<ClauseCheckOutcome>> = {
  "law001.sovereignty": checkLaw001Sovereignty,
  "law002.snapshot-summary": checkLaw002SnapshotSummary,
  "law003.locator-semantic": checkLaw003LocatorSemantic,
  "law004.fill-approved-text": checkLaw004FillApprovedText,
  "law005.click-located-element": checkLaw005ClickLocatedElement,
  "law006.upload-approved-file": checkLaw006UploadApprovedFile,
  "law007.verify-evidence": checkLaw007VerifyEvidence,
  "law008.plugin-boundary": checkLaw008PluginBoundary,
  "law009.review-boundary": checkLaw009ReviewBoundary,
  "law010.evidence-logging": checkLaw010EvidenceLogging,
  "blueprint.structure": checkBlueprintStructure,
  "blueprint.catalog": checkBlueprintCatalog,
  "blueprint.commands": checkBlueprintCommands,
  "ci.unique-entry": checkCiUniqueEntry,
  "runtime_smoke.dom-automation": async () => await runCommand(["npm", "run", "acceptance:dom-automation-smoke"]),
  "runtime_smoke.amazon-agent-start": async () => await runCommand(["npm", "run", "acceptance:amazon-invoice-agent-start-smoke"]),
  "runtime_smoke.amazon-upload": async () => await runCommand(["npm", "run", "acceptance:amazon-invoice-upload-smoke"]),
  "runtime_smoke.amazon-upload-complete": async () => await runCommand(["npm", "run", "acceptance:amazon-invoice-upload-complete-smoke"]),
};

export const createDomAutomationBinaryCheckContext = (): DomAutomationBinaryCheckContext => ({
  auditProject: loadDomAutomationAuditProject(),
  packageJson: JSON.parse(readFileSync(pathFromRepoRoot("package.json"), "utf8")) as { scripts?: Record<string, string> },
  manifest: JSON.parse(readFileSync(pathFromRepoRoot("scripts/audit/domains/dom-automation/manifest.json"), "utf8")) as { allowedLawIds?: string[] },
  memo: new Map<string, ClauseCheckOutcome>(),
});

export async function evaluateDomAutomationMatrixItem(
  item: LawEnforcementMatrixItem,
  context: DomAutomationBinaryCheckContext,
): Promise<ClauseCheckOutcome> {
  const cached = context.memo.get(item.inspectorName);
  if (cached) {
    return cached;
  }
  const check = CHECKS[item.inspectorName];
  const result = check
    ? await check(context)
    : fail(`missing inspector implementation: ${item.inspectorName}`, `No evaluator is registered for ${item.inspectorName}`);
  context.memo.set(item.inspectorName, result);
  return result;
}
