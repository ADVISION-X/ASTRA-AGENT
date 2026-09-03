import { TypedExecutionFailure } from "../../execution-failure.js";

export class RuntimeTransportFailure extends TypedExecutionFailure {
  public override readonly name = "RuntimeTransportFailure";

  public constructor(code: string, public readonly httpStatus: number, cause?: unknown) {
    super("failed", code, cause);
  }
}

export const runtimeTransportFailure = (
  code: string,
  httpStatus: number,
  cause?: unknown,
): RuntimeTransportFailure => new RuntimeTransportFailure(code, httpStatus, cause);

export const typedRuntimeTransportFailure = (error: unknown): RuntimeTransportFailure | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof RuntimeTransportFailure) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};
