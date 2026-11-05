import type { WorkbenchAssembly } from "./workbench-assembly.js";
import type {
  WorkbenchHealthComponent,
  WorkbenchHealthReport,
  WorkbenchInitializationState,
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
  readonly controlContractVersion: number | null;
  readonly activeCount: number;
  readonly lastSuccessfulHeartbeatAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorReason: string | null;
  readonly checkedAt: string;
} | null;

export const runtimeInitializationDisposition = (): Readonly<{ actionableMessage: string; ownerResponsible: string }> => ({
  actionableMessage: "Inspect the startup terminal failure and repair the named runtime owner before restarting.",
  ownerResponsible: "local-runtime",
});

const readRuntimeInitializationComponent = (
  state: WorkbenchInitializationState,
): WorkbenchHealthComponent => {
  const disposition = runtimeInitializationDisposition();
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
  const browserReady = health.browserState === "ready" && health.browserLaneState !== "blocked";
  return [
    {
      name: "productionRuntimeShell",
      ok: health.shellState === "ready",
      detail: `Shell state=${health.shellState}.`,
      actionableMessage: health.shellState === "ready" ? null : "Restart the local Workbench shell.",
      ownerResponsible: "local-runtime",
    },
    {
      name: "agentCloudWorker",
      ok: health.cloudState === "ready",
      detail: `AGENT Cloud Worker state=${health.cloudState}; control_contract_version=${health.controlContractVersion ?? "none"}; last_heartbeat=${health.lastSuccessfulHeartbeatAt ?? "none"}; error=${health.lastErrorCode ?? "none"}.`,
      actionableMessage: health.cloudState === "ready" ? null
        : health.lastErrorCode === "AI_DEVICE_REVOKED"
          ? "Ask the Website owner to verify this exact device. Use authorized enrollment only after explicit revocation."
          : health.lastErrorCode === "AI_SESSION_BINDING_MISMATCH" || health.lastErrorCode === "PRODUCTION_SESSION_BINDING_INVALID"
          ? "Keep every existing job and attempt unchanged. Compare the enrolled device, environment, origin and control contract version; use enrollment only for a first device or explicit revoked-device recovery. Do not retry the same binding."
        : health.cloudState === "contract_blocked"
          ? "Deploy the Website provider contract and AGENT consumer dependency at the exact same control contract version."
          : "Restore the AGENT Cloud Worker session/API dependency without changing task identity.",
      ownerResponsible: "production-runtime",
    },
    {
      name: "productionRuntimeBrowser",
      ok: browserReady,
      detail: `Browser state=${health.browserState}; authority=${health.browserAuthorityState}; target=${health.browserTargetState}; lane=${health.browserLaneState}.`,
      actionableMessage: browserReady ? null : health.browserState !== "ready"
        ? "Restore the fixed extension's authenticated Browser Authority; Target creation belongs to authorized execution."
        : "Preserve existing jobs and the unresolved Browser WAL. Obtain the original command's trusted terminal receipt through the existing settlement chain; never replay unknown input.",
      ownerResponsible: "Browser",
    },
    {
      name: "productionRuntimeExecution",
      ok: health.executionState === "ready",
      detail: `Execution state=${health.executionState}; claim_admission=${health.claimAdmissionState}; active=${health.activeCount}.`,
      actionableMessage: health.executionState === "ready" ? null
        : "Inspect the separate Cloud, Browser lane, log sink and draining facts; preserve accepted work and deliver existing results under current authority.",
      ownerResponsible: "production-runtime",
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
