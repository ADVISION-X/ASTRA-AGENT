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

type AuthoringRequirement = {
  lawId: string;
  file: string;
  message: string;
  ok: boolean;
  detail?: string;
};

const collectRequirementFindings = (requirements: readonly AuthoringRequirement[]): Finding[] =>
  requirements.flatMap((requirement) =>
    requirement.ok
      ? []
      : [createAuthoringFinding(requirement.lawId, requirement.file, requirement.message, requirement.detail)]);

const inspectInputPackageBuilder = (project: Project): Finding[] => {
  const builderSource = getSource(project, INPUT_PACKAGE_BUILDER_FILE);
  const sourceText = builderSource.getFullText();
  const derivesPromptCatalogFromGovernedRegistry = hasCallExpression(builderSource, "listPromptContractCatalogEntries")
    || hasCallExpression(builderSource, "listAiPromptContractCatalogEntries")
    || hasCallExpression(builderSource, "listMapAuthoringGovernedPromptContracts");
  const missingBuilderFields = REQUIRED_INPUT_PACKAGE_BUILDER_FIELDS.filter((fieldName) => !sourceText.includes(`${fieldName}:`));

  return collectRequirementFindings([
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: INPUT_PACKAGE_BUILDER_FILE, message: "Map Authoring Input Package builder must close through MapAuthoringInputPackageSchema.parse.", ok: hasCallExpressionPath(builderSource, ["MapAuthoringInputPackageSchema", "parse"]) },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: INPUT_PACKAGE_BUILDER_FILE, message: "Map Authoring Input Package builder must derive catalogs from governed capability and prompt registries.", ok: hasCallExpression(builderSource, "buildCapabilityCatalog") && derivesPromptCatalogFromGovernedRegistry },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT, file: INPUT_PACKAGE_BUILDER_FILE, message: "Map Authoring Input Package builder must lock expectedDraftStatus=draft.", ok: sourceText.includes('expectedDraftStatus: "draft"') },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: INPUT_PACKAGE_BUILDER_FILE, message: "Map Authoring Input Package builder must carry hardcoded/default binary outcome options from user request into userRequirement and sourceRequirementHash.", ok: sourceText.includes("binaryOutcomePolicy: buildBinaryOutcomePolicy(request)") && sourceText.includes("productPositiveOutcomeOptions") && sourceText.includes("selectedProductNegativeOutcomeId") },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: INPUT_PACKAGE_BUILDER_FILE, message: "Map Authoring Input Package builder must emit every governed top-level field before schema parse.", ok: missingBuilderFields.length === 0, detail: missingBuilderFields.join(", ") },
  ]);
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

const hasHandWrittenCapabilityTable = (sourceText: string): boolean =>
  sourceText.includes('"Allowed Capabilities:"') || sourceText.includes("formatCapabilitySection");

const hasAutomationNoHumanReviewPromptRules = (sourceText: string): boolean =>
  sourceText.includes(AUTOMATION_NO_HUMAN_REVIEW_RULE)
  && sourceText.includes("request-human-review")
  && sourceText.includes("review_required terminal routing")
  && sourceText.includes("automated failed termination");

const hasBinaryOutcomeRouteLabelPromptRules = (sourceText: string): boolean =>
  sourceText.includes("UserRequirement.binaryOutcomePolicy is mandatory source truth")
  && sourceText.includes("decision plus routeLabel")
  && sourceText.includes("Orchestration may only match the routeLabel mechanically")
  && sourceText.includes("must not include nextIntent, suggestedNextAction, actionIntent, or action_intent")
  && sourceText.includes("Production routePlanBoundMap must not use Branch DSL, schemaFieldRef routing, action chains, review routes, or map-owned branching");

const inspectPromptTemplateHardcoding = (project: Project): Finding[] => {
  const templateSource = getSource(project, PROMPT_TEMPLATE_FILE);
  const sourceText = templateSource.getFullText();
  const hardcodedChildren = FORBIDDEN_TEMPLATE_CHILD_LITERALS.filter((literal) => sourceText.includes(literal));
  const requirements: AuthoringRequirement[] = [
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT, file: PROMPT_TEMPLATE_FILE, message: "Map authoring prompt template must not hardcode childCapabilityId literals; capability truth must come from inputPackage.capabilityCatalog.", ok: hardcodedChildren.length === 0, detail: hardcodedChildren.join(", ") },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT, file: PROMPT_TEMPLATE_FILE, message: "Map authoring prompt template must not maintain a second hand-written capability table.", ok: !hasHandWrittenCapabilityTable(sourceText) },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT, file: PROMPT_TEMPLATE_FILE, message: "Map authoring prompt template must explicitly forbid human-review actions and require automation maps to complete through automated execution, blocking, or failed termination.", ok: hasAutomationNoHumanReviewPromptRules(sourceText) },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT, file: PROMPT_TEMPLATE_FILE, message: "Map authoring prompt template must require selected/default binary outcome options to become AI decision plus routeLabel, with Orchestration limited to mechanical route matching.", ok: hasBinaryOutcomeRouteLabelPromptRules(sourceText) },
  ];

  return collectRequirementFindings(requirements);
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

const hasExpectedPromptContractHashes = (contract: Record<string, unknown>, expectedContractHash: string): boolean =>
  contract.promptHash !== "sha256:map-authoring-v1"
  && contract.promptHash === expectedContractHash
  && contract.promptContractHash === expectedContractHash;

const hasExpectedTemplateHashes = (contract: Record<string, unknown>): boolean =>
  contract.systemPromptTemplateHash === hashValue(MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE)
  && contract.userPromptTemplateHash === hashValue(MAP_AUTHORING_USER_PROMPT_TEMPLATE);

const hasAutomationMapSafetyPolicy = (forbiddenOutputs: readonly unknown[], safetyPolicy: Record<string, unknown>): boolean =>
  forbiddenOutputs.includes("request-human-review")
  && forbiddenOutputs.includes("review_required terminal routing")
  && safetyPolicy.forbidHumanReviewActionsInAutomationMaps === true
  && safetyPolicy.automationMapsMustCompleteWithoutHumanReview === true
  && safetyPolicy.requireHumanReviewForSensitiveOperations === false
  && safetyPolicy.automationMapRule === "forbid-human-review-actions-and-review-required-terminal-routing";

const inspectMapAuthoringPromptContract = (): Finding[] => {
  const contract = JSON.parse(readFileSync(pathFromRepoRoot(MAP_AUTHORING_PROMPT_CONTRACT_FILE), "utf8")) as Record<string, unknown>;
  const expectedContractHash = hashValue(contract);
  const forbiddenOutputs = Array.isArray(contract.forbiddenOutputs) ? contract.forbiddenOutputs : [];
  const safetyPolicy = contract.safetyPolicy && typeof contract.safetyPolicy === "object" ? contract.safetyPolicy as Record<string, unknown> : {};
  const requirements: AuthoringRequirement[] = [
    { lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, file: MAP_AUTHORING_PROMPT_CONTRACT_FILE, message: "Map authoring prompt contract modelRole must be map-authoring.", ok: contract.modelRole === "map-authoring" },
    { lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, file: MAP_AUTHORING_PROMPT_CONTRACT_FILE, message: "Map authoring prompt contract hash fields must match the canonical static contract hash.", ok: hasExpectedPromptContractHashes(contract, expectedContractHash) },
    { lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, file: MAP_AUTHORING_PROMPT_CONTRACT_FILE, message: "Map authoring systemPromptTemplateHash must match the static system template.", ok: hasExpectedTemplateHashes({ ...contract, userPromptTemplateHash: hashValue(MAP_AUTHORING_USER_PROMPT_TEMPLATE) }) },
    { lawId: MAP_PLUGIN_LAWS.PROMPT_OUTPUT_CATALOGS, file: MAP_AUTHORING_PROMPT_CONTRACT_FILE, message: "Map authoring userPromptTemplateHash must match the static user template.", ok: hasExpectedTemplateHashes({ ...contract, systemPromptTemplateHash: hashValue(MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE) }) },
    { lawId: MAP_PLUGIN_LAWS.AUTHORING_ENFORCEMENT, file: MAP_AUTHORING_PROMPT_CONTRACT_FILE, message: "Map authoring prompt contract must encode the automation-map ban on human-review actions and review_required terminal routing.", ok: hasAutomationMapSafetyPolicy(forbiddenOutputs, safetyPolicy) },
  ];

  return collectRequirementFindings(requirements);
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
