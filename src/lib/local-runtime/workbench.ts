import type { GrassEyeWorkbenchOptions } from "./contract.js";
import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import { buildApiBoundaryLogHandle } from "./workbench-api-boundary-log.js";
import { createWorkbenchAssembly, type WorkbenchAssembly } from "./workbench-assembly.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import { buildSettingsHandle } from "./workbench-settings-handle.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
  runtimeInitializationDisposition,
} from "./workbench-status.js";
import type {
  WorkbenchHealthReport,
  WorkbenchInitializationState,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";
import { buildProductionRuntimeHandle } from "./workbench-production-runtime-handle.js";
import { startProductionRuntime, type ProductionRuntimeHandle } from "./production/runtime.js";
import { requireRuntimeLogWrite } from "../runtime-logs/index.js";

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
  shutdown: () => Promise<void>,
  productionRuntime: ProductionRuntimeHandle,
  getInitializationState: () => WorkbenchInitializationState,
): GrassEyeWorkbenchHandle => {
  const dataDir = assembly.dataDir;
  return {
    init,
    shutdown,
    ...buildApiBoundaryLogHandle(assembly),
    getHealthReport: async () => getHealthReport(
      assembly,
      getInitializationState(),
      productionRuntime.readHealth(),
    ),
    getMissionReadinessReport: async () => getMissionReadinessReport(assembly, assembly.options),
    getMissionStartPreflight: async (input) =>
      getMissionStartPreflight(assembly, assembly.options, input),
    getDataDir: () => dataDir,
    acceptBrowserAuthoritySocket: (input) => assembly.browserAuthority.acceptBrowserAuthoritySocket(input),
    readBrowserAuthorityPairingState: () => assembly.browserAuthority.readOperatorPairingState(),
    readBrowserExtensionBootstrapState: () => ({
      ...assembly.browserAuthority.readOperatorPairingState(),
      releaseBuildId: assembly.browserAuthority.readReleaseBuildId(),
    }),
    getModeInfo: () => getModeInfo(assembly.options),
    ...buildSettingsHandle(dataDir),
    ...buildProductionRuntimeHandle(productionRuntime),
  };
};

const authorityAbsentComponent = () => ({
  name: "browserAuthority",
  ok: false,
  detail: "Browser authority is absent while runtime initialization is incomplete.",
  actionableMessage: "Load the fixed unpacked MV3 extension, complete a fresh local pairing, then let its actor establish the one browser authority WebSocket before admitting browser work.",
  ownerResponsible: "Browser",
});

const requireSourceCandidateHash = (): `sha256:${string}` => {
  const value = process.env.GRASSEYE_SOURCE_FINGERPRINT?.trim();
  if (!value || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error("GRASSEYE_SOURCE_FINGERPRINT_REQUIRED");
  }
  return value as `sha256:${string}`;
};

export class GrassEyeWorkbench {
  private assembly: WorkbenchAssembly | null = null;
  private productionRuntime: ProductionRuntimeHandle | null = null;
  private activeHandle: GrassEyeWorkbenchHandle | null = null;
  private initializationPromise: Promise<void> | null = null;
  private initializationState: WorkbenchInitializationState = {
    status: "initializing",
    failureReason: null,
  };

  constructor(private readonly options: GrassEyeWorkbenchOptions) {}

  async init(): Promise<void> {
    if (this.initializationState.status === "ready") return;
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationState = { status: "initializing", failureReason: null };
    this.initializationPromise = this.initializeOnce();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async initializeOnce(): Promise<void> {
    try {
      if (!this.assembly) {
        this.assembly = await createWorkbenchAssembly(this.options);
      }
      const assembly = this.assembly;
      if (!this.productionRuntime) {
        this.productionRuntime = await startProductionRuntime({
          dataDir: assembly.dataDir,
          gpt: assembly.gptAbilityGroup,
          browserAuthority: assembly.browserAuthority,
          evidenceStore: assembly.evidenceStore,
          sourceHash: requireSourceCandidateHash(),
          runtimeLogger: assembly.runtimeLogger,
        });
      }
      const productionRuntime = this.productionRuntime;
      this.activeHandle = buildWorkbenchHandle(
        assembly,
        () => this.init(),
        () => this.shutdown(),
        productionRuntime,
        () => this.initializationState,
      );
      this.initializationState = { status: "ready", failureReason: null };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.initializationState = {
        status: "failed",
        failureReason: reason.slice(0, 1_000),
      };
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    const productionRuntime = this.productionRuntime;
    const assembly = this.assembly;
    this.activeHandle = null;
    this.productionRuntime = null;
    this.assembly = null;
    const cleanupErrors: unknown[] = [];
    await productionRuntime?.close().catch((error) => { cleanupErrors.push(error); });
    await assembly?.browserAuthority.shutdown().catch((error) => { cleanupErrors.push(error); });
    if (assembly && cleanupErrors.length === 0) {
      requireRuntimeLogWrite(assembly.runtimeLogger.emitEvent({
        traceId: `producer:${assembly.runtimeLogger.producerRunId}`,
        operation: "runtime.shutdown",
        code: "PRODUCER_STOPPED",
        typedIdentity: { kind: "producer", producerId: assembly.runtimeLogger.producerRunId },
      }));
    }
    if (cleanupErrors[0] !== undefined) throw cleanupErrors[0];
  }

  createHandle(): GrassEyeWorkbenchHandle {
    const self = this;
    return new Proxy({} as GrassEyeWorkbenchHandle, {
      get: (_target, property) => self.resolveHandleMember(property),
    });
  }

  private resolveHandleMember(property: string | symbol): unknown {
    if (property === "then") return undefined;
    const fixed = new Map<string | symbol, () => unknown>([
      ["init", () => () => this.init()],
      ["shutdown", () => () => this.shutdown()],
      ["getDataDir", () => () => this.assembly?.dataDir
        ?? this.options.dataDir
        ?? getDefaultPhase04LocalDataDir()],
      ["getModeInfo", () => () => getModeInfo(this.options)],
      ["getHealthReport", () => () => this.getHealthReport()],
      ["getMissionReadinessReport", () => () => this.getMissionReadinessReport()],
      ["getMissionStartPreflight", () => (input: unknown) => this.getMissionStartPreflight(input)],
      ["recordWorkbenchApiBoundaryEvent", () => (input: Parameters<GrassEyeWorkbenchHandle["recordWorkbenchApiBoundaryEvent"]>[0]) => {
        if (!this.assembly) return;
        buildApiBoundaryLogHandle(this.assembly).recordWorkbenchApiBoundaryEvent(input);
      }],
      ["acceptBrowserAuthoritySocket", () => (input: Parameters<GrassEyeWorkbenchHandle["acceptBrowserAuthoritySocket"]>[0]) => {
        if (!this.assembly) throw new Error("BROWSER_AUTHORITY_NOT_INITIALIZED");
        return this.assembly.browserAuthority.acceptBrowserAuthoritySocket(input);
      }],
      ["readBrowserAuthorityPairingState", () => () => this.assembly?.browserAuthority.readOperatorPairingState() ?? {
        authority: "absent" as const,
        pairingSecret: null,
      }],
      ["readBrowserExtensionBootstrapState", () => () => this.assembly ? {
        ...this.assembly.browserAuthority.readOperatorPairingState(),
        releaseBuildId: this.assembly.browserAuthority.readReleaseBuildId(),
      } : {
        authority: "absent" as const,
        pairingSecret: null,
        releaseBuildId: null,
      }],
    ]).get(property);
    if (fixed) return fixed();
    return (...args: unknown[]) => {
      const handle = this.requireActiveHandle();
      const member = Reflect.get(handle, property) as unknown;
      if (typeof member !== "function") return member;
      return Reflect.apply(member, handle, args);
    };
  }

  private requireActiveHandle(): GrassEyeWorkbenchHandle {
    if (!this.activeHandle || this.initializationState.status !== "ready") {
      throw new Error("WORKBENCH_NOT_INITIALIZED: authenticated browser authority has not completed composition");
    }
    return this.activeHandle;
  }

  private async getHealthReport(): Promise<WorkbenchHealthReport> {
    if (this.assembly) {
      return getHealthReport(
        this.assembly,
        this.initializationState,
        this.productionRuntime?.readHealth() ?? null,
      );
    }
    const disposition = runtimeInitializationDisposition(this.initializationState.failureReason);
    const runtimeComponent = {
      name: "runtimeInitialization",
      ok: false,
      detail: this.initializationState.status === "failed"
        ? `Mandatory runtime owner initialization failed: ${this.initializationState.failureReason ?? "unknown failure"}`
        : "Mandatory runtime owners are initializing.",
      actionableMessage: this.initializationState.status === "failed"
        ? disposition.actionableMessage
        : null,
      ownerResponsible: this.initializationState.status === "failed"
        ? disposition.ownerResponsible
        : "local-runtime",
    };
    return {
      status: "degraded",
      components: [runtimeComponent, authorityAbsentComponent()],
      checkedAt: new Date().toISOString(),
      sourceFingerprint: process.env.GRASSEYE_SOURCE_FINGERPRINT ?? "unknown",
    };
  }

  private async getMissionReadinessReport(): Promise<WorkbenchMissionReadinessReport> {
    if (this.assembly) return getMissionReadinessReport(this.assembly, this.options);
    return {
      status: "not_ready",
      reason: "Browser authority is absent; no browser-dependent business owner has been composed.",
      components: [authorityAbsentComponent()],
      checkedAt: new Date().toISOString(),
    };
  }

  private async getMissionStartPreflight(input: unknown): Promise<WorkbenchPreflightResult> {
    if (this.assembly) return getMissionStartPreflight(this.assembly, this.options, input);
    const component = authorityAbsentComponent();
    return {
      status: "blocked",
      actionableMessage: component.actionableMessage,
      failureReason: component.detail,
      recommendedAction: "Complete browser authority initialization before starting a mission.",
      ownerResponsible: "Browser",
      components: [component],
    };
  }
}
