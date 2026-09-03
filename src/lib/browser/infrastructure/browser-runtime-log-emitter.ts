import {
  RuntimeFailureImpact, requireRuntimeLogWrite, runtimeFailureFromError,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";

export class BrowserRuntimeLogEmitter {
  public constructor(
    private readonly logger: RuntimeLogger,
    private readonly connectionGeneration: () => number,
  ) {}

  public failure(reasonCode: string, subjectId: string, nativeCauseCode?: string): void {
    const span = requireRuntimeLogWrite(this.logger.startSpan({
      traceId: `browser-session:${this.connectionGeneration()}`, owner: "browser-session",
      component: "browser-infrastructure", operation: "browser.infrastructure",
      typedIdentity: { kind: "producer", producerId: subjectId }, visibility: "FLOW",
    }));
    requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: new Error(reasonCode, { cause: nativeCauseCode
          ? Object.assign(new Error(nativeCauseCode), { code: nativeCauseCode }) : undefined }),
        code: reasonCode,
        responsibleOwner: "browser-session",
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
  }
}
