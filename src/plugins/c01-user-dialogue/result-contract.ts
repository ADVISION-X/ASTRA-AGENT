import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";
import type { ProductPluginOutput, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";

export interface UserDialogueInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly profile: GptExecutionProfile;
}

function optionalRequirements(answer: string): readonly string[] {
  try {
    const result: unknown = JSON.parse(answer);
    const requirements: unknown = result && typeof result === "object" ? Reflect.get(result, "requirements") : null;
    return Array.isArray(requirements) && requirements.every(item => typeof item === "string" && item.trim())
      ? requirements : [];
  } catch { return []; }
}

export function buildUserDialogueResult(task: WebsiteAgentTask, answer: string, evidence: readonly string[]): ProductPluginOutput {
  return {
    payload: {
      schema_version: "astra-user-dialogue.v1",
      turn_id: task.parameters.turn_id,
      project_id: task.parameters.project_id,
      dialogue_input_version: task.parameters.dialogue_input_version,
      dialogue_order_revision: task.parameters.dialogue_order_revision,
      dialogue_context_hash: task.parameters.dialogue_context_hash,
      disposition: "answer",
      answer,
      requirements: optionalRequirements(answer),
    },
    evidence_refs: evidence,
  };
}
