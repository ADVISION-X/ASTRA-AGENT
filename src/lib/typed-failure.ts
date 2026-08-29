export type ExecutionFailureStatus = "failed";
export type MutationOutcome = "no" | "dispatched" | "confirmed";
export type SerializedExecutionFailure = Readonly<{
  code: string;
  mutation_outcome: MutationOutcome;
  evidence_ref: string | null;
  evidence_hash: `sha256:${string}` | null;
  cause: Readonly<{ name: string; code: string | null }> | null;
}>;

export class TypedExecutionFailure extends Error {
  public override readonly name = "TypedExecutionFailure";

  public constructor(
    public readonly status: ExecutionFailureStatus,
    public readonly code: string,
    public readonly mutationOutcome: MutationOutcome = "no",
    public readonly evidenceRef: string | null = null,
    public readonly evidenceHash: `sha256:${string}` | null = null,
    public readonly httpStatus: number | null = null,
    cause?: unknown,
  ) {
    super(code, cause === undefined ? undefined : { cause });
  }
}

export const executionFailure = (
  status: ExecutionFailureStatus,
  code: string,
  input: Readonly<{
    mutationOutcome?: MutationOutcome;
    evidenceRef?: string | null;
    evidenceHash?: `sha256:${string}` | null;
    httpStatus?: number | null;
    cause?: unknown;
  }> = {},
): TypedExecutionFailure => new TypedExecutionFailure(
  status,
  code,
  input.mutationOutcome ?? "no",
  input.evidenceRef ?? null,
  input.evidenceHash ?? null,
  input.httpStatus ?? null,
  input.cause,
);

export const typedExecutionFailure = (error: unknown): TypedExecutionFailure | null => {
  let current = error;
  let typed: TypedExecutionFailure | null = null;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof TypedExecutionFailure) typed = current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return typed;
};

export const failureCode = (error: unknown, fallback = "UNKNOWN_FAILURE"): string =>
  typedExecutionFailure(error)?.code ?? fallback;

export const serializeTerminalFailure = (
  error: unknown,
): SerializedExecutionFailure => {
  const typed = typedExecutionFailure(error);
  const cause = typed?.cause ?? (typed ? undefined : error);
  const causeCode = cause && typeof cause === "object" && "code" in cause
    && typeof (cause as { code?: unknown }).code === "string"
    ? (cause as { code: string }).code : null;
  return Object.freeze({
    code: failureCode(error),
    mutation_outcome: typed?.mutationOutcome ?? "no",
    evidence_ref: typed?.evidenceRef ?? null,
    evidence_hash: typed?.evidenceHash ?? null,
    cause: cause instanceof Error ? Object.freeze({ name: cause.name || "Error", code: causeCode }) : null,
  });
};
