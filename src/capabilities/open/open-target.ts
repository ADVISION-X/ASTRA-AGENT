/**
 * open-target.ts — Core Open runtime.
 *
 * Responsibilities (exhaustive):
 *   1. Validate input (fail closed on missing required fields).
 *   2. Resolve target profile to URL via url-policy.
 *   3. Run URL policy.
 *   4. Call browserOpenPort.openUrl().
 *   5. Build rawOpenObservation.
 *   6. Return OpenResult with proof refs.
 *
 * Does NOT:
 *   - Judge page readiness, correctness, or login state.
 *   - Fall back to a default URL.
 *   - Import AI, screenshot, mouse, geometry, orchestration, or forensics.
 */

import { randomUUID } from "node:crypto";

import type { BrowserOpenPort } from "./browser-open-port.js";
import type { WorkbenchOpenPort } from "./browser-open-port.js";
import {
  OpenPlatformEntryInputSchema,
  OpenLocalWorkbenchInputSchema,
  type OpenResult,
  type RawOpenObservation,
} from "./schema.js";
import {
  hashTargetUrl,
  resolvePlatformTarget,
  validateTargetUrl,
} from "./url-policy.js";

// ─── Open Platform Entry Once ───────────────────────────────────────────────

export interface OpenPlatformEntryOnceInput {
  missionId: string;
  runId: string;
  sessionId?: string;
  roundId?: string;
  stepId: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  requestedBy: string;
  inputRef: string;
  idempotencyKey: string;
  timeoutMs?: number;
  childCapabilityId: "open-platform-entry-once";
  targetProfileRef?: string;
  targetUrl?: string;
  targetUrlSource?: "user" | "platformRegistry" | "system";
}

export async function openPlatformEntryOnce(
  input: OpenPlatformEntryOnceInput,
  browserOpenPort: BrowserOpenPort,
): Promise<OpenResult> {
  const startedAt = new Date().toISOString();

  // Validate input shape
  const parsed = OpenPlatformEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    const endedAt = new Date().toISOString();
    return {
      status: "failed",
      childCapabilityId: "open-platform-entry-once",
      openResultRef: `open-result:${randomUUID()}`,
      navigationAttemptProofRef: `open-proof:${randomUUID()}`,
      failureReason: `INPUT_INVALID: ${parsed.error.message}`,
    };
  }

  // Resolve target URL
  let resolvedUrl: string;
  let resolvedTargetProfileRef: string | undefined;
  let resolvedTargetUrlSource: "user" | "platformRegistry" | "system" | undefined;

  if (parsed.data.targetProfileRef) {
    const resolution = resolvePlatformTarget(parsed.data.targetProfileRef);
    if (!resolution.ok) {
      const endedAt = new Date().toISOString();
      return {
        status: "failed",
        childCapabilityId: "open-platform-entry-once",
        openResultRef: `open-result:${randomUUID()}`,
        navigationAttemptProofRef: `open-proof:${randomUUID()}`,
        targetProfileRef: parsed.data.targetProfileRef,
        failureReason: resolution.failureReason,
      };
    }
    resolvedUrl = resolution.url;
    resolvedTargetProfileRef = parsed.data.targetProfileRef;
    resolvedTargetUrlSource = "platformRegistry";
  } else if (parsed.data.targetUrl && parsed.data.targetUrlSource) {
    const validation = validateTargetUrl(parsed.data.targetUrl);
    if (!validation.ok) {
      return {
        status: "failed",
        childCapabilityId: "open-platform-entry-once",
        openResultRef: `open-result:${randomUUID()}`,
        navigationAttemptProofRef: `open-proof:${randomUUID()}`,
        targetUrlSource: parsed.data.targetUrlSource,
        failureReason: validation.failureReason,
      };
    }
    resolvedUrl = validation.url.toString();
    resolvedTargetUrlSource = parsed.data.targetUrlSource;
  } else {
    // Fail closed — no default fallback allowed
    return {
      status: "failed",
      childCapabilityId: "open-platform-entry-once",
      openResultRef: `open-result:${randomUUID()}`,
      navigationAttemptProofRef: `open-proof:${randomUUID()}`,
      failureReason:
        "OPEN_TARGET_MISSING: must provide targetProfileRef or targetUrl+targetUrlSource",
    };
  }

  // Open the URL via governed browser port
  const openResultRef = `open-result:${randomUUID()}`;
  const navigationAttemptProofRef = `open-proof:${randomUUID()}`;

  let browserResult;
  try {
    browserResult = await browserOpenPort.openUrl({
      url: resolvedUrl,
      timeoutMs: parsed.data.timeoutMs,
    });
  } catch (err) {
    const endedAt = new Date().toISOString();
    return {
      status: "failed",
      childCapabilityId: "open-platform-entry-once",
      openResultRef,
      navigationAttemptProofRef,
      targetProfileRef: resolvedTargetProfileRef,
      targetUrlSource: resolvedTargetUrlSource,
      failureReason: `BROWSER_OPEN_THREW: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Build raw observation — no semantic judgment
  let rawOpenObservation: RawOpenObservation | undefined;
  if (browserOpenPort.readRawObservation) {
    try {
      const raw = await browserOpenPort.readRawObservation();
      rawOpenObservation = {
        currentUrl: raw.currentUrl,
        currentTitle: raw.currentTitle,
        browserSessionRef: raw.browserSessionRef,
        navigationStartedAt: raw.navigationStartedAt,
        navigationEndedAt: raw.navigationEndedAt,
        rawRuntimeSignals: raw.rawRuntimeSignals,
      };
    } catch {
      // Observation read failure is non-fatal — Open still reports the attempt.
    }
  } else if (browserResult.currentUrl || browserResult.currentTitle) {
    rawOpenObservation = {
      currentUrl: browserResult.currentUrl,
      currentTitle: browserResult.currentTitle,
      browserSessionRef: browserResult.browserSessionRef,
      navigationStartedAt: browserResult.navigationStartedAt,
      navigationEndedAt: browserResult.navigationEndedAt,
    };
  }

  const rawBrowserObservationRef = rawOpenObservation
    ? `raw-observation:${randomUUID()}`
    : undefined;

  if (!browserResult.ok) {
    return {
      status: "failed",
      childCapabilityId: "open-platform-entry-once",
      openResultRef,
      navigationAttemptProofRef,
      targetProfileRef: resolvedTargetProfileRef,
      targetUrlSource: resolvedTargetUrlSource,
      rawOpenObservation,
      rawBrowserObservationRef,
      failureReason: browserResult.failureMessage ?? "BROWSER_OPEN_FAILED",
    };
  }

  return {
    status: "success",
    childCapabilityId: "open-platform-entry-once",
    openResultRef,
    navigationAttemptProofRef,
    targetProfileRef: resolvedTargetProfileRef,
    targetUrlSource: resolvedTargetUrlSource,
    rawOpenObservation,
    rawBrowserObservationRef,
  };
}

// ─── Open Local Workbench Once ──────────────────────────────────────────────

export interface OpenLocalWorkbenchOnceInput {
  missionId: string;
  runId: string;
  sessionId?: string;
  roundId?: string;
  stepId: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  requestedBy: string;
  inputRef: string;
  idempotencyKey: string;
  timeoutMs?: number;
  childCapabilityId: "open-local-workbench-once";
  workbenchUrl: string;
}

export async function openLocalWorkbenchOnce(
  input: OpenLocalWorkbenchOnceInput,
  workbenchOpenPort: WorkbenchOpenPort,
): Promise<OpenResult> {
  const parsed = OpenLocalWorkbenchInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "failed",
      childCapabilityId: "open-local-workbench-once",
      openResultRef: `open-result:${randomUUID()}`,
      navigationAttemptProofRef: `open-proof:${randomUUID()}`,
      failureReason: `INPUT_INVALID: ${parsed.error.message}`,
    };
  }

  const validation = validateTargetUrl(parsed.data.workbenchUrl);
  if (!validation.ok) {
    return {
      status: "failed",
      childCapabilityId: "open-local-workbench-once",
      openResultRef: `open-result:${randomUUID()}`,
      navigationAttemptProofRef: `open-proof:${randomUUID()}`,
      failureReason: validation.failureReason,
    };
  }

  const openResultRef = `open-result:${randomUUID()}`;
  const navigationAttemptProofRef = `open-proof:${randomUUID()}`;

  let browserResult;
  try {
    browserResult = await workbenchOpenPort.openWorkbench({
      url: validation.url.toString(),
      timeoutMs: parsed.data.timeoutMs,
    });
  } catch (err) {
    return {
      status: "failed",
      childCapabilityId: "open-local-workbench-once",
      openResultRef,
      navigationAttemptProofRef,
      failureReason: `WORKBENCH_OPEN_THREW: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!browserResult.ok) {
    return {
      status: "failed",
      childCapabilityId: "open-local-workbench-once",
      openResultRef,
      navigationAttemptProofRef,
      failureReason: browserResult.failureMessage ?? "WORKBENCH_OPEN_FAILED",
    };
  }

  const rawOpenObservation: RawOpenObservation | undefined =
    browserResult.currentUrl
      ? {
          currentUrl: browserResult.currentUrl,
          currentTitle: browserResult.currentTitle,
          browserSessionRef: browserResult.browserSessionRef,
          navigationStartedAt: browserResult.navigationStartedAt,
          navigationEndedAt: browserResult.navigationEndedAt,
        }
      : undefined;

  return {
    status: "success",
    childCapabilityId: "open-local-workbench-once",
    openResultRef,
    navigationAttemptProofRef,
    rawOpenObservation,
    rawBrowserObservationRef: rawOpenObservation
      ? `raw-observation:${randomUUID()}`
      : undefined,
  };
}
