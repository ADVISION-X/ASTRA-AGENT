import { loadLocalAiModelConfig } from "../../lib/local-ai/model-config.js";
import type { AiModelRoster, AiModelRosterEntry } from "./contract.js";

type LocalAiModelConfig = Awaited<ReturnType<typeof loadLocalAiModelConfig>>;

function buildLocalVisionEntry(config: LocalAiModelConfig): AiModelRosterEntry {
  return {
    childCapabilityId: "local-vision-ai",
    providerKind: "local",
    taskTypes: ["product_presence_judgment", "visual_observation", "visual_target_candidate_analysis"],
    modelRole: "vision",
    runtime: config.roles.vision.runtime,
    modelOrTool: config.roles.vision.model,
    enabledByPolicy: true,
    status: "configured",
  };
}

function buildLocalTextEntry(config: LocalAiModelConfig): AiModelRosterEntry {
  return {
    childCapabilityId: "local-text-ai",
    providerKind: "local",
    taskTypes: ["comment_signal_summary", "product_signal_summary", "schema_validation_only"],
    modelRole: "multi-role",
    runtime: config.roles.commentUnderstanding.runtime,
    modelOrTool: `${config.roles.commentUnderstanding.model} | ${config.roles.productSignal.model}`,
    enabledByPolicy: true,
    status: "configured",
  };
}

function buildLocalOcrEntry(config: LocalAiModelConfig): AiModelRosterEntry {
  return {
    childCapabilityId: "local-ocr-ai",
    providerKind: "local",
    taskTypes: ["ocr_cleanup"],
    modelRole: "ocr",
    runtime: config.roles.ocr.runtime,
    modelOrTool: config.roles.ocr.model,
    enabledByPolicy: true,
    status: "configured",
  };
}

function buildDisabledEntry(
  childCapabilityId: AiModelRosterEntry["childCapabilityId"],
  providerKind: AiModelRosterEntry["providerKind"],
  status: AiModelRosterEntry["status"],
  taskTypes: AiModelRosterEntry["taskTypes"],
): AiModelRosterEntry {
  return {
    childCapabilityId,
    providerKind,
    taskTypes,
    modelRole: "future",
    runtime: "policy-disabled",
    modelOrTool: null,
    enabledByPolicy: false,
    status,
  };
}

function buildAiRosterEntries(config: LocalAiModelConfig): AiModelRosterEntry[] {
  return [
    buildLocalVisionEntry(config),
    buildLocalTextEntry(config),
    buildLocalOcrEntry(config),
    buildDisabledEntry("paid-vision-ai", "paid", "disabled_by_policy", ["visual_observation", "visual_target_candidate_analysis"]),
    buildDisabledEntry("paid-analysis-ai", "paid", "disabled_by_policy", ["evidence_packet_analysis"]),
    buildDisabledEntry("future-api-ai", "future", "disabled_by_policy", []),
  ];
}

export async function loadAiModelRoster(): Promise<AiModelRoster> {
  const config = await loadLocalAiModelConfig();

  return {
    generatedAt: new Date().toISOString(),
    entries: buildAiRosterEntries(config),
  };
}