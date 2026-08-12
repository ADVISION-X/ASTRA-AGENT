import {
  generateLotteryTicketPlan,
  LotteryTicketPlanInputSchema,
} from "../plugins/lottery-ticket-plan/index.js";

export const runLotteryTicketPlanRoute = (rawInput: unknown) =>
  generateLotteryTicketPlan(LotteryTicketPlanInputSchema.parse(rawInput));
