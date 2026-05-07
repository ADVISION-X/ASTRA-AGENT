import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Project } from "ts-morph";

import { createPhase } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { inspectInputPackageSchema } from "./authoring-input-package-schema-checks.js";
import { createAuthoringFinding } from "./authoring-input-package-shared.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import {
  MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE,
  MAP_AUTHORING_USER_PROMPT_TEMPLATE,
} from "../../../../src/map-plugins/authoring/map-authoring-template.js";

const INPUT_PACKAGE_BUILDER_FILE = "src/map-plugins/authoring/map-authoring-input-package-builder.ts";
const PROMPT_BUILDER_FILE = "src/map-plugins/authoring/map-authoring-prompt-builder.ts";
const PROMPT_TEMPLATE_FILE = "src/map-plugins/authoring/map-authoring-template.ts";
const AI_INPUT_SCHEMA_FILE = "src/capabilities/ai/schema-map-authoring.schema.ts";
const MAP_LAB_REQUEST_FILE = "src/lib/local-runtime/map-lab/map-lab-draft-request.ts";
const MAP_AUTHORING_PROMPT_CONTRACT_FILE = "src/capabilities/ai/prompt-contracts/builtins/map.authoring.v1.prompt-contract.json";
const AUTOMATION_NO_HUMAN_REVIEW_RULE = "自动化地图，严厉禁止加入任何人工审查的动作，必须自动化完成。";

const REQUIRED_INPUT_PACKAGE_BUILDER_FIELDS = [
  "capabilityCatalog",
  "promptContractCatalog",
  "outputSchemaCatalog",
  "mapPackageSchema",
  "mapAuthoringOutputSchema",
  "safetyPolicy",
  "automationGatePolicy",
  "evidencePolicy",
  "pavPolicy",
  "forensicsPolicy",
  "privacyPolicy",
  "secretPolicy",
  "rateLimitPolicy",
  "exampleMaps",
  "exampleMapsVersion",
  "exampleMapsSourceRef",
  "validationPolicy",
  "expectedDraftStatus",
] as const;

const inspectInputPackageBuilder = (project: Project): Finding[] => {
  const builderSource = getSource(project, INPUT_PACKAGE_BUILDER_FILE);
  const sourceText = builderSource.getFullText();
  const findings: Finding[] = [];
  const derivesPromptCatalogFromGovernedRegistry = hasCallExpression(builderSource, "listPromptContractCatalogEntries")
    || hasCallExpression(builderSource, "listAiPromptContractCatalogEntries")
    || hasCallExpression(builderSource, "listMapAuthoringGovernedPromptContracts");

  if (!hasCallExpressionPath(builderSource, ["MapAuthoringInputPackageSchema", "parse"])) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must close through MapAuthoringInputPackageSchema.parse.",
    ));
  }
  if (!hasCallExpression(builderSource, "buildCapabilityCatalog") || !derivesPromptCatalogFromGovernedRegistry) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must derive catalogs from governed capability and prompt registries.",
    ));
  }
  if (!builderSource.getFullText().includes('expectedDraftStatus: "draft"')) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must lock expectedDraftStatus=draft.",
    ));
  }
  if (
    !sourceText.includes("binaryOutcomePolicy: buildBinaryOutcomePolicy(request)")
    || !sourceText.includes("productPositiveOutcomeOptions")
    || !sourceText.includes("selectedProductNegativeOutcomeId")
  ) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must carry hardcoded/default binary outcome options from user request into userRequirement and sourceRequirementHash.",
    ));
  }

  const missingBuilderFields = REQUIRED_INPUT_PACKAGE_BUILDER_FIELDS.filter((fieldName) => !sourceText.includes(`${fieldName}:`));
  if (missingBuilderFields.length > 0) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      INPUT_PACKAGE_BUILDER_FILE,
      "Map Authoring Input Package builder must emit every governed top-level field before schema parse.",
      missingBuilderFields.join(", "),
    ));
  }

  return findings;
};

const inspectPromptBuilderBoundary = (project: Project): Finding[] => {
  const promptBuilderSource = getSource(project, PROMPT_BUILDER_FILE);
  const findings: Finding[] = [];

  if (!hasImportModuleSpecifier(promptBuilderSource, "map-authoring-input-package.schema") || !hasCallExpressionPath(promptBuilderSource, ["MapAuthoringInputPackageSchema", "parse"])) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      PROMPT_BUILDER_FILE,
      "Authoring prompt builder must parse a complete Map Authoring Input Package.",
    ));
  }
  if (hasImportModuleSpecifier(promptBuilderSource, "map-authoring-request.schema")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE,
      PROMPT_BUILDER_FILE,
      "Authoring prompt builder must not build prompts directly from the freeform request schema.",
    ));
  }
  if (!promptBuilderSource.getFullText().includes("outputSchemaCatalogVersion")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      PROMPT_BUILDER_FILE,
      "Authoring prompt builder must surface output schema catalog version in its governed response.",
    ));
  }

  return findings;
};

const FORBIDDEN_TEMPLATE_CHILD_LITERALS = [
  "open-tiktok",
  "click-browser-coordinate",
  "type-text",
  "capture-browser-viewport",
  "verify-action-result",
  "comment-intent-analysis",
] as const;

const inspectPromptTemplateHardcoding = (project: Project): Finding[] => {
  const templateSource = getSource(project, PROMPT_TEMPLATE_FILE);
  const sourceText = templateSource.getFullText();
  const findings: Finding[] = [];
  const hardcodedChildren = FORBIDDEN_TEMPLATE_CHILD_LITERALS.filter((literal) => sourceText.includes(literal));
  if (hardcodedChildren.length > 0) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      PROMPT_TEMPLATE_FILE,
      "Map authoring prompt template must not hardcode childCapabilityId literals; capability truth must come from inputPackage.capabilityCatalog.",
      hardcodedChildren.join(", "),
    ));
  }
  if (sourceText.includes('"Allowed Capabilities:"') || sourceText.includes("formatCapabilitySection")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      PROMPT_TEMPLATE_FILE,
      "Map authoring prompt template must not maintain a second hand-written capability table.",
    ));
  }
  if (
    !sourceText.includes(AUTOMATION_NO_HUMAN_REVIEW_RULE)
    || !sourceText.includes("request-human-review")
    || !sourceText.includes("review_required terminal routing")
    || !sourceText.includes("automated failed termination")
  ) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      PROMPT_TEMPLATE_FILE,
      "Map authoring prompt template must explicitly forbid human-review actions and require automation maps to complete through automated execution, blocking, or failed termination.",
    ));
  }
  if (
    !sourceText.includes("UserRequirement.binaryOutcomePolicy is mandatory source truth")
    || !sourceText.includes("decision plus routeLabel")
    || !sourceText.includes("Orchestration may only match the routeLabel mechanically")
    || !sourceText.includes("must not include nextIntent, suggestedNextAction, actionIntent, or action_intent")
  ) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      PROMPT_TEMPLATE_FILE,
      "Map authoring prompt template must require selected/default binary outcome options to become AI decision plus routeLabel, with Orchestration limited to mechanical route matching.",
    ));
  }
  return findings;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "promptHash" && key !== "promptContractHash")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
};

const hashValue = (value: unknown): string =>
  `sha256:${createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(canonicalize(value))).digest("hex")}`;

const inspectMapAuthoringPromptContract = (): Finding[] => {
  const contract = JSON.parse(readFileSync(pathFromRepoRoot(MAP_AUTHORING_PROMPT_CONTRACT_FILE), "utf8")) as Record<string, unknown>;
  const findings: Finding[] = [];
  const expectedContractHash = hashValue(contract);
  if (contract.modelRole !== "map-authoring") {
    findings.push(createAuthoringFinding(MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, MAP_AUTHORING_PROMPT_CONTRACT_FILE, "Map authoring prompt contract modelRole must be map-authoring."));
  }
  if (contract.promptHash === "sha256:map-authoring-v1" || contract.promptHash !== expectedContractHash || contract.promptContractHash !== expectedContractHash) {
    findings.push(createAuthoringFinding(MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, MAP_AUTHORING_PROMPT_CONTRACT_FILE, "Map authoring prompt contract hash fields must match the canonical static contract hash."));
  }
  if (contract.systemPromptTemplateHash !== hashValue(MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE)) {
    findings.push(createAuthoringFinding(MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, MAP_AUTHORING_PROMPT_CONTRACT_FILE, "Map authoring systemPromptTemplateHash must match the static system template."));
  }
  if (contract.userPromptTemplateHash !== hashValue(MAP_AUTHORING_USER_PROMPT_TEMPLATE)) {
    findings.push(createAuthoringFinding(MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, MAP_AUTHORING_PROMPT_CONTRACT_FILE, "Map authoring userPromptTemplateHash must match the static user template."));
  }
  const forbiddenOutputs = Array.isArray(contract.forbiddenOutputs) ? contract.forbiddenOutputs : [];
  const safetyPolicy = contract.safetyPolicy && typeof contract.safetyPolicy === "object" ? contract.safetyPolicy as Record<string, unknown> : {};
  if (
    !forbiddenOutputs.includes("request-human-review")
    || !forbiddenOutputs.includes("review_required terminal routing")
    || safetyPolicy.forbidHumanReviewActionsInAutomationMaps !== true
    || safetyPolicy.automationMapsMustCompleteWithoutHumanReview !== true
    || safetyPolicy.requireHumanReviewForSensitiveOperations !== false
    || safetyPolicy.automationMapRule !== "forbid-human-review-actions-and-review-required-terminal-routing"
  ) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      MAP_AUTHORING_PROMPT_CONTRACT_FILE,
      "Map authoring prompt contract must encode the automation-map ban on human-review actions and review_required terminal routing.",
    ));
  }
  return findings;
};

const inspectAiAndMapLabBoundary = (project: Project): Finding[] => {
  const aiSchemaSource = getSource(project, AI_INPUT_SCHEMA_FILE);
  const mapLabRequestSource = getSource(project, MAP_LAB_REQUEST_FILE);
  const findings: Finding[] = [];

  if (!hasImportModuleSpecifier(aiSchemaSource, "map-authoring-input-package.schema") || !aiSchemaSource.getFullText().includes("input: MapAuthoringInputPackageSchema")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      AI_INPUT_SCHEMA_FILE,
      "AI map authoring boundary must accept MapAuthoringInputPackageSchema as the structured input payload.",
    ));
  }
  if (!hasCallExpression(mapLabRequestSource, "buildMapAuthoringInputPackage") || !mapLabRequestSource.getFullText().includes("input: inputPackage")) {
    findings.push(createAuthoringFinding(
      MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT,
      MAP_LAB_REQUEST_FILE,
      "Map lab draft request must build a governed input package before dispatching AI authoring.",
    ));
  }

  return findings;
};

export async function runAuthoringInputPackage(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...inspectInputPackageSchema(project),
    ...inspectInputPackageBuilder(project),
    ...inspectPromptBuilderBoundary(project),
    ...inspectPromptTemplateHardcoding(project),
    ...inspectMapAuthoringPromptContract(),
    ...inspectAiAndMapLabBoundary(project),
  ];
  const passed = findings.length === 0;

  return {
    findings,
    phase: createPhase(
      "authoring-input-package",
      passed ? "PASS" : "ENFORCEMENT MISS",
      passed,
      passed
        ? "Map Authoring Input Package schema, builder, prompt builder, and AI input boundary are governed and owner-local."
        : "Map Authoring Input Package enforcement is missing required schema, builder, or boundary coverage.",
    ),
  };
}
