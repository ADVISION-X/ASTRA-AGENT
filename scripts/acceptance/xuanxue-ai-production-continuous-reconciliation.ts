import assert from "node:assert/strict";

import type { createXuanxueAiProductionOrder } from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  reconcileXuanxueAiProductionLocalNonterminalLedger,
  xuanxueAiProductionLocalRecoveryVersion,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.js";
import { hash } from "./xuanxue-ai-production-fixture.js";

export const acceptContinuousRecoveryVersion = async (
  initial: ReturnType<typeof createXuanxueAiProductionOrder>,
): Promise<void> => {
  const firstRecord = {
    ...initial,
    status: "recovery_pending",
    updatedAt: "2026-08-21T20:00:31.000Z",
  } as const;
  const changedStatusRecord = {
    ...firstRecord,
    status: "running",
    updatedAt: "2026-08-21T20:00:32.000Z",
  } as const;
  const changedAttemptRecord = {
    ...changedStatusRecord,
    order: {
      ...changedStatusRecord.order,
      cloudExecutionIdentity: initial.order.cloudExecutionIdentity
        ? { ...initial.order.cloudExecutionIdentity, attemptId: "continuous-attempt-2" }
        : {
            jobId: initial.order.orderId,
            attemptId: "continuous-attempt-2",
            requiredDeviceId: "fixture-device",
            leaseVersion: 2,
            executionFenceHash: hash("continuous-fence-2"),
            contractManifestHash: hash("cloud-contract-manifest"),
            serverNow: "2026-08-21T20:01:00.000Z",
            leaseExpiresAt: "2026-08-21T20:02:30.000Z",
          },
    },
  } as const;
  const changedCheckpointRecord = {
    ...changedAttemptRecord,
    stages: changedAttemptRecord.stages.map((stage, index) => index === 0
      ? {
          ...stage,
          status: "recovery_pending" as const,
          attemptCount: stage.attemptCount + 1,
          progressPhase: "recovery_pending" as const,
          updatedAt: "2026-08-21T20:00:33.000Z",
        }
      : stage),
  };
  const first = xuanxueAiProductionLocalRecoveryVersion(firstRecord);
  const changedStatus = xuanxueAiProductionLocalRecoveryVersion(changedStatusRecord);
  const changedAttempt = xuanxueAiProductionLocalRecoveryVersion(changedAttemptRecord);
  const changedCheckpoint = xuanxueAiProductionLocalRecoveryVersion(changedCheckpointRecord);
  assert.notEqual(first, changedStatus,
    "a changed local status/version must retain a distinct reconciliation identity");
  assert.notEqual(first, changedAttempt,
    "a changed cloud attempt must retain a distinct reconciliation identity");
  assert.notEqual(changedAttempt, changedCheckpoint,
    "a changed durable stage checkpoint must retain a distinct reconciliation identity");

  const reconciledVersions = new Map<string, string>();
  let reconcileCalls = 0;
  const reconcile = (records: Parameters<
    typeof reconcileXuanxueAiProductionLocalNonterminalLedger
  >[0]["records"]) => reconcileXuanxueAiProductionLocalNonterminalLedger({
    records,
    activeJobIds: new Set<string>(),
    reconciledVersions,
    reconcileDerivedInputs: async () => {
      reconcileCalls += 1;
    },
  });
  assert.deepEqual(await reconcile([firstRecord]), [initial.order.orderId]);
  assert.deepEqual(await reconcile([firstRecord]), [],
    "an unchanged version may be deduplicated only after the real poll reconciliation runs");
  assert.deepEqual(await reconcile([changedStatusRecord]), [initial.order.orderId]);
  assert.deepEqual(await reconcile([changedAttemptRecord]), [initial.order.orderId]);
  assert.deepEqual(await reconcile([changedCheckpointRecord]), [initial.order.orderId]);
  assert.equal(reconcileCalls, 5,
    "every poll must execute local-ledger reconciliation even when an exact version is unchanged");
};
