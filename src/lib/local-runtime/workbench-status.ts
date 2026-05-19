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

import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import type {
  WorkbenchHealthComponent,
  WorkbenchHealthReport,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";

// ─── Types ──────────────────────────────────────────────────────────────────

type WorkbenchStatusAssembly = Pick<
  WorkbenchAssembly,
  "browserController" | "aiAbilityGroup"
>;

const readBrowserSessionComponent = (
  assembly: WorkbenchStatusAssembly,
  detailPrefix: string,
  failureMessage: string,
): WorkbenchHealthComponent => {
  try {
    const state = assembly.browserController.getSessionState();
    return {
      name: "browserSession",
      ok: true,
      detail: `${detailPrefix}${state.browserMode}`,
      actionableMessage: null,
      ownerResponsible: "Browser Session",
    };
  } catch (err) {
    return {
      name: "browserSession",
      ok: false,
      detail: err instanceof Error ? err.message : "browser session check failed",
      actionableMessage: failureMessage,
      ownerResponsible: "Browser Session",
    };
  }
};

const readAiHealthComponent = async (
  assembly: WorkbenchStatusAssembly,
): Promise<WorkbenchHealthComponent> => {
  const aiHealth = await assembly.aiAbilityGroup.getHealth();
  return {
    name: "onlineAi",
    ok: aiHealth.ok,
    detail: aiHealth.detail,
    actionableMessage: aiHealth.ok ? null : "Open Settings and save a Google Gemini API key.",
    ownerResponsible: "AI Capability / Online Gemini Runtime",
  };
};

// ─── Health Report ───────────────────────────────────────────────────────────

export async function getHealthReport(
  assembly: WorkbenchStatusAssembly,
): Promise<WorkbenchHealthReport> {
  const checkedAt = new Date().toISOString();
  const components = [
    readBrowserSessionComponent(
      assembly,
      "Browser session state: ",
      "Ensure browser is configured and accessible.",
    ),
  ];

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
  assembly: WorkbenchStatusAssembly,
  _options: GrassEyeWorkbenchOptions,
): Promise<WorkbenchMissionReadinessReport> {
  const checkedAt = new Date().toISOString();
  const components = [
    readBrowserSessionComponent(
      assembly,
      "browserMode: ",
      "Ensure browser is configured.",
    ),
    await readAiHealthComponent(assembly),
  ];

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
  assembly: WorkbenchStatusAssembly,
  _options: GrassEyeWorkbenchOptions,
  input: unknown,
): Promise<WorkbenchPreflightResult> {
  const components = [await readAiHealthComponent(assembly)];

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
