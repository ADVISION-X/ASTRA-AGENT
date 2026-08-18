import { BrowserTerminalError, type BrowserMutationClass } from "../exact-target/browser-command-contract.js";

export type BrowserCommandAdmissionLease = Readonly<{
  release(): void;
}>;

export type BrowserCommandAdmissionBudgetPolicy = Readonly<{
  maxQueuedAndInflight: number;
  maxInflightObservations: number;
  maxInflightMutations: number;
}>;

export const DEFAULT_BROWSER_COMMAND_ADMISSION_POLICY: BrowserCommandAdmissionBudgetPolicy = Object.freeze({
  maxQueuedAndInflight: 256,
  maxInflightObservations: 32,
  maxInflightMutations: 16,
});

export class BrowserCommandAdmissionBudget {
  private total = 0;
  private observations = 0;
  private mutations = 0;

  constructor(
    private readonly policy: BrowserCommandAdmissionBudgetPolicy = DEFAULT_BROWSER_COMMAND_ADMISSION_POLICY,
  ) {}

  acquire(input: Readonly<{
    mutationClass: BrowserMutationClass;
    deadlineAt: number;
  }>): BrowserCommandAdmissionLease {
    if (input.deadlineAt <= Date.now()) {
      throw new BrowserTerminalError("COMMAND_TIMEOUT", "browser command deadline expired before admission", input.mutationClass);
    }
    const observation = input.mutationClass === "observation";
    const classCount = observation ? this.observations : this.mutations;
    const classLimit = observation
      ? this.policy.maxInflightObservations
      : this.policy.maxInflightMutations;
    if (this.total >= this.policy.maxQueuedAndInflight || classCount >= classLimit) {
      throw new BrowserTerminalError(
        "BROWSER_BACKPRESSURE",
        "browser authority command budget is saturated; owning caller must retry only from an explicit business checkpoint",
        input.mutationClass,
      );
    }
    this.total += 1;
    if (observation) this.observations += 1;
    else this.mutations += 1;
    let released = false;
    return Object.freeze({
      release: () => {
        if (released) return;
        released = true;
        this.total = Math.max(0, this.total - 1);
        if (observation) this.observations = Math.max(0, this.observations - 1);
        else this.mutations = Math.max(0, this.mutations - 1);
      },
    });
  }

  snapshot(): Readonly<{ total: number; observations: number; mutations: number }> {
    return Object.freeze({ total: this.total, observations: this.observations, mutations: this.mutations });
  }
}
