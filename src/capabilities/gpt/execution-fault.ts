import type {
  ArtifactCheckpointReceipt,
  ExecutionEvidenceReference,
} from "../forensics-persistence/index.js";
import {
  TypedExecutionFailure,
  executionFailure,
} from "../../lib/execution-failure.js";
import type {
  BrowserEffectFailureFacts,
  MutationOutcome,
} from "../../lib/browser/browser-authority-api.js";

export class GptExecutionFailure extends TypedExecutionFailure {
  public override readonly name: string = "GptExecutionFailure";

  public constructor(
    code: string,
    public readonly mutationOutcome: MutationOutcome = "no",
    public readonly evidence: ExecutionEvidenceReference | null = null,
    public readonly browserEffect: BrowserEffectFailureFacts | null = null,
    cause?: unknown,
  ) {
    super("failed", code, cause);
  }
}

export const gptExecutionFailure = (
  code: string,
  input: Readonly<{
    mutationOutcome?: MutationOutcome;
    evidence?: ExecutionEvidenceReference | null;
    browserEffect?: BrowserEffectFailureFacts | null;
    cause?: unknown;
  }> = {},
): GptExecutionFailure => new GptExecutionFailure(
  code,
  input.mutationOutcome,
  input.evidence,
  input.browserEffect,
  input.cause,
);

export const typedGptExecutionFailure = (error: unknown): GptExecutionFailure | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof GptExecutionFailure) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export class PostCheckpointReceiverFault extends GptExecutionFailure {
  public override readonly name: string = "PostCheckpointReceiverFault";

  public constructor(
    code: string,
    public readonly checkpointReceipt: ArtifactCheckpointReceipt,
  ) {
    super(`POST_CHECKPOINT_RECEIVER_FAULT:${code}`, "no", Object.freeze({
      evidenceRef: checkpointReceipt.artifactRef,
      evidenceHash: checkpointReceipt.semanticTextHash,
    }));
  }
}

export const postCheckpointReceiverFault = (
  code: string,
  checkpointReceipt: ArtifactCheckpointReceipt,
): PostCheckpointReceiverFault => new PostCheckpointReceiverFault(code, checkpointReceipt);

export const postCheckpointReceiverReceipt = (
  error: unknown,
): ArtifactCheckpointReceipt | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof PostCheckpointReceiverFault) return current.checkpointReceipt;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export type PostSubmitReadbackReceipt = ExecutionEvidenceReference & Readonly<{
  causeCode: string;
  exactCallIdentityHash: `sha256:${string}`;
  outcome: "CONFIRMED";
  terminalAt: string;
  readbackDeadlineAt: string;
  readbackMutationOutcome: "no";
}>;

type PostSubmitReadbackReceiptInput = Omit<
  PostSubmitReadbackReceipt,
  "outcome" | "readbackMutationOutcome"
>;

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export class PostSubmitReadbackFault extends GptExecutionFailure {
  public override readonly name: string = "PostSubmitReadbackFault";

  public constructor(
    code: string,
    public readonly submitReceipt: PostSubmitReadbackReceipt,
  ) {
    super(`POST_SUBMIT_READBACK_FAULT:${code}`, "no", submitReceipt);
  }
}

export const postSubmitReadbackFault = (
  code: string,
  input: PostSubmitReadbackReceiptInput,
): TypedExecutionFailure => {
  const terminalAt = Date.parse(input.terminalAt);
  const readbackDeadlineAt = Date.parse(input.readbackDeadlineAt);
  if (input.causeCode !== code
    || !Number.isFinite(terminalAt)
    || !Number.isFinite(readbackDeadlineAt)
    || readbackDeadlineAt <= terminalAt
    || !SHA256_PATTERN.test(input.exactCallIdentityHash)
    || input.evidenceRef.trim().length === 0
    || !SHA256_PATTERN.test(input.evidenceHash)) {
    return executionFailure("failed", code);
  }
  return new PostSubmitReadbackFault(code, Object.freeze({
    ...input,
    outcome: "CONFIRMED",
    readbackMutationOutcome: "no",
  }));
};

export const postSubmitReadbackReceipt = (
  error: unknown,
): PostSubmitReadbackReceipt | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof PostSubmitReadbackFault) return current.submitReceipt;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};
