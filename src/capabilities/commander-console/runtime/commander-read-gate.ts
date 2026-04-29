import { createId } from "../../../lib/local-runtime/ids.js";

import { ReadRequestInputSchema } from "../schema.js";
import { isCommanderReadChild } from "../shared/commander-command-policy.js";

export function gateCommanderRead(input: {
  childCapabilityId: string;
  operatorRef: string;
  readInput: unknown;
}): { ok: true; inputRef: string } | { ok: false; reason: string } {
  if (!isCommanderReadChild(input.childCapabilityId)) {
    return { ok: false, reason: `Child ${input.childCapabilityId} is not a read surface.` };
  }

  if (!input.operatorRef.trim()) {
    return { ok: false, reason: "operatorRef is required." };
  }

  ReadRequestInputSchema.passthrough().parse(input.readInput ?? {});
  return { ok: true, inputRef: createId("commander_read_input") };
}