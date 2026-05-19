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
 *   - Substitute or inject a target URL.
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
  const parsed = OpenPlatformEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    return openFailure("open-platform-entry-once", `INPUT_INVALID: ${parsed.error.message}`);
  }
  const target = resolvePlatformTarget(parsed.data);
  if (!target.ok) return target.result;
  const openResultRef = `open-result:${randomUUID()}`;
  const navigationAttemptProofRef = `open-proof:${randomUUID()}`;
  const opened = await openPlatformUrl(browserOpenPort, target.url, parsed.data.timeoutMs);
  const base = { childCapabilityId: "open-platform-entry-once" as const, openResultRef, navigationAttemptProofRef, targetProfileRef: parsed.data.targetProfileRef, targetUrlSource: target.source };
  if (!opened.ok) return { status: "failed", ...base, failureReason: opened.failureReason };
  const observation = await readPlatformObservation(browserOpenPort, opened.browserResult);
  if (!opened.browserResult.ok) return { status: "failed", ...base, ...observation, failureReason: opened.browserResult.failureMessage ?? "BROWSER_OPEN_FAILED" };
  return {
    status: "success",
    ...base,
    ...observation,
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
    return openFailure("open-local-workbench-once", `INPUT_INVALID: ${parsed.error.message}`);
  }

  const validation = validateTargetUrl(parsed.data.workbenchUrl);
  if (!validation.ok) {
    return openFailure("open-local-workbench-once", validation.failureReason);
  }
  const openResultRef = `open-result:${randomUUID()}`;
  const navigationAttemptProofRef = `open-proof:${randomUUID()}`;
  const opened = await openWorkbenchUrl(workbenchOpenPort, validation.url.toString(), parsed.data.timeoutMs);
  const base = { childCapabilityId: "open-local-workbench-once" as const, openResultRef, navigationAttemptProofRef };
  if (!opened.ok) return { status: "failed", ...base, failureReason: opened.failureReason };
  if (!opened.browserResult.ok) return { status: "failed", ...base, failureReason: opened.browserResult.failureMessage ?? "WORKBENCH_OPEN_FAILED" };
  return { status: "success", ...base, ...observationFromBrowserResult(opened.browserResult) };
}

const openFailure = (
  childCapabilityId: OpenResult["childCapabilityId"],
  failureReason: string,
): OpenResult => ({
  status: "failed",
  childCapabilityId,
  openResultRef: `open-result:${randomUUID()}`,
  navigationAttemptProofRef: `open-proof:${randomUUID()}`,
  failureReason,
});

const resolvePlatformTarget = (
  input: {
    targetUrl?: string | undefined;
    targetUrlSource?: "user" | "platformRegistry" | "system" | undefined;
  },
): { ok: true; url: string; source: "user" | "platformRegistry" | "system" } | { ok: false; result: OpenResult } => {
  if (!input.targetUrl || !input.targetUrlSource) {
    return { ok: false, result: openFailure("open-platform-entry-once", "OPEN_TARGET_MISSING: must provide targetUrl+targetUrlSource (PlatformProfile.entryUrl is the single URL truth)") };
  }
  const validation = validateTargetUrl(input.targetUrl);
  if (!validation.ok) {
    return { ok: false, result: { ...openFailure("open-platform-entry-once", validation.failureReason), targetUrlSource: input.targetUrlSource } };
  }
  return { ok: true, url: validation.url.toString(), source: input.targetUrlSource };
};

const openPlatformUrl = async (
  port: BrowserOpenPort,
  url: string,
  timeoutMs?: number,
) => {
  try {
    return { ok: true as const, browserResult: await port.openUrl({ url, ...(timeoutMs != null ? { timeoutMs } : {}) }) };
  } catch (error) {
    return { ok: false as const, failureReason: `BROWSER_OPEN_THREW: ${error instanceof Error ? error.message : String(error)}` };
  }
};

const openWorkbenchUrl = async (
  port: WorkbenchOpenPort,
  url: string,
  timeoutMs?: number,
) => {
  try {
    return { ok: true as const, browserResult: await port.openWorkbench({ url, ...(timeoutMs != null ? { timeoutMs } : {}) }) };
  } catch (error) {
    return { ok: false as const, failureReason: `WORKBENCH_OPEN_THREW: ${error instanceof Error ? error.message : String(error)}` };
  }
};

const readPlatformObservation = async (
  port: BrowserOpenPort,
  browserResult: Awaited<ReturnType<BrowserOpenPort["openUrl"]>>,
) => {
  if (!port.readRawObservation) return observationFromBrowserResult(browserResult);
  try {
    const raw = await port.readRawObservation();
    return observationRefs({ currentUrl: raw.currentUrl, currentTitle: raw.currentTitle, browserSessionRef: raw.browserSessionRef, navigationStartedAt: raw.navigationStartedAt, navigationEndedAt: raw.navigationEndedAt, rawRuntimeSignals: raw.rawRuntimeSignals });
  } catch {
    return observationFromBrowserResult(browserResult);
  }
};

const observationFromBrowserResult = (browserResult: {
  currentUrl?: string;
  currentTitle?: string;
  browserSessionRef?: string;
  navigationStartedAt?: string;
  navigationEndedAt?: string;
}) => browserResult.currentUrl || browserResult.currentTitle
  ? observationRefs({ currentUrl: browserResult.currentUrl, currentTitle: browserResult.currentTitle, browserSessionRef: browserResult.browserSessionRef, navigationStartedAt: browserResult.navigationStartedAt, navigationEndedAt: browserResult.navigationEndedAt })
  : {};

const observationRefs = (rawOpenObservation: RawOpenObservation) => ({
  rawOpenObservation,
  rawBrowserObservationRef: `raw-observation:${randomUUID()}`,
});
