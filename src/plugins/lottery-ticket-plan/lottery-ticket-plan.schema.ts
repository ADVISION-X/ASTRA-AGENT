export type LotteryTicketPlanGame = "pick3";
export type LotteryTicketPlanBucket = "upper" | "lower";
export type Pick3TicketPosition = "hundreds" | "tens" | "ones";

export type LotteryTicketPlanInput = {
  entryCost: number;
  game: LotteryTicketPlanGame;
  positions: Record<Pick3TicketPosition, LotteryTicketPlanBucket>;
};

export type LotteryTicketLine = {
  digits: string;
  index: number;
  positions: Record<Pick3TicketPosition, number>;
};

export type LotteryTicketPlanResult = {
  createdAt: string;
  estimatedEntryCost: number;
  estimatedTotalCost: number;
  game: LotteryTicketPlanGame;
  manualPurchaseOnly: true;
  positionBuckets: Record<Pick3TicketPosition, LotteryTicketPlanBucket>;
  ticketCount: number;
  ticketHash: string;
  tickets: LotteryTicketLine[];
};

const parseBucket = (
  value: unknown,
  position: Pick3TicketPosition,
): LotteryTicketPlanBucket => {
  if (value === "upper" || value === "lower") return value;
  throw new Error(`invalid_${position}_bucket`);
};

export const LotteryTicketPlanInputSchema = {
  parse(input: unknown): LotteryTicketPlanInput {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("invalid_lottery_ticket_plan_input");
    }
    const value = input as {
      entryCost?: unknown;
      game?: unknown;
      positions?: Partial<Record<Pick3TicketPosition, unknown>>;
    };
    if (value.game !== "pick3") {
      throw new Error("unsupported_lottery_ticket_plan_game");
    }
    if (
      typeof value.entryCost !== "number"
      || !Number.isFinite(value.entryCost)
      || value.entryCost <= 0
    ) {
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
  },
} as const;
