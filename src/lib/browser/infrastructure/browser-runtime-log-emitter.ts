import {
  RuntimeFailureImpact, RuntimeRecovery, requireRuntimeLogWrite, runtimeFailureFromError,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";
import type { RuntimeStateInput, RuntimeStateKey, RuntimeStateValue } from "../../runtime-logs/runtime-event-contract.js";

export class BrowserRuntimeLogEmitter {
  private readonly states = new Map<string, RuntimeStateValue>();

  public constructor(
    private readonly logger: RuntimeLogger,
    private readonly connectionGeneration: () => number,
  ) {}

  public state(stateKey: RuntimeStateKey, current: RuntimeStateValue): void {
    const traceId = `browser-session:${this.connectionGeneration()}`;
    const identity = `${traceId}\u0000${stateKey}`;
    const previous = this.states.get(identity) ?? null;
    if (previous === current) return;
    const event = {
      traceId, owner: "browser-session", component: "browser-infrastructure", stateKey, previous, current,
    } as RuntimeStateInput;
    requireRuntimeLogWrite(this.logger.emitState(event));
    this.states.set(identity, current);
  }

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
        responsibleOwner: "browser-session", recovery: RuntimeRecovery.REVIEW,
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
  }
}
