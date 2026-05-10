import type { ParsedAiAbilityInput } from "../contract.js";
import { AiEvidencePacketAnalysisInputSchema } from "../schema.js";

export type ExternalProviderMessages = {
  system: string;
  user: string;
};

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

  return { ok: false };
}
