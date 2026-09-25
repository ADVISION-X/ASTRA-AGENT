import type { BrowserMutationStore } from "../exact-target/browser-mutation-store.js";
import type { BrowserInfrastructureState } from "./browser-infrastructure-state.js";
import type { BrowserLaneCoordinator } from "./browser-lane-coordinator.js";

/** Read-only Browser evidence surface over the supervisor's sole live WAL and lane. */
export class BrowserInfrastructureEvidence {
  public constructor(
    private readonly lane: BrowserLaneCoordinator,
    private readonly state: BrowserInfrastructureState,
  ) {}

  private mutations(): BrowserMutationStore {
    const mutations = this.state.mutationState;
    if (!mutations) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    return mutations;
  }

  public readBrowserLaneState(): "idle" | "busy" | "blocked" { return this.lane.readState(); }
  public hasUnresolvedBrowserMutation(): boolean { return this.lane.hasUnresolvedMutation(); }
  public hasBrowserMutationForJob(jobId: string): boolean { return this.lane.hasMutationForJob(jobId); }
  public readJobBrowserHistoryEvidence(jobId: string) { return this.mutations().jobHistoryEvidence(jobId); }
  public readJobPhysicalInputState(jobId: string) { return this.mutations().readJobPhysicalInputState(jobId); }
  public readAttemptPhysicalInputState(jobId: string, attemptId: string) {
    return this.mutations().readAttemptPhysicalInputState(jobId, attemptId);
  }
  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    return this.lane.countProviderTurnDispatches(jobId, attemptId);
  }
  public readProviderEffectStepCallFact(input: Readonly<{
    jobId: string; attemptId: string; resultRevision: number;
    productStepId: string; callId: string; childCapabilityId: string;
  }>) { return this.lane.readProviderEffectStepCallFact(input); }
  public readConfirmedRateLimitAcknowledgement(input: Parameters<
    BrowserMutationStore["readConfirmedRateLimitAcknowledgement"]
  >[0]) { return this.mutations().readConfirmedRateLimitAcknowledgement(input); }
  public readProvenZeroInputProviderCommand(input: Parameters<
    BrowserMutationStore["readProvenZeroInputProviderCommand"]
  >[0]) { return this.mutations().readProvenZeroInputProviderCommand(input); }
  public readSourceConfirmedProviderEffect(input: Parameters<
    BrowserMutationStore["readSourceConfirmedProviderEffect"]
  >[0]) { return this.mutations().readSourceConfirmedProviderEffect(input); }
}
