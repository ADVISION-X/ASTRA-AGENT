import { readFileSync } from "node:fs";

import type {
  LocalProductionMaterial,
  ProductionActionId,
  ProductionHash,
  ProductionProductId,
  WebsiteAgentResult,
  WebsiteAgentTask,
} from "./contracts.js";
import { sha256 } from "./contracts.js";
import type {
  GptChildCapabilityId,
  GptReasoningTier,
  GptTaskLabelKey,
} from "../../../capabilities/gpt/index.js";

export interface GptTurnFlowStep {
  readonly childCapabilityId: GptChildCapabilityId;
  readonly when?: "has_attachments" | "text_output" | "generated_image" | "has_title";
}

export interface ProviderTurnResult {
  readonly raw_text: string;
  readonly raw_hash: ProductionHash;
  readonly evidence_refs: readonly string[];
  readonly provider_continuation: Readonly<{
    provider_page_url: string;
    prior_task_id: string;
    prior_raw_output_hash: ProductionHash;
    prior_turn_marker: string;
  }> | null;
}

export interface SharedExecutionContext {
  readonly materials: readonly LocalProductionMaterial[];
  readonly runTurn: (input: Readonly<{
    step_id: string;
    instruction: string;
    material_roles: readonly string[];
    gpt_flow: readonly GptTurnFlowStep[];
    provider: Readonly<{
      labelKey: GptTaskLabelKey;
      profileRef: string;
      modelDisplayName: string;
      modelFamily: string;
      reasoningTier: GptReasoningTier;
    }>;
    output_kind?: "text" | "generated_image";
    same_conversation_as?: ProviderTurnResult;
    use_task_continuation?: boolean;
    continuation_source_plugin_ids?: readonly string[];
  }>) => Promise<ProviderTurnResult>;
  readonly complete: (output: ProductPluginOutput) => Promise<WebsiteAgentResult>;
}

export interface ProductPluginOutput {
  readonly payload: unknown;
  readonly evidence_refs: readonly string[];
  readonly continuation?: ProviderTurnResult["provider_continuation"];
}

export interface ProductPlugin {
  readonly pluginId: string;
  readonly pluginVersion: number;
  readonly skillHash: ProductionHash;
  readonly checkpointSchemaVersion: number;
  readonly accepts: readonly Readonly<{
    productId: ProductionProductId;
    actionId: ProductionActionId;
  }>[];
  execute(task: WebsiteAgentTask, context: SharedExecutionContext): Promise<WebsiteAgentResult>;
}

export const readProductSkill = (pluginModuleUrl: string): Readonly<{
  path: string;
  text: string;
  hash: ProductionHash;
}> => {
  const path = new URL("./SKILL.md", pluginModuleUrl).pathname;
  const text = readFileSync(path, "utf8").normalize("NFC");
  if (!text.trim()) throw new Error("PLUGIN_SKILL_EMPTY");
  return Object.freeze({ path, text, hash: sha256(text) });
};

export const requireParameter = (task: WebsiteAgentTask, key: string): unknown => {
  if (!(key in task.parameters)) throw new Error(`PLUGIN_PARAMETER_REQUIRED:${key}`);
  return task.parameters[key];
};

export const combineEvidence = (...turns: readonly ProviderTurnResult[]): readonly string[] =>
  Object.freeze([...new Set(turns.flatMap((turn) => turn.evidence_refs))]);

export function parsePluginJsonObject(raw: string, code: string): Readonly<Record<string, unknown>> {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  let value: unknown;
  try { value = JSON.parse(normalized) as unknown; }
  catch { throw new Error(`${code}_JSON_INVALID`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${code}_OBJECT_REQUIRED`);
  }
  return Object.freeze(value as Record<string, unknown>);
}
