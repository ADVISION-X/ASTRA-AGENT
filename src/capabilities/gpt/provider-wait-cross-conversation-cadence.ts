import { executionFailure } from "../../lib/execution-failure.js";

export const GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS = 30_000;

export type GptCrossConversationPollEligibility =
  | Readonly<{ kind: "reserved" }>
  | Readonly<{ kind: "wait"; durationMs: number }>;

export class GptCrossConversationPollCadence {
  private nextEligibleAt = 0;

  private requireClock(now: number): void {
    if (!Number.isFinite(now) || now < 0) {
      throw executionFailure("failed", "GPT_CROSS_CONVERSATION_POLL_CLOCK_INVALID");
    }
  }

  public reserve(now: number): GptCrossConversationPollEligibility {
    this.requireClock(now);
    if (now < this.nextEligibleAt) {
      return Object.freeze({
        kind: "wait",
        durationMs: Math.ceil(this.nextEligibleAt - now),
      });
    }
    this.nextEligibleAt = now + GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS;
    return Object.freeze({ kind: "reserved" });
  }

  public bindDispatch(now: number): void {
    this.requireClock(now);
    this.nextEligibleAt = Math.max(
      this.nextEligibleAt,
      now + GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
    );
  }
}

export const productionGptCrossConversationPollCadence =
  new GptCrossConversationPollCadence();
