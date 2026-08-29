import {
  RuntimeFailureImpact, requireRuntimeLogWrite, runtimeFailureFromError,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";

export class BrowserRuntimeLogEmitter {
  public constructor(
    private readonly logger: RuntimeLogger,
    private readonly connectionGeneration: () => number,
  ) {}

  public failure(reasonCode: string, subjectId: string): void {
    const span = requireRuntimeLogWrite(this.logger.startSpan({
      traceId: `browser-session:${this.connectionGeneration()}`, owner: "browser-session",
      component: "browser-infrastructure", operation: "browser.infrastructure",
      typedIdentity: { kind: "producer", producerId: subjectId }, visibility: "FLOW",
    }));
    requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: new Error(reasonCode), code: "BROWSER_INFRASTRUCTURE_FAILED",
        responsibleOwner: "browser-session",
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
  }
}
