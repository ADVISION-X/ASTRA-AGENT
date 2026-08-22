import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  XuanxueAiProductionStore,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { openXuanxueAiProductionDatabase } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-database.js";
import { initialXuanxueStages } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.js";
import { assertXuanxueAiOrderMatchesProfile } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.js";
import { hash, order } from "./xuanxue-ai-production-fixture.js";

const seedLegacyTechnicalTerminal = (
  store: XuanxueAiProductionStore,
): string => {
  const candidate = order(
    "aiprod_legacy_technical_terminal",
    "qimen_professional_answer",
    ["analysis"],
  );
  const productionOrder = {
    ...candidate,
    cloudExecutionIdentity: {
      jobId: candidate.orderId, attemptId: "legacy-attempt-1",
      requiredDeviceId: "fixture-device", leaseVersion: 1,
      executionFenceHash: hash("legacy-terminal-fence"),
      contractManifestHash: hash("cloud-contract-manifest"),
      serverNow: "2026-08-21T21:00:00.000Z",
      leaseExpiresAt: "2026-08-21T21:01:30.000Z",
    },
  };
  const initial = store.createOrder(
    productionOrder,
    initialXuanxueStages(
      productionOrder,
      assertXuanxueAiOrderMatchesProfile(productionOrder),
    ),
  );
  store.updateStage({
    ...initial.stages[0]!, status: "failed", attemptCount: 1,
    failureReason: "BROWSER_TARGET_INVALID", progressPhase: "terminal",
    updatedAt: "2026-08-21T21:00:30.000Z",
  }, "fixture_legacy_pre_submission_technical_terminal");
  store.updateOrder({
    orderId: candidate.orderId, status: "failed",
    failureReason: "BROWSER_TARGET_INVALID",
    updatedAt: "2026-08-21T21:00:30.000Z",
    eventType: "fixture_legacy_terminal_failed",
  });
  return candidate.orderId;
};

const legacyProfileReadbackReason =
  "review_required: NOT_PRODUCTION_VERIFIED: GPT pre-submit model and reasoning controls have no exact verified readback; GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH";
const legacyProfileStateFollowOnReason =
  "review_required: submitted web-chat execution is missing its durable submission proof.";

const seedLegacyProfileReadbackTerminal = (
  store: XuanxueAiProductionStore,
): string => {
  const candidate = order(
    "aiprod_legacy_profile_readback_terminal",
    "localization_static_review_candidate",
    ["localization_candidate"],
    "candidate_a",
  );
  const productionOrder = {
    ...candidate,
    cloudExecutionIdentity: {
      jobId: candidate.orderId, attemptId: "legacy-profile-attempt-1",
      requiredDeviceId: "fixture-device", leaseVersion: 1,
      executionFenceHash: hash("legacy-profile-terminal-fence"),
      contractManifestHash: hash("cloud-contract-manifest"),
      serverNow: "2026-08-21T21:10:00.000Z",
      leaseExpiresAt: "2026-08-21T21:11:30.000Z",
    },
  };
  const initial = store.createOrder(
    productionOrder,
    initialXuanxueStages(
      productionOrder,
      assertXuanxueAiOrderMatchesProfile(productionOrder),
    ),
  );
  store.updateStage({
    ...initial.stages[0]!, status: "review_required", attemptCount: 1,
    failureReason: legacyProfileReadbackReason, progressPhase: "terminal",
    updatedAt: "2026-08-21T21:10:30.000Z",
  }, "fixture_legacy_profile_readback_terminal");
  store.updateOrder({
    orderId: candidate.orderId, status: "review_required",
    failureReason: legacyProfileReadbackReason,
    updatedAt: "2026-08-21T21:10:30.000Z",
    eventType: "fixture_legacy_profile_terminal_review_required",
  });
  return candidate.orderId;
};

const resetLegacyMigrationVersion = (dataDir: string, version = 0): void => {
  const database = openXuanxueAiProductionDatabase(dataDir);
  database.pragma(`user_version = ${version}`);
  database.close();
};

export const acceptLegacyTechnicalTerminalCorrection = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "xuanxue-legacy-correction-"));
  try {
    const seed = new XuanxueAiProductionStore(dataDir);
    const orderId = seedLegacyTechnicalTerminal(seed);
    const profileOrderId = seedLegacyProfileReadbackTerminal(seed);
    const executionId = seed.readOrder(orderId)!.stages[0]!.executionId;
    const profileExecutionId = seed.readOrder(profileOrderId)!
      .stages[0]!.executionId;
    seed.close();
    resetLegacyMigrationVersion(dataDir);
    const corrected = new XuanxueAiProductionStore(dataDir);
    const record = corrected.readOrder(orderId)!;
    assert.equal(record.status, "recovery_pending");
    assert.equal(record.stages[0]?.status, "recovery_pending");
    assert.equal(record.stages[0]?.executionId, executionId,
      "one-time legacy proof-empty technical correction must preserve the same order and execution");
    assert.ok(corrected.listCloudRecoveryOrders().some(
      (candidate) => candidate.order.orderId === orderId,
    ));
    const profileRecord = corrected.readOrder(profileOrderId)!;
    assert.equal(profileRecord.status, "recovery_pending");
    assert.equal(profileRecord.stages[0]?.status, "recovery_pending");
    assert.equal(profileRecord.stages[0]?.executionId, profileExecutionId,
      "one-time legacy proof-empty profile correction must preserve the same order and execution");
    assert.ok(corrected.listCloudRecoveryOrders().some(
      (candidate) => candidate.order.orderId === profileOrderId,
    ));
    const correctedAt = record.updatedAt;
    const profileCorrectedAt = profileRecord.updatedAt;
    corrected.close();
    const stableProfileCorrection = new XuanxueAiProductionStore(dataDir);
    assert.equal(
      stableProfileCorrection.readOrder(profileOrderId)?.updatedAt,
      profileCorrectedAt,
      "the profile correction migration must never become a live review-task reader",
    );
    const stableProfileRecord = stableProfileCorrection.readOrder(profileOrderId)!;
    stableProfileCorrection.updateStage({
      ...stableProfileRecord.stages[0]!, status: "failed", attemptCount: 2,
      failureReason: legacyProfileStateFollowOnReason, progressPhase: "terminal",
      updatedAt: "2026-08-21T21:11:00.000Z",
    }, "fixture_legacy_profile_state_followon_terminal");
    stableProfileCorrection.updateOrder({
      orderId: profileOrderId, status: "failed",
      failureReason: legacyProfileStateFollowOnReason,
      updatedAt: "2026-08-21T21:11:00.000Z",
      eventType: "fixture_legacy_profile_state_followon_failed",
    });
    stableProfileCorrection.close();
    resetLegacyMigrationVersion(dataDir, 2);
    const followOnCorrected = new XuanxueAiProductionStore(dataDir);
    const followOnRecord = followOnCorrected.readOrder(profileOrderId)!;
    assert.equal(followOnRecord.status, "recovery_pending");
    assert.equal(followOnRecord.stages[0]?.status, "recovery_pending");
    assert.equal(followOnRecord.stages[0]?.executionId, profileExecutionId,
      "one-time legacy proof-empty profile-state follow-on correction must preserve the same order and execution");
    const followOnCorrectedAt = followOnRecord.updatedAt;
    followOnCorrected.close();
    const reopened = new XuanxueAiProductionStore(dataDir);
    assert.equal(reopened.readOrder(orderId)?.updatedAt, correctedAt,
      "the legacy correction migration must never become a live failed-task reader");
    assert.notEqual(followOnCorrectedAt, profileCorrectedAt);
    assert.equal(reopened.readOrder(profileOrderId)?.updatedAt, followOnCorrectedAt,
      "the profile-state follow-on correction migration must never become a live failed-task reader");
    reopened.close();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};
