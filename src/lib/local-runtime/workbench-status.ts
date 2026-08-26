import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import type {
  WorkbenchHealthComponent,
  WorkbenchHealthReport,
  WorkbenchInitializationState,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";

type WorkbenchStatusAssembly = Readonly<{
  browserAuthority: Pick<WorkbenchAssembly["browserAuthority"], "broker">;
}>;
type AiProductionHealthSnapshot = {
  readonly shellState: "ready" | "stopped";
  readonly cloudState: "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly browserState: "ready" | "blocked";
  readonly executionState: "ready" | "blocked" | "draining";
  readonly claimAdmissionState: "eligible" | "blocked" | "draining";
  readonly browserAuthorityState: "present" | "absent";
  readonly browserTargetState: "claimed" | "absent";
  readonly browserLaneState: "idle" | "busy" | "blocked";
  readonly contractManifestHash: string;
  readonly activeCount: number;
  readonly lastSuccessfulHeartbeatAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorReason: string | null;
  readonly checkedAt: string;
} | null;

export const runtimeInitializationDisposition = (
  _failureReason: string | null,
): Readonly<{ actionableMessage: string; ownerResponsible: string }> => ({
  actionableMessage: "Inspect the startup terminal failure and repair the named runtime owner before restarting.",
  ownerResponsible: "local-runtime",
});

const readRuntimeInitializationComponent = (
  state: WorkbenchInitializationState,
): WorkbenchHealthComponent => {
  const disposition = runtimeInitializationDisposition(state.failureReason);
  return {
    name: "runtimeInitialization",
    ok: state.status === "ready",
    detail: state.status === "ready"
      ? "Mandatory runtime owners initialized."
      : state.status === "initializing"
        ? "Mandatory runtime owners are initializing."
        : `Mandatory runtime owner initialization failed: ${state.failureReason ?? "unknown failure"}`,
    actionableMessage: state.status === "failed" ? disposition.actionableMessage : null,
    ownerResponsible: state.status === "failed" ? disposition.ownerResponsible : "local-runtime",
  };
};

const readAiProductionComponents = (
  health: AiProductionHealthSnapshot,
): readonly WorkbenchHealthComponent[] => {
  if (!health) return [];
  return [
    {
      name: "xuanxueAiProductionShell",
      ok: health.shellState === "ready",
      detail: `Shell state=${health.shellState}.`,
      actionableMessage: health.shellState === "ready" ? null : "Restart the local Workbench shell.",
      ownerResponsible: "local-runtime",
    },
    {
      name: "agentCloudWorker",
      ok: health.cloudState === "ready",
      detail: `AGENT Cloud Worker state=${health.cloudState}; manifest=${health.contractManifestHash}; last_heartbeat=${health.lastSuccessfulHeartbeatAt ?? "none"}; error=${health.lastErrorCode ?? "none"}.`,
      actionableMessage: health.cloudState === "ready" ? null
        : health.cloudState === "contract_blocked"
          ? "Deploy xuanxue-web and AGENT with the exact same V6 manifest and product contract hashes."
          : "Restore the AGENT Cloud Worker session/API dependency without changing task identity.",
      ownerResponsible: "xuanxue-ai-production",
    },
    {
      name: "xuanxueAiProductionBrowser",
      ok: health.browserState === "ready",
      detail: `Browser state=${health.browserState}; authority=${health.browserAuthorityState}; target=${health.browserTargetState}; lane=${health.browserLaneState}.`,
      actionableMessage: health.browserState === "ready" ? null : "Restore Browser Authority and claim the exact HTTPS target.",
      ownerResponsible: "Browser",
    },
    {
      name: "xuanxueAiProductionExecution",
      ok: health.executionState === "ready",
      detail: `Execution state=${health.executionState}; claim_admission=${health.claimAdmissionState}; active=${health.activeCount}.`,
      actionableMessage: health.executionState === "ready" ? null : "Resolve the named Cloud or Browser block before admitting production work.",
      ownerResponsible: "xuanxue-ai-production",
    },
  ];
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
        : "Load the fixed unpacked extension, complete a fresh local pairing, then let the extension actor establish the one loopback WebSocket before admitting browser work.",
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
  const productionComponents = readAiProductionComponents(aiProductionHealth);
  const startupComponents = [
    readRuntimeInitializationComponent(initialization),
    ...productionComponents.slice(0, 2),
  ];
  const components = [
    ...startupComponents,
    ...productionComponents.slice(2),
    readBrowserAuthorityComponent(assembly),
  ];
  const allOk = startupComponents.every((component) => component.ok);
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
