import { existsSync } from "node:fs";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { ClauseCheckOutcome, DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import { pass, fail, sourceText } from "./dom-automation-binary-helpers.js";
import { DOM_ACTION_CODES, DOM_REQUIRED_PATHS, PLUGIN_REQUIRED_PATHS } from "./dom-automation-binary-constants.js";

export const checkBlueprintStructure = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const missing = [...DOM_REQUIRED_PATHS, ...PLUGIN_REQUIRED_PATHS].filter((repoPath) => !existsSync(pathFromRepoRoot(repoPath)));
  return missing.length === 0
    ? pass("blueprint structure paths for DOM runtime, plugin orchestration, and acceptance smoke files all exist")
    : fail("Blueprint structure check failed", `missing blueprint path: ${missing[0]}`);
};

export const checkBlueprintCatalog = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const catalogText = sourceText(context, "src/muscle-memory/catalog.ts");
  const manifestText = sourceText(context, "src/capabilities/dom-automation/manifest.ts");
  const issues: string[] = [];
  if (!catalogText.includes("DOM_AUTOMATION_CATALOG_ENTRIES") || !catalogText.includes("mergeCapabilityCatalogEntries")) {
    issues.push("catalog does not merge DOM entries from source manifest");
  }
  for (const actionCode of DOM_ACTION_CODES) {
    if (!manifestText.includes(actionCode)) {
      issues.push(`manifest is missing DOM actionCode: ${actionCode}`);
    }
  }
  return issues.length === 0
    ? pass("DOM catalog entries are defined in the source manifest and merged into the muscle-memory catalog without generated-file pollution")
    : fail("Blueprint catalog check failed", issues.join("; "));
};

export const checkBlueprintCommands = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const scripts = context.packageJson.scripts ?? {};
  const requiredScripts = [
    "audit:dom-automation",
    "acceptance:dom-automation-smoke",
    "acceptance:amazon-invoice-agent-start-smoke",
    "acceptance:amazon-invoice-upload-smoke",
    "acceptance:amazon-invoice-upload-complete-smoke",
  ] as const;
  const missingScripts = requiredScripts.filter((scriptName) => !scripts[scriptName]);
  return missingScripts.length === 0
    ? pass("package.json exposes the governed DOM audit and acceptance commands declared by the blueprint")
    : fail("Blueprint commands check failed", `missing package script: ${missingScripts[0]}`);
};

export const checkCiUniqueEntry = (context: DomAutomationBinaryCheckContext): ClauseCheckOutcome => {
  const scripts = context.packageJson.scripts ?? {};
  const ciFull = scripts["ci:full"];
  const ciPlanText = sourceText(context, "scripts/audit/core/ci-full-plan.ts");
  const competing = Object.keys(scripts).filter((scriptName) => {
    if (scriptName === "ci:full" || scriptName.startsWith("acceptance:")) {
      return false;
    }
    return /(^|:)(audit-all|audit:full|compliance|complete-audit|full)$/iu.test(scriptName);
  });
  const issues: string[] = [];
  if (!ciFull) {
    issues.push("package.json is missing ci:full");
  }
  if (ciFull && !ciFull.includes("scripts/audit/ci-full.ts")) {
    issues.push("ci:full does not delegate to scripts/audit/ci-full.ts");
  }
  if (competing.length > 0) {
    issues.push(`competing complete quality gate detected: ${competing.join(", ")}`);
  }
  if (!ciPlanText.includes("buildOwnerSteps") || !ciPlanText.includes("loadOwnerManifests") || !ciPlanText.includes("manifest.capabilityDomain !== \"audit-system\"")) {
    issues.push("ci-full owner plan does not load governed owner manifests");
  }
  if (!existsSync(pathFromRepoRoot("scripts/audit/domains/dom-automation/manifest.json"))) {
    issues.push("dom-automation owner manifest is missing from ci-full owner graph");
  }
  return issues.length === 0
    ? pass("ci:full is the only complete gate, delegates to scripts/audit/ci-full.ts, and pulls dom-automation through the governed owner-manifest plan")
    : fail("CI unique-entry check failed", issues.join("; "));
};

