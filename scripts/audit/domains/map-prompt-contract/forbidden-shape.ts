import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasIdentifier, hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { createMapPromptContractAuditProject, getSource, loadBuiltinPackage } from "./ast-utils.js";

const LAW_ID = "GRASSEYE-MAP-PLUGIN-010-V1";
const FORBIDDEN_FRAGMENTS = ["expectedOutputSchema", "rawPrompt", "systemPrompt", "userPrompt", "executablePromptLogic"];

const inspectPromptBindingSchema = (project: ReturnType<typeof createMapPromptContractAuditProject>): Finding[] => {
  const promptBindingSchema = getSource(project, "src/map-plugins/schema/prompt-bindings.schema.ts");
  return hasLiteralTextFragment(promptBindingSchema, "expectedOutputSchema")
    ? [createFinding({ lawId: LAW_ID, file: "src/map-plugins/schema/prompt-bindings.schema.ts", line: 1, severity: "error", message: "Legacy expectedOutputSchema field is still present in prompt binding schema." })]
    : [];
};

const inspectPromptInlineGuards = (project: ReturnType<typeof createMapPromptContractAuditProject>): Finding[] => {
  const mapSecurityValidator = getSource(project, "src/map-plugins/validation/map-security-validator.ts");
  const authoringTemplate = getSource(project, "src/map-plugins/authoring/map-authoring-template.ts");
  const validatorGuardsForbiddenKeys = FORBIDDEN_FRAGMENTS.slice(1).every((fragment) => hasLiteralTextFragment(mapSecurityValidator, fragment));
  const authoringTemplateForbidsPromptInlining = FORBIDDEN_FRAGMENTS.slice(1).every((fragment) => hasLiteralTextFragment(authoringTemplate, fragment));

  return !validatorGuardsForbiddenKeys || !authoringTemplateForbidsPromptInlining || !hasIdentifier(mapSecurityValidator, "FORBIDDEN_KEYS")
    ? [createFinding({ lawId: LAW_ID, file: "src/map-plugins/validation/map-security-validator.ts", line: 1, severity: "error", message: "Map security or authoring policy no longer blocks raw prompt fields and executable prompt logic." })]
    : [];
};

const inspectBuiltinPackages = async (): Promise<Finding[]> => {
  const builtins = await Promise.all([
    loadBuiltinPackage("src/map-plugins/builtins/tiktok-product-discovery.map-package.json"),
    loadBuiltinPackage("src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json"),
  ]);

  return builtins.some((builtin) => FORBIDDEN_FRAGMENTS.some((fragment) => builtin.text.includes(fragment)))
    ? [createFinding({ lawId: LAW_ID, file: "src/map-plugins/builtins", line: 1, severity: "fatal", message: "Built-in map packages still contain forbidden prompt-inline or legacy prompt schema fields." })]
    : [];
};

export async function runForbiddenShape(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = createMapPromptContractAuditProject();
  const findings = [
    ...inspectPromptBindingSchema(project),
    ...inspectPromptInlineGuards(project),
    ...(await inspectBuiltinPackages()),
  ];

  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Raw prompt fields, executable prompt logic, and legacy prompt binding keys are blocked across map prompt governance surfaces."
        : "Forbidden prompt-inline or legacy prompt binding fields remain reachable.",
    ),
  };
}