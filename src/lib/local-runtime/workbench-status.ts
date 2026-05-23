import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import type {
  WorkbenchHealthComponent,
  WorkbenchHealthReport,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";

type WorkbenchStatusAssembly = Pick<WorkbenchAssembly, "browserController">;

const readBrowserSessionComponent = (
  assembly: WorkbenchStatusAssembly,
): WorkbenchHealthComponent => {
  try {
    const state = assembly.browserController.getSessionState();
    return {
      name: "browserSession",
      ok: true,
      detail: `Browser session state: ${state.browserMode}`,
      actionableMessage: null,
      ownerResponsible: "Browser",
    };
  } catch (error) {
    return {
      name: "browserSession",
      ok: false,
      detail: error instanceof Error ? error.message : "browser session check failed",
      actionableMessage: "Ensure the local browser session is configured and accessible.",
      ownerResponsible: "Browser",
    };
  }
};

export async function getHealthReport(
  assembly: WorkbenchStatusAssembly,
): Promise<WorkbenchHealthReport> {
  const checkedAt = new Date().toISOString();
  const components = [readBrowserSessionComponent(assembly)];
  const allOk = components.every((component) => component.ok);
  return {
    status: allOk ? "healthy" : "degraded",
    components,
    checkedAt,
    sourceFingerprint: process.env.GRASSEYE_SOURCE_FINGERPRINT ?? "unknown",
  };
}

export async function getMissionReadinessReport(
  assembly: WorkbenchStatusAssembly,
  _options: GrassEyeWorkbenchOptions,
): Promise<WorkbenchMissionReadinessReport> {
  const checkedAt = new Date().toISOString();
  const components = [readBrowserSessionComponent(assembly)];
  const allReady = components.every((component) => component.ok);
  return {
    status: allReady ? "ready" : "not_ready",
    reason: allReady
      ? "Amazon invoice upload workbench is ready."
      : components.find((component) => !component.ok)?.detail ?? "Browser readiness failed.",
    components,
    checkedAt,
  };
}

export async function getMissionStartPreflight(
  assembly: WorkbenchStatusAssembly,
  _options: GrassEyeWorkbenchOptions,
  _input: unknown,
): Promise<WorkbenchPreflightResult> {
  const component = readBrowserSessionComponent(assembly);
  if (!component.ok) {
    return {
      status: "blocked",
      actionableMessage: component.actionableMessage ?? "Resolve the browser readiness failure.",
      failureReason: component.detail ?? "Browser readiness failed.",
      recommendedAction: "Open the browser session before starting the Amazon upload flow.",
      ownerResponsible: component.ownerResponsible ?? "Browser",
      components: [component],
    };
  }

  return {
    status: "ready",
    actionableMessage: "Amazon invoice upload flow can start.",
    failureReason: null,
    recommendedAction: "Run the Amazon invoice upload flow script.",
    ownerResponsible: "amazon-invoice-upload",
    components: [component],
  };
}

export function getModeInfo(options: GrassEyeWorkbenchOptions): unknown {
  return {
    platformTarget: options.platformTarget,
    baseUrl: options.baseUrl,
    dataDir: options.dataDir ?? null,
    browserModeMarker: options.browserModeMarker ?? null,
    browserHeadless: options.browserHeadless ?? false,
  };
}
