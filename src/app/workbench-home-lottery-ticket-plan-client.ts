export const renderLotteryTicketPlanClient = (): string => `
const renderLotteryTicketPlan = (plan) => {
  setText("[data-lottery-ticket-plan-title]", plan.game + " plan");
  setText("[data-lottery-ticket-plan-count]", String(plan.ticketCount));
  setText("[data-lottery-ticket-plan-hash]", plan.ticketHash);
  setText("[data-lottery-ticket-plan-cost]", String(plan.estimatedTotalCost));
  setText("[data-lottery-ticket-plan-manual]", String(plan.manualPurchaseOnly));
  const list = qs("[data-lottery-ticket-plan-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const ticket of plan.tickets) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = String(ticket.index).padStart(3, "0") + "  " + ticket.digits;
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = "H " + ticket.positions.hundreds + " / T " + ticket.positions.tens + " / O " + ticket.positions.ones;
    item.append(title, meta);
    item.addEventListener("click", () => openInspector({ kind: "lottery ticket", title: ticket.digits, payload: ticket }));
    list.append(item);
  }
};
const generateLotteryTicketPlan = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const plan = await readJson("/api/lottery-ticket-plan/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      game: "pick3",
      entryCost: Number(form.entryCost.value),
      positions: {
        hundreds: form.hundreds.value,
        tens: form.tens.value,
        ones: form.ones.value,
      },
    }),
  });
  renderLotteryTicketPlan(plan);
  renderLedger({
    taskId: "lottery-ticket-plan",
    status: "completed",
    reachedStep: "local_plan_generated",
    reason: "manual_purchase_only",
    evidenceRef: plan.ticketHash,
  }, { job: "lottery-ticket-plan" });
  writeActivity("lottery ticket plan generated: " + plan.ticketCount + " tickets", "completed");
};
`;
