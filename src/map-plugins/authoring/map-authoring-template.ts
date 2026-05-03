import {
  listPromptContractCatalogEntries,
  PROMPT_CONTRACT_CATALOG_VERSION,
} from "../../capabilities/ai/prompt-contracts/index.js";
import {
  buildCapabilityCatalog,
  CAPABILITY_CATALOG_VERSION,
} from "./capability-catalog/index.js";
import type { MapAuthoringRequest } from "./map-authoring-request.schema.js";
import { MAP_AUTHORING_SAFETY_POLICY } from "./map-authoring-safety-policy.js";

const formatCapabilitySection = (): string =>
  buildCapabilityCatalog().entries
    .map((entry) => `- ${entry.abilityGroupId}/${entry.childCapabilityId}: ${entry.description} | input=${entry.inputSchemaRef} | output=${entry.outputSchemaRef}`)
    .join("\n");

const formatPromptContractSection = (): string =>
  listPromptContractCatalogEntries()
    .map((entry) => `- ${entry.promptContractId}: taskType=${entry.taskType} | schemaVersion=${entry.schemaVersion} | output=${entry.outputSchemaRef} | requiredInputRefs=${entry.requiredInputRefs.join(", ")}`)
    .join("\n");

export const buildMapAuthoringTemplate = (request: MapAuthoringRequest): string => {
  const languageInstruction =
    request.outputLanguage === "zh-CN"
      ? "Use simplified Chinese for human-readable fields in the output package."
      : "Use English for human-readable fields in the output package.";

  return [
    "You are authoring a GrassEye operational map package.",
    `Mission ID: ${request.missionId}`,
    `Objective: ${request.objective}`,
    `Target Platform: ${request.targetPlatform}`,
    `Operator Notes: ${request.operatorNotes || "none"}`,
    languageInstruction,
    `Capability Catalog Version: ${CAPABILITY_CATALOG_VERSION}`,
    `Prompt Contract Catalog Version: ${PROMPT_CONTRACT_CATALOG_VERSION}`,
    "Safety Policy:",
    ...MAP_AUTHORING_SAFETY_POLICY.map((policy) => `- ${policy}`),
    "Allowed Capabilities:",
    formatCapabilitySection(),
    "Allowed Prompt Contracts:",
    formatPromptContractSection(),
    "Output Requirements:",
    "- Return valid JSON only.",
    "- Return draft sections only. Do not emit manifest, activation, approval, validation report, or signature fields.",
    "- The local normalizer will add governance metadata such as manifest refs, package ids, and activation gates.",
    "- Every AI step must have a prompt binding with promptContractId, requiredInputRefs, and outputSchemaRef.",
    "- Do not emit fields named rawPrompt, systemPrompt, userPrompt, executablePromptLogic, handler, script, exec, or shell.",
    "- Use only capability entries listed above.",
  ].join("\n");
};