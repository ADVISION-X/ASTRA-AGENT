import type { TextInputChildCapabilityId, TextInputCommitKey, TextInputKey, TextInputTargetKind } from "../contract.js";

export type TextInputExecutionRequest = {
  attemptRef: string;
  actionExecutionRef: string;
  childCapabilityId: TextInputChildCapabilityId;
  targetRef: string;
  targetKind: TextInputTargetKind;
  targetLabel: string;
  inputText: string | null;
  inputTextHash: string | null;
  key: TextInputKey | TextInputCommitKey | null;
  timeoutMs: number;
  abortSignal: AbortSignal;
};

export type TextInputExecutionResult = {
  ok: boolean;
  primitiveExecutionRef: string | null;
  operationRef: string | null;
  typedTextHash: string | null;
  keySequenceHash: string | null;
  message: string;
  startedAt: string | null;
  endedAt: string | null;
  portKind: string;
  failureReason: "primitive_failed" | "primitive_aborted" | "primitive_timeout" | null;
};

export interface TextInputExecutionPort {
  execute(input: TextInputExecutionRequest): Promise<TextInputExecutionResult>;
}