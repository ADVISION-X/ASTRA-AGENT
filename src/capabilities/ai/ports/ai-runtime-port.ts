import type { AiRuntimeExecutionOutput, AiRuntimeHealth, ParsedAiAbilityInput } from "../contract.js";

export interface AiRuntimePort {
  execute(request: ParsedAiAbilityInput): Promise<AiRuntimeExecutionOutput>;
  getHealth(): Promise<{ ok: boolean; detail: string; health: AiRuntimeHealth }>;
  getRuntimeHealth(): Promise<AiRuntimeHealth>;
}
