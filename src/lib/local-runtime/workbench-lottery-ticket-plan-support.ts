import { generateLotteryTicketPlan } from "../../plugins/lottery-ticket-plan/index.js";

export const buildLotteryTicketPlanHandle = () => ({
  generateLotteryTicketPlan(input: unknown) {
    return generateLotteryTicketPlan(input);
  },
});
