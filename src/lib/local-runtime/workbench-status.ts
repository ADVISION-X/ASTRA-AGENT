/**
 * workbench-status.ts — Health, readiness, and mode info for the workbench.
 *
 * Provides:
 *   getHealthReport()          — runtime health snapshot
 *   getMissionReadinessReport() — mission readiness check
 *   getMissionStartPreflight() — start-mission preflight gate
 *   getModeInfo()              — mode/options snapshot
 *
 * Does NOT contain: mission truth, AI role controls, or Forensics finalization.
 */

import { getOpenLocalProgramAdapterReadiness } from "./open-local-program-adapter.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkbenchHealthComponent = {
  name: string;
  ok: boolean;
  detail: string | null;
  actionableMessage: string | null;
  ownerResponsible: string | null;
};

export type WorkbenchHealthReport = {
  status: "healthy" | "degraded" | "unhealthy";
  components: WorkbenchHealthComponent[];
  checkedAt: string;
};

export type WorkbenchMissionReadinessReport = {
  status: "ready" | "not_ready";
  reason: string;
  components: WorkbenchHealthComponent[];
  checkedAt: string;
};

export type WorkbenchPreflightInput = {
  requestedPlatformId: string | null;
  targetProfileRef: string | null;
  targetUrl: string | null;
  targetTitle: string | null;
  userRequirementRef: string | null;
};

export type WorkbenchPreflightResult = {
  status: "ready" | "blocked" | "warning";
  actionableMessage: string;
  failureReason: string | null;
  nextAction: string;
  ownerResponsible: string;
  components: WorkbenchHealthComponent[];
};

// ─── Health Report ───────────────────────────────────────────────────────────

export async function getHealthReport(
  assembly: Pick<WorkbenchAssembly, "browserController" | "aiAbilityGroup">,
): Promise<WorkbenchHealthReport> {
  const components: WorkbenchHealthComponent[] = [];
  const checkedAt = new Date().toISOString();

  // Browser session health
  try {
    const state = assembly.browserController.getSessionState();
    components.push({
      name: "browserSession",
      ok: true,
      detail: `Browser session state: ${state.browserMode}`,
      actionableMessage: null,
      ownerResponsible: "Browser Session",
    });
  } catch (err) {
    components.push({
      name: "browserSession",
      ok: false,
      detail: err instanceof Error ? err.message : "browser session check failed",
      actionableMessage: "Ensure browser is configured and accessible.",
      ownerResponsible: "Browser Session",
    });
  }

  // Open local program readiness (macOS mirroring)
  try {
    const readiness = await getOpenLocalProgramAdapterReadiness();
    components.push({
      name: "localProgram",
      ok: readiness.ok,
      detail: readiness.detail ?? null,
      actionableMessage: readiness.ok ? null : "Ensure iPhone Mirroring is installed and accessible.",
      ownerResponsible: "Open Capability / Local Program Adapter",
    });
  } catch {
    components.push({
      name: "localProgram",
      ok: false,
      detail: "local program readiness check failed",
      actionableMessage: "Check local program adapter configuration.",
      ownerResponsible: "Open Capability / Local Program Adapter",
    });
  }

  const allOk = components.every((c) => c.ok);
  const anyFailed = components.some((c) => !c.ok);

  return {
    status: allOk ? "healthy" : anyFailed ? "degraded" : "unhealthy",
    components,
    checkedAt,
  };
}

// ─── Mission Readiness Report ─────────────────────────────────────────────────

export async function getMissionReadinessReport(
  assembly: Pick<WorkbenchAssembly, "browserController" | "aiAbilityGroup">,
  options: GrassEyeWorkbenchOptions,
): Promise<WorkbenchMissionReadinessReport> {
  const components: WorkbenchHealthComponent[] = [];
  const checkedAt = new Date().toISOString();

  // Browser session readiness
  try {
    const state = assembly.browserController.getSessionState();
    components.push({
      name: "browserSession",
      ok: true,
      detail: `browserMode: ${state.browserMode}`,
      actionableMessage: null,
      ownerResponsible: "Browser Session",
    });
  } catch (err) {
    components.push({
      name: "browserSession",
      ok: false,
      detail: err instanceof Error ? err.message : "browser session check failed",
      actionableMessage: "Ensure browser is configured.",
      ownerResponsible: "Browser Session",
    });
  }

  // Local AI model readiness
  components.push({
    name: "localAi",
    ok: options.startupReadiness?.localAiReady ?? false,
    detail: options.startupReadiness?.detail ?? null,
    actionableMessage: options.startupReadiness?.localAiReady
      ? null
      : "Ensure Ollama is running and the local AI model is loaded.",
    ownerResponsible: "AI Capability / Local AI Runtime",
  });

  const allReady = components.every((c) => c.ok);
  return {
    status: allReady ? "ready" : "not_ready",
    reason: allReady
      ? "All mission readiness checks passed."
      : components.find((c) => !c.ok)?.detail ?? "One or more readiness checks failed.",
    components,
    checkedAt,
  };
}

// ─── Mission Start Preflight ──────────────────────────────────────────────────

export async function getMissionStartPreflight(
  assembly: Pick<WorkbenchAssembly, "browserController" | "aiAbilityGroup">,
  options: GrassEyeWorkbenchOptions,
  input: unknown,
): Promise<WorkbenchPreflightResult> {
  const components: WorkbenchHealthComponent[] = [];

  // Local AI readiness
  const localAiReady = options.startupReadiness?.localAiReady ?? false;
  components.push({
    name: "localAi",
    ok: localAiReady,
    detail: options.startupReadiness?.detail ?? (localAiReady ? "Local AI is ready." : "Local AI not ready."),
    actionableMessage: localAiReady ? null : "Start Ollama and ensure the visual mission model is loaded.",
    ownerResponsible: "AI Capability / Local AI Runtime",
  });

  const blocked = components.find((c) => !c.ok);
  if (blocked) {
    return {
      status: "blocked",
      actionableMessage: blocked.actionableMessage ?? "One or more preflight checks failed.",
      failureReason: blocked.detail ?? "Preflight check failed.",
      nextAction: blocked.actionableMessage ?? "Resolve the blocking condition and retry.",
      ownerResponsible: blocked.ownerResponsible ?? "GrassEye Runtime",
      components,
    };
  }

  return {
    status: "ready",
    actionableMessage: "All mission start preflight checks passed. Proceed with mission dispatch.",
    failureReason: null,
    nextAction: "Dispatch the governed human command through Commander Console and Nerve Bus.",
    ownerResponsible: "Commander Console / Nerve Bus",
    components,
  };
}

// ─── Mode Info ────────────────────────────────────────────────────────────────

export function getModeInfo(options: GrassEyeWorkbenchOptions): unknown {
  return {
    platformTarget: options.platformTarget,
    baseUrl: options.baseUrl,
    dataDir: options.dataDir ?? null,
    browserHeadless: options.browserHeadless ?? false,
    startupReadiness: options.startupReadiness ?? null,
  };
}
