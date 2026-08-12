import { runLotteryTicketPlanRoute } from "../../mediator/lottery-ticket-plan-route.js";

export const buildLotteryTicketPlanHandle = () => ({
  generateLotteryTicketPlan(input: unknown) {
    return runLotteryTicketPlanRoute(input);
  },
});
