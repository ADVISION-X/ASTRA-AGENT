import type { AiModelRoster, AiModelRosterEntry } from "./contract.js";
import type { AiModelRosterPort } from "./ports/ai-model-roster-port.js";
import type { AiClockPort } from "./ports/ai-clock-port.js";
import { AiModelRosterSchema } from "./schema.js";
import { loadAiOwnedLocalModelConfig } from "./runtime/local-ai-model-config.js";

type LocalAiModelConfig = Awaited<ReturnType<typeof loadAiOwnedLocalModelConfig>>;

function buildConfiguredEntries(config: LocalAiModelConfig): AiModelRosterEntry[] {
  return [
    {
      childCapabilityId: "local-vision-ai",
      providerKind: "local",
      taskTypes: ["product_presence_judgment", "visual_observation", "visual_target_candidate_analysis"],
      modelRole: "vision",
      runtime: config.roles.vision.runtime,
      modelOrTool: config.roles.vision.model,
      enabledByPolicy: true,
      status: "configured",
    },
    {
      childCapabilityId: "local-text-ai",
      providerKind: "local",
      taskTypes: ["comment_signal_summary", "product_signal_summary"],
      modelRole: "multi-role",
      runtime: config.roles.commentUnderstanding.runtime,
      modelOrTool: `${config.roles.commentUnderstanding.model} | ${config.roles.productSignal.model}`,
      enabledByPolicy: true,
      status: "configured",
    },
    {
      childCapabilityId: "local-ocr-ai",
      providerKind: "local",
      taskTypes: ["ocr_cleanup"],
      modelRole: "ocr",
      runtime: config.roles.ocr.runtime,
      modelOrTool: config.roles.ocr.model,
      enabledByPolicy: true,
      status: "configured",
    },
    {
      childCapabilityId: "internal-schema-validator",
      providerKind: "internal",
      taskTypes: ["schema_validation_only"],
      modelRole: "schemaValidator",
      runtime: "internal",
      modelOrTool: "schema-validator",
      enabledByPolicy: true,
      status: "configured",
    },
  ];
}

function buildDisabledEntries(): AiModelRosterEntry[] {
  return [
    {
      childCapabilityId: "paid-analysis-ai",
      providerKind: "paid",
      taskTypes: ["evidence_packet_analysis", "map_authoring"],
      modelRole: "future",
      runtime: "policy-disabled",
      modelOrTool: null,
      enabledByPolicy: false,
      status: "disabled_by_policy",
    },
    {
      childCapabilityId: "paid-vision-ai",
      providerKind: "paid",
      taskTypes: ["visual_observation", "visual_target_candidate_analysis"],
      modelRole: "vision",
      runtime: "policy-disabled",
      modelOrTool: null,
      enabledByPolicy: false,
      status: "disabled_by_policy",
    },
    {
      childCapabilityId: "future-api-ai",
      providerKind: "future",
      taskTypes: [],
      modelRole: "future",
      runtime: "policy-disabled",
      modelOrTool: null,
      enabledByPolicy: false,
      status: "disabled_by_policy",
    },
  ];
}

function buildEntries(config: LocalAiModelConfig): AiModelRosterEntry[] {
  return [...buildConfiguredEntries(config), ...buildDisabledEntries()];
}

export function createAiModelRosterPort(): AiModelRosterPort {
  return {
    async load(clock: AiClockPort): Promise<AiModelRoster> {
      const start = clock.startRun();
      const config = await loadAiOwnedLocalModelConfig();
      const end = clock.finishRun(start);
      return AiModelRosterSchema.parse({
        generatedAt: end.endedAt,
        entries: buildEntries(config),
        proof: {
          generatedAt: end.endedAt,
          clockPortKind: end.portKind,
          entryCount: 7,
        },
      });
    },
  };
}
