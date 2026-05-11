/**
 * Text Input Primitive Port
 *
 * The only interface between Text Input ability group and the underlying
 * browser/desktop input executor.
 *
 * ONLY exposes: typeText, pressKey, clearFocusedInput
 * FORBIDDEN: paste, replace, commit, clipboard lifecycle, DOM selector input
 */

export type TextInputPrimitiveInput = {
  primitiveRef: string;
  idempotencyKey: string;
  timeoutMs: number;
  abortSignal?: AbortSignal;
};

export type TypeTextInput = TextInputPrimitiveInput & {
  text: string;
};

export type PressKeyInput = TextInputPrimitiveInput & {
  key: string;
};

export type ClearFocusedInputInput = TextInputPrimitiveInput;

export type TextInputPrimitiveResult = {
  ok: boolean;
  primitiveExecutionRef: string | null;
  message: string;
  startedAt: string | null;
  endedAt: string | null;
  portKind: string;
};

export interface TextInputPrimitivePort {
  typeText(input: TypeTextInput): Promise<TextInputPrimitiveResult>;
  pressKey(input: PressKeyInput): Promise<TextInputPrimitiveResult>;
  clearFocusedInput(
    input: ClearFocusedInputInput,
  ): Promise<TextInputPrimitiveResult>;
}
