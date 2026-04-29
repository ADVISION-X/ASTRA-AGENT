import { createId } from "../../../lib/local-runtime/ids.js";
import type { ZodType } from "zod";

import type { CommanderReadChildAbilityId } from "../contract.js";

export type CommanderReadGateSuccess<TInput> = {
  ok: true;
  inputRef: string;
  readRequestId: string;
  parsedInput: TInput;
};

export type CommanderReadGateFailure = {
  ok: false;
  inputRef: string;
  readRequestId: string;
  reason: string;
};

export type CommanderReadGateResult<TInput> = CommanderReadGateSuccess<TInput> | CommanderReadGateFailure;

export function gateCommanderRead<TInput>(input: {
  childCapabilityId: CommanderReadChildAbilityId;
  operatorRef: string;
  readInput: unknown;
  inputSchema: ZodType<TInput>;
}): CommanderReadGateResult<TInput> {
  const inputRef = createId("commander_read_input");
  const readRequestId = createId("commander_read");

  if (!input.operatorRef.trim()) {
    return {
      ok: false,
      inputRef,
      readRequestId,
      reason: "operatorRef is required.",
    };
  }

  const parsed = input.inputSchema.safeParse(input.readInput);
  if (!parsed.success) {
    return {
      ok: false,
      inputRef,
      readRequestId,
      reason: parsed.error.issues[0]?.message ?? `Read input for ${input.childCapabilityId} failed schema validation.`,
    };
  }

  return {
    ok: true,
    inputRef,
    readRequestId,
    parsedInput: parsed.data,
  };
}