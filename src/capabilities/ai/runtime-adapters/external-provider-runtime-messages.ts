import type { ParsedAiAbilityInput } from "../contract.js";
import { AiEvidencePacketAnalysisInputSchema } from "../schema.js";
import { buildMapAuthoringTemplate } from "../../../map-plugins/authoring/map-authoring-template.js";
import { MapAuthoringAiOutputSchema } from "../shared/ai-map-authoring-schemas.js";

export type ExternalProviderMessages = {
  system: string;
  user: string;
};

function buildMapAuthoringMessages(request: Extract<ParsedAiAbilityInput, { taskType: "map_authoring" }>): ExternalProviderMessages {
  return {
    system: [
      "You are a GrassEye map authoring model.",
      "Return JSON only.",
      "Do not include markdown fences.",
      "Output keys: draftPackage, humanReadableExplanation, requiredClarifications, riskWarnings, validationHints, needsCapabilityExpansion, draftStatus.",
      "draftPackage must be declarative map data only and must never contain executable code.",
    ].join("\n"),
    user: [
      buildMapAuthoringTemplate(request.input),
      "Return a JSON object with:",
      "- draftPackage: declarative draft sections for task template, operational map, dependencies, policy, and prompt bindings.",
      "- humanReadableExplanation: brief operator-facing explanation.",
      "- requiredClarifications: array of strings.",
      "- riskWarnings: array of strings.",
      "- validationHints: array of strings.",
      "- needsCapabilityExpansion: boolean.",
      "- draftStatus: draft_ready or needs_clarification.",
      "Target platform profile must match the request.",
    ].join("\n\n"),
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