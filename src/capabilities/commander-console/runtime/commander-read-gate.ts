import { createId } from "../../../lib/local-runtime/ids.js";
import type { ZodType } from "zod";
import type { CommanderConsoleChildAbilityId } from "../contract.js";
const READ_CHILD_IDS = new Set<CommanderConsoleChildAbilityId>(["show-mission-dashboard","show-capability-roster","show-capability-health","show-operational-map-progress","show-runtime-proof-timeline","show-evidence-packets","show-browse-ledger","show-failed-records","show-review-queue","show-audit-summary","inspect-record-detail"]);
export function gateCommanderRead<TInput>(input: { childCapabilityId: CommanderConsoleChildAbilityId; operatorRef: string; readInput: TInput; inputSchema: ZodType<TInput> }): { ok: true; inputRef: string; readRequestId: string; parsedInput: TInput } | { ok: false; reason: string; inputRef: string; readRequestId: string } {
  const inputRef = createId("commander_read_input"); const readRequestId = createId("commander_read");
  if (!READ_CHILD_IDS.has(input.childCapabilityId)) return { ok: false, reason: "Child is not a read surface.", inputRef, readRequestId };
  if (!input.operatorRef.trim()) return { ok: false, reason: "operatorRef is required.", inputRef, readRequestId };
  const parsedInput = input.inputSchema.parse(input.readInput);
  return { ok: true, inputRef, readRequestId, parsedInput };
}
