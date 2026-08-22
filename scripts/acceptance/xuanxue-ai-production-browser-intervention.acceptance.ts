import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
import {
  createXuanxueAiProductionOrder,
  XuanxueAiProductionCoordinator,
  XuanxueAiProductionStore,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { FixtureGateway, order } from "./xuanxue-ai-production-fixture.js";

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("XUANXUE_INTERVENTION_ACCEPTANCE_TIMEOUT");
};

const dataDir = await mkdtemp(
  path.join(tmpdir(), "xuanxue-intervention-acceptance-"),
);
try {
  const gateway = new FixtureGateway();
  const store = new XuanxueAiProductionStore(dataDir);
  const runtime: XuanxueAiProductionRuntime = {
    candidateHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    dataDir,
    aiInputGateway: gateway,
    mediaProcessing: createMediaProcessingAbilityGroupFromFilesystem({ dataDir }),
    store,
  };
  const coordinator = new XuanxueAiProductionCoordinator(runtime);

  const pausedOrder = order(
    "xuanxue_intervention_pause_before_feed",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, pausedOrder);
  const pauseRequested = store.requestIntervention("pause", {
    orderId: pausedOrder.orderId,
    expectedRevision: 0,
    reason: "operator needs the computer",
    requestId: "pause-1",
  });
  assert.equal(pauseRequested.state, "pause_requested");
  await coordinator.execute(pausedOrder.orderId);
  assert.equal(store.readIntervention(pausedOrder.orderId).state, "paused");
  assert.equal(gateway.requests.length, 0, "pause before feed must issue no AI command");
  assert.throws(
    () => store.requestIntervention("cancel", {
      orderId: pausedOrder.orderId,
      expectedRevision: 0,
      reason: "stale operator view",
      requestId: "stale-1",
    }),
    /STALE_REVISION/u,
  );
  assert.equal(store.readIntervention(pausedOrder.orderId).revision, 1);

  const resumed = store.resumeIntervention({
    orderId: pausedOrder.orderId,
    expectedRevision: 1,
    reason: "operator released the order",
    requestId: "resume-1",
  });
  assert.equal(resumed.state, "running");
  assert.equal((await coordinator.execute(pausedOrder.orderId)).status, "completed");
  assert.equal(gateway.requests.length, 1);

  const cancelledOrder = order(
    "xuanxue_intervention_cancel_before_feed",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, cancelledOrder);
  store.requestIntervention("cancel", {
    orderId: cancelledOrder.orderId,
    expectedRevision: 0,
    reason: "caller withdrew the whole order",
    requestId: "cancel-1",
  });
  const cancelled = await coordinator.execute(cancelledOrder.orderId);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(store.readIntervention(cancelledOrder.orderId).state, "cancelled");
  assert.equal(gateway.requests.length, 1, "cancel before feed must issue no new AI command");

  const takeoverOrder = order(
    "xuanxue_intervention_takeover_after_checkpoint",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, takeoverOrder);
  gateway.holdQimen = true;
  const executing = coordinator.execute(takeoverOrder.orderId);
  await waitFor(() => gateway.started.some(
    (sourceTaskId) => sourceTaskId.startsWith(`${takeoverOrder.orderId}:`),
  ));
  store.requestIntervention("takeover", {
    orderId: takeoverOrder.orderId,
    expectedRevision: 0,
    reason: "operator will inspect the provider checkpoint",
    requestId: "takeover-1",
  });
  gateway.releaseQimen();
  const stopped = await executing;
  assert.equal(stopped.status, "recovery_pending");
  assert.equal(store.readIntervention(takeoverOrder.orderId).state, "taken_over");
  assert.equal(
    store.readIntervention(takeoverOrder.orderId).lastSafeCheckpoint,
    "after-response-checkpoint:analysis",
  );
  const requestCountAfterCheckpoint = gateway.requests.length;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  store.resumeIntervention({
    orderId: takeoverOrder.orderId,
    expectedRevision: 1,
    reason: "continue from the persisted response",
    requestId: "resume-2",
  });
  assert.equal((await coordinator.execute(takeoverOrder.orderId)).status, "completed");
  assert.equal(
    gateway.requests.length,
    requestCountAfterCheckpoint,
    "resume after raw checkpoint must not submit the completed stage again",
  );

  await coordinator.close();
  store.close();
  console.log("XUANXUE_AI_PRODUCTION_BROWSER_INTERVENTION_ACCEPTANCE_PASS");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
