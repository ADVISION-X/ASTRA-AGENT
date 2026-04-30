import { OPEN_ABILITY_GROUP_ID } from "../../contract.js";
import type { OpenChildCapability } from "../../runtime/open-runtime-types.js";
import { executeOpenChild } from "../../runtime/open-executor.js";
import {
  OpenLocalWorkbenchRequestSchema,
  OpenLocalWorkbenchResultSchema,
} from "./schema.js";

export function createOpenLocalWorkbenchCapability(): OpenChildCapability {
  return {
    abilityGroupId: OPEN_ABILITY_GROUP_ID,
    childCapabilityId: "open-local-workbench",
    inputSchema: OpenLocalWorkbenchRequestSchema,
    outputSchema: OpenLocalWorkbenchResultSchema,
    async execute(input, context, profile) {
      const request = OpenLocalWorkbenchRequestSchema.parse(input);
      return OpenLocalWorkbenchResultSchema.parse(await executeOpenChild({
        request,
        context,
        profile,
      }));
    },
  };
}