import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  XuanxueAiProductionCoordinator,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  FixtureGateway,
  order,
} from "./xuanxue-ai-production-fixture.js";

export const acceptXuanxueAiProductionConcurrency = async (input: {
  runtime: XuanxueAiProductionRuntime;
  gateway: FixtureGateway;
}): Promise<void> => {
  const { runtime, gateway } = input;
  const parallelOrders = Array.from({ length: 11 }, (_, index) =>
    order(
      `aiprod_qimen_${index + 1}`,
      "qimen_professional_answer",
      ["analysis"],
    ));
  for (const candidate of parallelOrders) {
    createXuanxueAiProductionOrder(runtime, candidate);
  }
  const coordinator = new XuanxueAiProductionCoordinator(runtime);
  gateway.holdQimen = true;
  const executions = parallelOrders.map((candidate) =>
    coordinator.execute(candidate.orderId));
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  assert.equal(
    gateway.started.filter((value) => /aiprod_qimen_\d+:analysis$/u.test(value)).length,
    10,
    "the eleventh order must remain outside the ten-order production window",
  );
  assert.equal(gateway.maxActive, 10);
  gateway.releaseQimen();
  const completed = await Promise.all(executions);
  assert.ok(completed.every((record) => record.status === "completed"));
  await coordinator.close();
};
