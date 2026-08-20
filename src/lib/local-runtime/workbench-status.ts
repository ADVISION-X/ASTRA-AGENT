import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import type {
  WorkbenchHealthComponent,
  WorkbenchHealthReport,
  WorkbenchInitializationState,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";

type WorkbenchStatusAssembly = Pick<WorkbenchAssembly, "browserAuthority">;
type AiProductionHealthSnapshot = {
  readonly status: "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly contractManifestHash: string;
  readonly activeCount: number;
  readonly lastSuccessfulHeartbeatAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorReason: string | null;
  readonly checkedAt: string;
} | null;

const readRuntimeInitializationComponent = (
  state: WorkbenchInitializationState,
): WorkbenchHealthComponent => ({
  name: "runtimeInitialization",
  ok: state.status === "ready",
  detail: state.status === "ready"
    ? "Mandatory runtime owners initialized."
    : state.status === "initializing"
      ? "Mandatory runtime owners are initializing."
      : `Mandatory runtime owner initialization failed: ${state.failureReason ?? "unknown failure"}`,
  actionableMessage: state.status === "failed"
    ? "Inspect the startup terminal failure and repair the named runtime owner before restarting."
    : null,
  ownerResponsible: "local-runtime",
});

const readAiProductionComponent = (
  health: AiProductionHealthSnapshot,
): WorkbenchHealthComponent | null => {
  if (!health) return null;
  const ok = health.status === "ready";
  const detail = ok
    ? `AI production worker contract ready; active=${health.activeCount}; manifest=${health.contractManifestHash}.`
    : `AI production worker ${health.status}; code=${health.lastErrorCode ?? "unknown"}; manifest=${health.contractManifestHash}; reason=${health.lastErrorReason ?? "unknown"}.`;
  return {
    name: "xuanxueAiProductionWorker",
    ok,
    detail,
    actionableMessage: ok
      ? null
      : health.status === "contract_blocked"
        ? "Deploy xuanxue-web and AGENT with the same localization contract manifest and product hashes before restarting."
        : "Inspect the xuanxue-ai-production worker error and restore its cloud/API dependency without changing task identity.",
    ownerResponsible: "xuanxue-ai-production",
  };
};

const readBrowserAuthorityComponent = (
  assembly: WorkbenchStatusAssembly,
): WorkbenchHealthComponent => {
  try {
    const authority = assembly.browserAuthority.broker.currentStatus();
    const present = authority.kind === "AVAILABLE";
    return {
      name: "browserAuthority",
      ok: present,
      detail: present
        ? `Authenticated browser authority present: ${authority.certificateHash}.`
        : `Browser authority absent: ${authority.reasonCode}`,
      actionableMessage: present
        ? null
        : "Repair the enrolled Chrome profile, signed Native Host, extension or transport identity before admitting browser work.",
      ownerResponsible: "Browser",
    };
  } catch (error) {
    return {
      name: "browserAuthority",
      ok: false,
      detail: error instanceof Error ? error.message : "browser authority check failed",
      actionableMessage: "Repair the browser infrastructure authority chain before admitting browser work.",
      ownerResponsible: "Browser",
    };
  }
};

export async function getHealthReport(
  assembly: WorkbenchStatusAssembly,
  initialization: WorkbenchInitializationState,
  aiProductionHealth: AiProductionHealthSnapshot = null,
): Promise<WorkbenchHealthReport> {
  const checkedAt = new Date().toISOString();
  const productionComponent = readAiProductionComponent(aiProductionHealth);
  const components = [
    readRuntimeInitializationComponent(initialization),
    ...(productionComponent ? [productionComponent] : []),
    readBrowserAuthorityComponent(assembly),
  ];
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
  const components = [readBrowserAuthorityComponent(assembly)];
  const allReady = components.every((component) => component.ok);
  return {
    status: allReady ? "ready" : "not_ready",
    reason: allReady
      ? "Browser authority and mission runtime are ready."
      : components.find((component) => !component.ok)?.detail ?? "Browser authority readiness failed.",
    components,
    checkedAt,
  };
}

export async function getMissionStartPreflight(
  assembly: WorkbenchStatusAssembly,
  _options: GrassEyeWorkbenchOptions,
  _input: unknown,
): Promise<WorkbenchPreflightResult> {
  const component = readBrowserAuthorityComponent(assembly);
  if (!component.ok) {
    return {
      status: "blocked",
      actionableMessage: component.actionableMessage ?? "Resolve the browser authority failure.",
      failureReason: component.detail ?? "Browser authority failed.",
      recommendedAction: "Repair browser infrastructure before starting the mission.",
      ownerResponsible: component.ownerResponsible ?? "Browser",
      components: [component],
    };
  }

  return {
    status: "ready",
    actionableMessage: "Mission can start under the current authenticated browser authority.",
    failureReason: null,
    recommendedAction: "Run the governed mission flow.",
    ownerResponsible: "local-runtime",
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
