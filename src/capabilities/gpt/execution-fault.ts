import { TypedExecutionFailure } from "../../lib/execution-failure.js";
import type {
  BrowserEffectFailureFacts,
  MutationOutcome,
} from "../../lib/browser/browser-authority-api.js";

class GptExecutionFailure extends TypedExecutionFailure {
  public override readonly name: string = "GptExecutionFailure";

  public constructor(
    code: string,
    public readonly mutationOutcome: MutationOutcome = "no",
    public readonly evidence: Readonly<{
      evidenceRef: string;
      evidenceHash: `sha256:${string}`;
    }> | null = null,
    public readonly browserEffect: BrowserEffectFailureFacts | null = null,
    cause?: unknown,
  ) {
    super("failed", code, cause, Object.freeze({ mutationOutcome, evidence, browserEffect }));
  }
}

export const gptExecutionFailure = (
  code: string,
  input: Readonly<{
    mutationOutcome?: MutationOutcome;
    evidence?: Readonly<{ evidenceRef: string; evidenceHash: `sha256:${string}` }> | null;
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
