import { createHash } from "node:crypto";

import {
  type LotteryTicketLine,
  type LotteryTicketPlanBucket,
  type LotteryTicketPlanInput,
  type LotteryTicketPlanResult,
} from "./lottery-ticket-plan.schema.js";

const bucketDigits: Record<LotteryTicketPlanBucket, readonly number[]> = {
  lower: [0, 1, 2, 3, 4],
  upper: [5, 6, 7, 8, 9],
};

const parseBucket = (value: unknown, position: string): LotteryTicketPlanBucket => {
  if (value === "upper" || value === "lower") return value;
  throw new Error(`invalid_${position}_bucket`);
};

const parseInput = (input: unknown): LotteryTicketPlanInput => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("invalid_lottery_ticket_plan_input");
  }
  const value = input as {
    entryCost?: unknown;
    game?: unknown;
    positions?: Partial<Record<string, unknown>>;
  };
  if (value.game !== "pick3") throw new Error("unsupported_lottery_ticket_plan_game");
  if (typeof value.entryCost !== "number" || !Number.isFinite(value.entryCost) || value.entryCost <= 0) {
    throw new Error("invalid_entry_cost");
  }
  return {
    game: "pick3",
    entryCost: value.entryCost,
    positions: {
      hundreds: parseBucket(value.positions?.hundreds, "hundreds"),
      tens: parseBucket(value.positions?.tens, "tens"),
      ones: parseBucket(value.positions?.ones, "ones"),
    },
  };
};

const buildTicketHash = (tickets: readonly LotteryTicketLine[]): string =>
  createHash("sha256")
    .update(JSON.stringify(tickets.map((ticket) => ticket.digits)))
    .digest("hex");

export const generateLotteryTicketPlan = (rawInput: unknown): LotteryTicketPlanResult => {
  const input = parseInput(rawInput);
  const hundredsDigits = bucketDigits[input.positions.hundreds];
  const tensDigits = bucketDigits[input.positions.tens];
  const onesDigits = bucketDigits[input.positions.ones];
  const tickets: LotteryTicketLine[] = [];

  for (const hundreds of hundredsDigits) {
    for (const tens of tensDigits) {
      for (const ones of onesDigits) {
        tickets.push({
          index: tickets.length + 1,
          digits: `${hundreds}${tens}${ones}`,
          positions: { hundreds, tens, ones },
        });
      }
    }
  }

  return {
    createdAt: new Date().toISOString(),
    estimatedEntryCost: input.entryCost,
    estimatedTotalCost: Number((input.entryCost * tickets.length).toFixed(2)),
    game: input.game,
    manualPurchaseOnly: true,
    positionBuckets: input.positions,
    ticketCount: tickets.length,
    ticketHash: buildTicketHash(tickets),
    tickets,
  };
};
