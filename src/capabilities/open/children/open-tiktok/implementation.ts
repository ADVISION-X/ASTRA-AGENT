import type { OpenChildCapability } from "../../contract.js";
import { OPEN_ABILITY_GROUP_ID } from "../../contract.js";
import { executeOpenChild } from "../../runtime/open-executor.js";
import { OpenTikTokRequestSchema, OpenTikTokResultSchema } from "./schema.js";

export function createOpenTikTokCapability(): OpenChildCapability {
  return {
    abilityGroupId: OPEN_ABILITY_GROUP_ID,
    childCapabilityId: "open-tiktok",
    inputSchema: OpenTikTokRequestSchema,
    outputSchema: OpenTikTokResultSchema,
    async execute(input, context, profile) {
      const request = OpenTikTokRequestSchema.parse(input);
      return OpenTikTokResultSchema.parse(await executeOpenChild({
        request,
        context,
        profile,
      }));
    },
  };
}