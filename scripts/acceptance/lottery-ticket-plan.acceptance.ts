import assert from "node:assert/strict";

import { generateLotteryTicketPlan } from "../../src/plugins/lottery-ticket-plan/index.js";

const plan = generateLotteryTicketPlan({
  game: "pick3",
  entryCost: 5,
  positions: {
    hundreds: "upper",
    tens: "lower",
    ones: "upper",
  },
});

assert.equal(plan.game, "pick3");
assert.equal(plan.manualPurchaseOnly, true);
assert.equal(plan.ticketCount, 125);
assert.equal(plan.estimatedEntryCost, 5);
assert.equal(plan.estimatedTotalCost, 625);
assert.equal(plan.tickets[0]?.digits, "505");
assert.equal(plan.tickets[124]?.digits, "949");
assert.match(plan.ticketHash, /^[a-f0-9]{64}$/);
assert.equal(
  generateLotteryTicketPlan({
    game: "pick3",
    entryCost: 5,
    positions: { hundreds: "upper", tens: "lower", ones: "upper" },
  }).ticketHash,
  plan.ticketHash,
);

assert.throws(
  () => generateLotteryTicketPlan({
    game: "pick3",
    entryCost: 5,
    positions: { hundreds: "upper", tens: "middle", ones: "upper" },
  }),
  /invalid_tens_bucket/,
);

process.stdout.write("[ACCEPTANCE][lottery-ticket-plan] PASS\n");
