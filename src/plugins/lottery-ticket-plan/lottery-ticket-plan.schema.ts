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
