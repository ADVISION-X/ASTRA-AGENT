import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasIdentifier, hasImportModuleSpecifier, hasPropertyNamed } from "../_shared/ast-helpers.js";
import { createMapPromptContractAuditProject, findMissingFiles, getSource, loadBuiltinPackage } from "./ast-utils.js";

const LAW_ID = "GRASSEYE-MAP-PLUGIN-008-V1";

export async function runRequiredShape(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await findMissingFiles();
  for (const missingFile of missingFiles) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: missingFile,
      line: 1,
      severity: "fatal",
      message: "Required map prompt contract governance file is missing.",
    }));
  }

  const project = createMapPromptContractAuditProject();
  const promptBindingSchema = getSource(project, "src/map-plugins/schema/prompt-bindings.schema.ts");
  const manifestSchema = getSource(project, "src/map-plugins/schema/map-plugin-manifest.schema.ts");
  const validator = getSource(project, "src/map-plugins/validation/map-prompt-contract-validator.ts");
  const authoringTemplate = getSource(project, "src/map-plugins/authoring/map-authoring-template.ts");

  const schemaHasRequiredFields = hasPropertyNamed(promptBindingSchema, "requiredInputRefs")
    && hasPropertyNamed(promptBindingSchema, "outputSchemaRef");
  const manifestHasGovernanceFields = [
    "authoringPromptRef",
    "authoringModelRef",
    "capabilityCatalogVersion",
    "promptCatalogVersion",
    "validationReportRef",
    "humanApprovalRef",
  ].every((fieldName) => hasPropertyNamed(manifestSchema, fieldName));
  const validatorHasCatalogHooks = hasIdentifier(validator, "tryGetPromptContractCatalogEntry")
    && hasIdentifier(validator, "AI_TASK_TYPE_BY_CHILD_CAPABILITY_ID");
  const authoringTemplateHasCatalogImports = hasImportModuleSpecifier(authoringTemplate, "prompt-contracts")
    && hasImportModuleSpecifier(authoringTemplate, "capability-catalog");

  const builtins = await Promise.all([
    loadBuiltinPackage("src/map-plugins/builtins/tiktok-product-discovery.map-package.json"),
    loadBuiltinPackage("src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json"),
  ]);
  const builtinsPass = builtins.every((record) => record.mapPackage !== null && record.issues.length === 0);

  if (!schemaHasRequiredFields || !manifestHasGovernanceFields || !validatorHasCatalogHooks || !authoringTemplateHasCatalogImports || !builtinsPass) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/map-plugins/validation/map-prompt-contract-validator.ts",
      line: 1,
      severity: "error",
      message: "Map prompt contract governance shape is incomplete across schema, validator, authoring, or built-in package validation.",
    }));
  }

  return {
    findings,
    phase: createPhase(
      "required-shape",
      findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      findings.length === 0,
      findings.length === 0
        ? "Map prompt contract required schema, validator, authoring, and built-in package validation surfaces are present."
        : "Map prompt contract required schema or validation surfaces drifted from the governed design.",
    ),
  };
}