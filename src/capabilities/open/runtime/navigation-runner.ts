import type {
  BrowserSessionSnapshot,
  ParsedOpenRequest,
  OpenTargetProfile,
} from "../contract.js";
import type { OpenBrowserPort } from "../ports/open-browser-port.js";
import { BrowserSessionSnapshotSchema } from "../schema.js";
import type {
  OpenNavigationRunResult,
  SessionSnapshotResult,
} from "./navigation-runner-result-builders.js";
import {
  buildAlreadyOnTargetNavigationResult,
  buildSessionSnapshotFailureReason,
  buildTimedOutNavigationResult,
} from "./navigation-runner-result-builders.js";
import {
  finalizeNavigationAfterAttempt,
  runNavigationAttempt,
} from "./navigation-runner-support.js";

type OpenNavigationInput = {
  browser: OpenBrowserPort;
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  targetUrl: string;
  targetTitle: string;
  timeoutMs: number;
  idempotencyKey: string;
  reservationDecision: "reserved" | "already_on_target";
  alreadyOnTargetDecision: "not_applicable" | "freshness_required";
  targetProfileRef: string | null;
  beforeSession: BrowserSessionSnapshot;
};

async function safeReadSessionSnapshot(browser: OpenBrowserPort): Promise<SessionSnapshotResult> {
  try {
    return {
      ok: true,
      snapshot: BrowserSessionSnapshotSchema.parse(await browser.getSessionSnapshot()),
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      snapshot: null,
      reason: buildSessionSnapshotFailureReason(error),
    };
  }
}

export async function runOpenNavigation(input: OpenNavigationInput): Promise<OpenNavigationRunResult> {
  if (input.reservationDecision === "already_on_target") {
    return buildAlreadyOnTargetNavigationResult({
      beforeSession: input.beforeSession,
      targetUrl: input.targetUrl,
      idempotencyKey: input.idempotencyKey,
      alreadyOnTargetDecision: input.alreadyOnTargetDecision,
    });
  }

  const abortController = new AbortController();
  let navigationResult;
  try {
    navigationResult = await runNavigationAttempt(input, abortController);
  } catch (error) {
    const snapshotResult = await safeReadSessionSnapshot(input.browser);
    return buildTimedOutNavigationResult({
      beforeSession: input.beforeSession,
      targetUrl: input.targetUrl,
      idempotencyKey: input.idempotencyKey,
      error,
      snapshotResult,
    });
  }

  const snapshotResult = await safeReadSessionSnapshot(input.browser);
  return finalizeNavigationAfterAttempt(
    {
      beforeSession: input.beforeSession,
      targetUrl: input.targetUrl,
      idempotencyKey: input.idempotencyKey,
    },
    navigationResult,
    snapshotResult,
  );
}
