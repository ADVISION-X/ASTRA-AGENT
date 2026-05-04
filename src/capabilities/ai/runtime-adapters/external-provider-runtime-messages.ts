import type { ParsedAiAbilityInput } from "../contract.js";
import { AiEvidencePacketAnalysisInputSchema } from "../schema.js";
import { buildMapAuthoringTemplate } from "../../../map-plugins/authoring/map-authoring-template.js";
import { MapAuthoringAiOutputSchema } from "../shared/ai-map-authoring-schemas.js";

export type ExternalProviderMessages = {
  system: string;
  user: string;
};

const MAP_AUTHORING_SYSTEM_LINES = [
  "You are GrassEye Map Authoring Agent.",
  "You receive a complete Map Authoring Input Package.",
  "You generate declarative operational-map package candidates only.",
  "You cannot write code.",
  "You cannot write raw prompts.",
  "You cannot execute tools.",
  "You cannot call APIs.",
  "You cannot activate maps.",
  "You cannot approve maps.",
  "You cannot emit humanApprovalRef.",
  "You cannot emit validationReportRef.",
  "You cannot emit activationSnapshotRef.",
  "You cannot invent abilityGroupId.",
  "You cannot invent childCapabilityId.",
  "You cannot invent promptContractId.",
  "You cannot invent outputSchemaRef.",
  "You must use only capabilityCatalog, promptContractCatalog, outputSchemaCatalog, and policy catalogs.",
  "You must treat capabilityCatalog as the only ability truth and must not rely on a hardcoded ability list inside prompt text.",
  "If requirement is unclear, output requiredClarifications.",
  "If current abilities are insufficient, output needsCapabilityExpansion.",
  "If capabilityCatalog is missing, stale, or inconsistent with governed capability truth, return BLOCKED_CAPABILITY_CATALOG_STALE.",
  "If operation sends/deletes/buys/submits/modifies user data, add review gate.",
  "If operation involves commit/send/publish behavior, require explicit human confirmation.",
  "Return strict JSON matching MapAuthoringAiOutputSchema.",
];

const buildMapAuthoringUserSections = (request: Extract<ParsedAiAbilityInput, { taskType: "map_authoring" }>): string[] => [
  buildMapAuthoringTemplate(request.input),
  "Complete Map Authoring Input Package JSON:",
  JSON.stringify(request.input, null, 2),
  "Return a JSON object with:",
  "- draftPackage: declarative draft sections for task template, operational map, dependencies, policy, and prompt bindings.",
  "- humanReadableExplanation: brief operator-facing explanation.",
  "- requiredClarifications: array of strings.",
  "- riskWarnings: array of strings.",
  "- validationHints: array of strings.",
  "- needsCapabilityExpansion: boolean.",
  "- draftStatus: draft_ready or needs_clarification.",
  "Target platform profile must match the request.",
];

function buildMapAuthoringMessages(request: Extract<ParsedAiAbilityInput, { taskType: "map_authoring" }>): ExternalProviderMessages {
  return {
    system: MAP_AUTHORING_SYSTEM_LINES.join("\n"),
    user: buildMapAuthoringUserSections(request).join("\n\n"),
  };
}

function buildEvidencePacketMessages(request: Extract<ParsedAiAbilityInput, { taskType: "evidence_packet_analysis" }>): ExternalProviderMessages {
  const typedInput = AiEvidencePacketAnalysisInputSchema.parse(request.input);
  return {
    system: [
      "You analyze governed evidence packets for GrassEye.",
      "Return JSON only.",
      "Preserve evidenceIds exactly.",
    ].join("\n"),
    user: JSON.stringify(typedInput, null, 2),
  };
}

export function buildExternalProviderMessages(request: ParsedAiAbilityInput): ExternalProviderMessages | null {
  switch (request.taskType) {
    case "map_authoring":
      return buildMapAuthoringMessages(request);
    case "evidence_packet_analysis":
      return buildEvidencePacketMessages(request);
    default:
      return null;
  }
}

export function normalizeExternalProviderOutput(
  request: ParsedAiAbilityInput,
  output: unknown,
): { ok: true; value: unknown } | { ok: false } {
  if (request.taskType !== "map_authoring") {
    return { ok: true, value: output };
  }

  const parsed = MapAuthoringAiOutputSchema.safeParse(output);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}
