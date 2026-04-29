import type { AiChildCapability } from "../../contract.js";
import { executeAiChild } from "../../runtime/ai-executor.js";
import { LocalTextAiChildContract as contract } from "./contract.js";
import { LocalTextAiChildInputSchema, LocalTextAiChildReadinessSchema, LocalTextAiChildResultSchema } from "./schema.js";

export function createLocalTextAiCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
      async execute(input, context) {
        return LocalTextAiChildResultSchema.parse(await executeAiChild({
          request: LocalTextAiChildInputSchema.parse(input),
          childContract: contract,
          context,
        }));
      },
      async checkReadiness(context) {
        const [health, roster] = await Promise.all([context.runtime.getRuntimeHealth(), context.modelRoster.load(context.clock)]);
        const entry = roster.entries.find((item) => item.childCapabilityId === "local-text-ai");
        return LocalTextAiChildReadinessSchema.parse({
          abilityGroupId: "ai",
          childCapabilityId: "local-text-ai",
          providerKind: "local",
          status: health.dependencies.text === "ready" ? "ready" : "unavailable",
          supportedTaskTypes: [...contract.supportedTaskTypes],
          detail: `text=${health.dependencies.text}; models=${entry?.modelOrTool ?? "unknown"}`,
          enabledByPolicy: true,
        });
      },
    },
  };
}
