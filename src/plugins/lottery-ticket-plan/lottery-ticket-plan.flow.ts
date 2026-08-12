import { createHash } from "node:crypto";

import {
  LotteryTicketPlanInputSchema,
  type LotteryTicketLine,
  type LotteryTicketPlanBucket,
  type LotteryTicketPlanInput,
  type LotteryTicketPlanResult,
} from "./lottery-ticket-plan.schema.js";

const bucketDigits: Record<LotteryTicketPlanBucket, readonly number[]> = {
  lower: [0, 1, 2, 3, 4],
  upper: [5, 6, 7, 8, 9],
};

const buildTicketHash = (tickets: readonly LotteryTicketLine[]): string =>
  createHash("sha256")
    .update(JSON.stringify(tickets.map((ticket) => ticket.digits)))
    .digest("hex");

export const generateLotteryTicketPlan = (rawInput: unknown): LotteryTicketPlanResult => {
  const input: LotteryTicketPlanInput = LotteryTicketPlanInputSchema.parse(rawInput);
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
