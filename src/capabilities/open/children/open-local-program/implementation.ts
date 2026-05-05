import { OPEN_ABILITY_GROUP_ID } from "../../contract.js";
import type { OpenChildCapability } from "../../runtime/open-runtime-types.js";
import { executeOpenChild } from "../../runtime/open-executor.js";
import {
  OpenLocalProgramRequestSchema,
  OpenLocalProgramResultSchema,
} from "./schema.js";

export function createOpenLocalProgramCapability(): OpenChildCapability {
  return {
    abilityGroupId: OPEN_ABILITY_GROUP_ID,
    childCapabilityId: "open-local-program",
    inputSchema: OpenLocalProgramRequestSchema,
    outputSchema: OpenLocalProgramResultSchema,
    async execute(input, context, profile) {
      const request = OpenLocalProgramRequestSchema.parse(input);
      return OpenLocalProgramResultSchema.parse(await executeOpenChild({
        request,
        context,
        profile,
      }));
    },
  };
}
