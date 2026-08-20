import type { BrowserWireMutationClass } from "../protocol/generated/browser-protocol.js";

export const BROWSER_COMMAND_ADMISSION_BUDGET = Object.freeze({
  maxQueuedCommands: 128,
  maxQueuedBytes: 2 * 1024 * 1024,
  maxInflightObservations: 8,
  maxInflightMutationsPerTarget: 1,
  maxArtifactStreams: 4,
  maxArtifactBytes: 512 * 1024 * 1024,
  fairnessQuantum: 4,
});

export class BrowserBackpressureError extends Error {
  readonly code = "BROWSER_BACKPRESSURE" as const;
  constructor(message: string) {
    super(message);
    this.name = "BrowserBackpressureError";
  }
}

type AdmissionRequest = Readonly<{
  commandId: string;
  targetLeaseRef: string;
  mutationClass: BrowserWireMutationClass;
  payloadBytes: number;
  deadlineMonotonicMs: number;
}>;

type AdmissionRelease = () => void;

export class BrowserCommandAdmissionBudget {
  private queuedCommands = 0;
  private queuedBytes = 0;
  private inflightObservations = 0;
  private readonly inflightMutationsByTarget = new Map<string, number>();

  admit(input: AdmissionRequest, nowMonotonicMs: number): AdmissionRelease {
    if (nowMonotonicMs >= input.deadlineMonotonicMs) {
      throw new BrowserBackpressureError(
        "command deadline elapsed before admission",
      );
    }
    if (!Number.isSafeInteger(input.payloadBytes) || input.payloadBytes < 0) {
      throw new BrowserBackpressureError("command payload size is invalid");
    }
    if (
      this.queuedCommands + 1 >
        BROWSER_COMMAND_ADMISSION_BUDGET.maxQueuedCommands ||
      this.queuedBytes + input.payloadBytes >
        BROWSER_COMMAND_ADMISSION_BUDGET.maxQueuedBytes
    ) {
      throw new BrowserBackpressureError(
        "browser command queue budget exceeded",
      );
    }
    if (input.mutationClass === "observation") {
      if (
        this.inflightObservations >=
        BROWSER_COMMAND_ADMISSION_BUDGET.maxInflightObservations
      ) {
        throw new BrowserBackpressureError(
          "browser observation concurrency budget exceeded",
        );
      }
      this.inflightObservations += 1;
    } else {
      const current =
        this.inflightMutationsByTarget.get(input.targetLeaseRef) ?? 0;
      if (
        current >=
        BROWSER_COMMAND_ADMISSION_BUDGET.maxInflightMutationsPerTarget
      ) {
        throw new BrowserBackpressureError(
          "browser target mutation lane is occupied",
        );
      }
      this.inflightMutationsByTarget.set(input.targetLeaseRef, current + 1);
    }
    this.queuedCommands += 1;
    this.queuedBytes += input.payloadBytes;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.queuedCommands = Math.max(0, this.queuedCommands - 1);
      this.queuedBytes = Math.max(0, this.queuedBytes - input.payloadBytes);
      if (input.mutationClass === "observation") {
        this.inflightObservations = Math.max(0, this.inflightObservations - 1);
      } else {
        const current =
          this.inflightMutationsByTarget.get(input.targetLeaseRef) ?? 0;
        if (current <= 1)
          this.inflightMutationsByTarget.delete(input.targetLeaseRef);
        else
          this.inflightMutationsByTarget.set(input.targetLeaseRef, current - 1);
      }
    };
  }

  snapshot(): Readonly<{
    queuedCommands: number;
    queuedBytes: number;
    inflightObservations: number;
    inflightMutationTargets: number;
  }> {
    return Object.freeze({
      queuedCommands: this.queuedCommands,
      queuedBytes: this.queuedBytes,
      inflightObservations: this.inflightObservations,
      inflightMutationTargets: this.inflightMutationsByTarget.size,
    });
  }
}
