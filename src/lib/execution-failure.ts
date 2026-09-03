export type ExecutionFailureStatus = "failed";

export class TypedExecutionFailure extends Error {
  public override readonly name: string = "TypedExecutionFailure";

  public constructor(
    public readonly status: ExecutionFailureStatus,
    public readonly code: string,
    cause?: unknown,
  ) {
    super(code, cause === undefined ? undefined : { cause });
  }
}

export const executionFailure = (
  status: ExecutionFailureStatus,
  code: string,
  input: Readonly<{ cause?: unknown }> = {},
): TypedExecutionFailure => new TypedExecutionFailure(status, code, input.cause);

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

export const executionFailureCause = (
  error: unknown,
): Readonly<{ name: string; code: string | null }> | null => {
  const typed = typedExecutionFailure(error);
  let current = typed ? typed.cause : error;
  let deepest: Error | null = null;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) deepest = current;
    current = current instanceof Error ? current.cause : undefined;
  }
  if (!deepest) return null;
  const code = "code" in deepest && typeof deepest.code === "string" ? deepest.code : null;
  return Object.freeze({ name: deepest.name || "Error", code });
};
