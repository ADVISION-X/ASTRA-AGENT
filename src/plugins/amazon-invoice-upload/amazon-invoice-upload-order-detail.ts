import { createHash, randomUUID } from "node:crypto";

import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { BrowserOpenReusePolicy } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type {
  AmazonInvoiceUploadExecutionContext,
  AmazonInvoiceUploadTaskResult,
  AmazonOrderNavigationProof,
} from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import {
  emitAmazonOrderDetailNavigationStarted,
  emitAmazonOrderDetailNavigationTerminal,
} from "./amazon-dom-step-trace.js";
import {
  buildOrderDetailNotFoundResult,
  waitForApprovedOrderDetailWindows,
} from "./amazon-invoice-upload-order-detail-readiness.js";

type NavigationOutcomeInput = {
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  execution: AmazonInvoiceUploadExecutionContext;
  reusePolicy: BrowserOpenReusePolicy;
  browserActionId: string;
  beforeHash: string;
  actionResult: "success" | "failed";
  navigationMode: string;
  observedUrlMatchesRequest: boolean;
  afterHash: string;
  startedAt: string;
  durationMs: number;
  reason: string;
};

export async function openApprovedOrderDetail(
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  execution: AmazonInvoiceUploadExecutionContext,
): Promise<
  | { ok: true; proof: AmazonOrderNavigationProof }
  | { ok: false; failure: AmazonInvoiceUploadTaskResult }
> {
  const detailUrl = buildApprovedOrderDetailUrl(mission);
  const reusePolicy = await orderDetailReusePolicy(browser);
  const browserActionId = `browser:${randomUUID()}`;
  const beforeHash = stateHash(browser.getLeaseState().currentUrl);
  const proofResult = await openAndPersistOrderDetailNavigation({
    browser,
    runtimeLogger,
    mission,
    execution,
    detailUrl,
    reusePolicy,
    browserActionId,
    beforeHash,
  });
  if (!proofResult.ok) return proofResult;
  const proof = proofResult.proof;
  const readiness = await waitForApprovedOrderDetailWindows(
    browser,
    runtimeLogger,
    mission,
    execution,
  );
  if (readiness.status === "ready") return { ok: true, proof };
  if (readiness.status === "blocked" || readiness.status === "technical_failure") {
    return {
      ok: false,
      failure: withNavigationProof(
        readiness.result,
        proof,
        execution.runtimeLogRef,
      ),
    };
  }
  return {
    ok: false,
    failure: withNavigationProof(
      buildOrderDetailNotFoundResult(mission, readiness.reason),
      proof,
      execution.runtimeLogRef,
    ),
  };
}

async function openAndPersistOrderDetailNavigation(input: {
  browser: BrowserTargetLease;
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  execution: AmazonInvoiceUploadExecutionContext;
  detailUrl: string;
  reusePolicy: BrowserOpenReusePolicy;
  browserActionId: string;
  beforeHash: string;
}): Promise<
  | { ok: true; proof: AmazonOrderNavigationProof }
  | { ok: false; failure: AmazonInvoiceUploadTaskResult }
> {
  const fallbackStartedAt = new Date().toISOString();
  const fallbackStartedAtMs = Date.now();
  emitAmazonOrderDetailNavigationStarted({
    runtimeLogger: input.runtimeLogger,
    executionId: input.execution.executionId,
    browserActionId: input.browserActionId,
    beforeHash: input.beforeHash,
    runtimeLogRef: input.execution.runtimeLogRef,
    amazonOrderId: input.mission.amazonOrderId,
    ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
  });
  let openResult: Awaited<ReturnType<BrowserTargetLease["open"]>>;
  try {
    openResult = await input.browser.open({
      url: input.detailUrl,
      title: "Amazon Seller Central approved order detail",
      reusePolicy: input.reusePolicy,
      browserActionId: input.browserActionId,
      abortSignal: input.execution.abortSignal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return persistAndEmitNavigationOutcome({
      ...input,
      actionResult: "failed",
      navigationMode: "unknown",
      observedUrlMatchesRequest: false,
      afterHash: stateHash(input.browser.getLeaseState().currentUrl),
      startedAt: fallbackStartedAt,
      durationMs: Math.max(0, Date.now() - fallbackStartedAtMs),
      reason,
    });
  }
  const structuredOpenResult = hasStructuredNavigationReceipt(openResult);
  const actionResult =
    openResult.ok &&
    structuredOpenResult &&
    openResult.observedUrlMatchesRequest
      ? "success"
      : "failed";
  const outcomeInput = {
    ...input,
    actionResult,
    navigationMode: openResult.navigationMode ?? "unknown",
    observedUrlMatchesRequest: openResult.observedUrlMatchesRequest === true,
    afterHash: stateHash(
      openResult.observedUrl ?? input.browser.getLeaseState().currentUrl,
    ),
    startedAt: openResult.startedAt ?? fallbackStartedAt,
    durationMs:
      openResult.durationMs ?? Math.max(0, Date.now() - fallbackStartedAtMs),
    reason: structuredOpenResult
      ? openResult.message
      : "BrowserTargetLease.open did not return the required structured navigation receipt.",
  } as const;
  return persistAndEmitNavigationOutcome(outcomeInput);
}

function hasStructuredNavigationReceipt(
  result: Awaited<ReturnType<BrowserTargetLease["open"]>>,
): boolean {
  return (
    result.actionKind === "open" &&
    result.startedAt !== undefined &&
    result.durationMs !== undefined &&
    result.navigationMode !== undefined &&
    result.observedUrl !== undefined &&
    result.observedUrlMatchesRequest !== undefined
  );
}

async function persistAndEmitNavigationOutcome(
  input: NavigationOutcomeInput,
): Promise<
  | { ok: true; proof: AmazonOrderNavigationProof }
  | { ok: false; failure: AmazonInvoiceUploadTaskResult }
> {
  const outcome = await persistNavigationOutcome(input);
  emitAmazonOrderDetailNavigationTerminal({
    runtimeLogger: input.runtimeLogger,
    executionId: input.execution.executionId,
    browserActionId: input.browserActionId,
    runtimeLogRef: input.execution.runtimeLogRef,
    ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
    ...(outcome.ok ? { evidenceRef: outcome.proof.evidenceRef } : {}),
    actionResult: input.actionResult,
    beforeHash: input.beforeHash,
    afterHash: input.afterHash,
    durationMs: input.durationMs,
    navigationMode: input.navigationMode,
    observedUrlMatchesRequest: input.observedUrlMatchesRequest,
    reason: input.reason,
  });
  return outcome;
}

async function persistNavigationOutcome(
  input: NavigationOutcomeInput,
): Promise<
  | { ok: true; proof: AmazonOrderNavigationProof }
  | { ok: false; failure: AmazonInvoiceUploadTaskResult }
> {
  const persisted = await input.execution.evidenceStore.appendRecord({
    missionId: input.execution.executionId,
    runId: input.execution.executionId,
    stepId: "amazon-invoice-order-detail-navigation",
    correlationId: input.browserActionId,
    sourceCapabilityId: "browser-session",
    sourceChildCapabilityId: "open",
    recordType: input.actionResult === "success" ? "evidence" : "failure",
    recordPayload: {
      schemaVersion: "amazonOrderNavigationProof.v1",
      executionId: input.execution.executionId,
      ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
      browserActionId: input.browserActionId,
      actionResult: input.actionResult,
      requestedHost: hostFromUrl(input.mission.sellerCentralEntryUrl),
      reusePolicy: input.reusePolicy,
      navigationMode: input.navigationMode,
      observedUrlMatchesRequest: input.observedUrlMatchesRequest,
      beforeHash: input.beforeHash,
      afterHash: input.afterHash,
      startedAt: input.startedAt,
      durationMs: input.durationMs,
    },
    idempotencyKey: `${input.execution.executionId}:order-detail-navigation`,
  });
  const evidenceRef = persisted.recordRef;
  const storageRef = persisted.proof?.storageRef;
  const integrityHash = persisted.proof?.integrityHash;
  const evidenceOk =
    persisted.status === "success" &&
    evidenceRef &&
    storageRef &&
    integrityHash;
  if (!evidenceOk) {
    return navigationPersistenceFailure(input, persisted.failureReason);
  }
  const proof = buildNavigationProof(
    input,
    evidenceRef,
    storageRef,
    integrityHash,
  );
  if (input.actionResult === "failed")
    return navigationActionFailure(input, proof);
  return { ok: true, proof };
}

function buildNavigationProof(
  input: NavigationOutcomeInput,
  evidenceRef: string,
  storageRef: string,
  integrityHash: string,
): AmazonOrderNavigationProof {
  return {
    executionId: input.execution.executionId,
    ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
    browserActionId: input.browserActionId,
    actionResult: input.actionResult,
    requestedHost: hostFromUrl(input.mission.sellerCentralEntryUrl),
    reusePolicy: input.reusePolicy,
    navigationMode: input.navigationMode,
    observedUrlMatchesRequest: input.observedUrlMatchesRequest,
    beforeHash: input.beforeHash,
    afterHash: input.afterHash,
    startedAt: input.startedAt,
    durationMs: input.durationMs,
    evidenceRef,
    storageRef,
    integrityHash,
  };
}

function navigationPersistenceFailure(
  input: NavigationOutcomeInput,
  failureReason: string | undefined,
): { ok: false; failure: AmazonInvoiceUploadTaskResult } {
  return {
    ok: false,
    failure: taskResult({
      status: "failed",
      reason: `Order-detail navigation proof persistence failed: ${failureReason ?? "missing proof ref or integrity hash"}`,
      reachedStep: "persist order detail navigation proof",
      amazonOrderId: input.mission.amazonOrderId,
      invoiceNo: input.mission.invoiceNo,
      reviewRequired: true,
    }),
  };
}

function navigationActionFailure(
  input: NavigationOutcomeInput,
  proof: AmazonOrderNavigationProof,
): { ok: false; failure: AmazonInvoiceUploadTaskResult } {
  return {
    ok: false,
    failure: withNavigationProof(
      taskResult({
        status: "failed",
        reason: `Order-detail navigation failed closed: ${input.reason}`,
        reachedStep: "open approved order detail",
        amazonOrderId: input.mission.amazonOrderId,
        invoiceNo: input.mission.invoiceNo,
        reviewRequired: true,
      }),
      proof,
      input.execution.runtimeLogRef,
    ),
  };
}

function withNavigationProof(
  result: AmazonInvoiceUploadTaskResult,
  proof: AmazonOrderNavigationProof,
  runtimeLogRef: string,
): AmazonInvoiceUploadTaskResult {
  return { ...result, runtimeLogRef, orderNavigationProof: proof };
}

function stateHash(value: string): string {
  return createHash("sha256")
    .update(value || "about:blank")
    .digest("hex");
}

function hostFromUrl(value: string): string {
  try {
    return new URL(value).host || "local-file";
  } catch {
    return "unknown";
  }
}

async function orderDetailReusePolicy(
  browser: BrowserTargetLease,
): Promise<BrowserOpenReusePolicy> {
  await refreshCurrentBrowserState(browser);
  return "reuse-exact-url";
}

async function refreshCurrentBrowserState(
  browser: BrowserTargetLease,
): Promise<void> {
  await browser.getGeometrySnapshot().catch(() => null);
}

export function buildApprovedOrderDetailUrl(
  mission: AmazonInvoiceUploadMissionInput,
): string {
  const url = new URL(mission.sellerCentralEntryUrl);
  if (url.protocol === "file:") return mission.sellerCentralEntryUrl;
  url.pathname = `/orders-v3/order/${encodeURIComponent(mission.amazonOrderId)}`;
  url.search = "";
  return url.toString();
}
