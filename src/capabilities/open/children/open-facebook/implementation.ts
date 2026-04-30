import { OPEN_ABILITY_GROUP_ID } from "../../contract.js";
import type { OpenChildCapability } from "../../runtime/open-runtime-types.js";
import { executeOpenChild } from "../../runtime/open-executor.js";
import { OpenFacebookRequestSchema, OpenFacebookResultSchema } from "./schema.js";

export function createOpenFacebookCapability(): OpenChildCapability {
  return {
    abilityGroupId: OPEN_ABILITY_GROUP_ID,
    childCapabilityId: "open-facebook",
    inputSchema: OpenFacebookRequestSchema,
    outputSchema: OpenFacebookResultSchema,
    async execute(input, context, profile) {
      const request = OpenFacebookRequestSchema.parse(input);
      return OpenFacebookResultSchema.parse(await executeOpenChild({
        request,
        context,
        profile,
      }));
    },
  };
}