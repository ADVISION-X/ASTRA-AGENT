import type { AiRuntimeExecutionOutput, AiRuntimeHealth, ParsedAiAbilityInput } from "../contract.js";

export type AiRuntimeExecuteOptions = {
  signal?: AbortSignal;
};

export interface AiRuntimePort {
  execute(request: ParsedAiAbilityInput, options?: AiRuntimeExecuteOptions): Promise<AiRuntimeExecutionOutput>;
  getHealth(): Promise<{ ok: boolean; detail: string; health: AiRuntimeHealth }>;
  getRuntimeHealth(): Promise<AiRuntimeHealth>;
}
