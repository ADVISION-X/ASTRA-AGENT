import { prepareVideoDownloadRuntimeDependencies } from "../../capabilities/video-download/index.js";
import { runXuanxueAiProductionRoute } from "../../mediator/xuanxue-ai-production-route.js";
import { createXuanxueAiProductionWorkbenchOwner } from "../../plugins/xuanxue-ai-production/index.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import { buildAmazonInvoiceHandle } from "./workbench-amazon-invoice-handle.js";
import { buildApiBoundaryLogHandle } from "./workbench-api-boundary-log.js";
import { createWorkbenchAssembly, type WorkbenchAssembly } from "./workbench-assembly.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import {
  buildAmazonMiningHandle,
  buildSettingsHandle,
} from "./workbench-marketplace-handles.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
} from "./workbench-status.js";
import type {
  WorkbenchHealthReport,
  WorkbenchInitializationState,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";
import { buildXuanxueAiProductionHandle } from "./workbench-xuanxue-ai-production-handle.js";

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
  shutdown: () => Promise<void>,
  xuanxueAiProduction: ReturnType<typeof createXuanxueAiProductionWorkbenchOwner>,
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
      xuanxueAiProduction.readProductionHealth(),
    ),
    getMissionReadinessReport: async () => getMissionReadinessReport(assembly, assembly.options),
    getMissionStartPreflight: async (input) =>
      getMissionStartPreflight(assembly, assembly.options, input),
    getDataDir: () => dataDir,
    acceptBrowserAuthoritySocket: (input) => assembly.browserAuthority.acceptBrowserAuthoritySocket(input),
    readBrowserAuthorityPairingState: () => assembly.browserAuthority.readOperatorPairingState(),
    getMediaProcessingAbilityGroup: () => assembly.mediaProcessing,
    getModeInfo: () => getModeInfo(assembly.options),
    ...buildSettingsHandle(dataDir),
    ...buildAmazonInvoiceHandle(assembly, dataDir),
    ...buildAmazonMiningHandle(assembly, dataDir),
    ...buildXuanxueAiProductionHandle(xuanxueAiProduction),
  };
};

const authorityAbsentComponent = () => ({
  name: "browserAuthority",
  ok: false,
  detail: "Browser authority is absent while runtime initialization is incomplete.",
  actionableMessage: "Load the fixed unpacked MV3 extension, complete a fresh local pairing, then let its actor establish the one browser authority WebSocket before admitting browser work.",
  ownerResponsible: "Browser",
});

export class GrassEyeWorkbench {
  private assembly: WorkbenchAssembly | null = null;
  private xuanxueAiProduction: ReturnType<typeof createXuanxueAiProductionWorkbenchOwner> | null = null;
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
    let assembly: WorkbenchAssembly | null = null;
    let xuanxueAiProduction: ReturnType<typeof createXuanxueAiProductionWorkbenchOwner> | null = null;
    try {
      assembly = await createWorkbenchAssembly(this.options);
      xuanxueAiProduction = createXuanxueAiProductionWorkbenchOwner(
        assembly.dataDir,
        assembly.aiInputGateway,
        assembly.mediaProcessing,
        runXuanxueAiProductionRoute,
        assembly.browserAuthority,
      );
      await prepareVideoDownloadRuntimeDependencies();
      await xuanxueAiProduction.init();
      this.assembly = assembly;
      this.xuanxueAiProduction = xuanxueAiProduction;
      this.initializationState = { status: "ready", failureReason: null };
      this.activeHandle = buildWorkbenchHandle(
        assembly,
        () => this.init(),
        () => this.shutdown(),
        xuanxueAiProduction,
        () => this.initializationState,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.initializationState = {
        status: "failed",
        failureReason: reason.slice(0, 1_000),
      };
      if (xuanxueAiProduction) {
        await xuanxueAiProduction.shutdown().catch(() => undefined);
      }
      if (assembly) {
        await assembly.browserAuthority.shutdown().catch(() => undefined);
      }
      this.assembly = null;
      this.xuanxueAiProduction = null;
      this.activeHandle = null;
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    const xuanxue = this.xuanxueAiProduction;
    const assembly = this.assembly;
    this.activeHandle = null;
    this.xuanxueAiProduction = null;
    this.assembly = null;
    await xuanxue?.shutdown().catch(() => undefined);
    await assembly?.browserAuthority.shutdown().catch(() => undefined);
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
        this.xuanxueAiProduction?.readProductionHealth() ?? null,
      );
    }
    const runtimeComponent = {
      name: "runtimeInitialization",
      ok: false,
      detail: this.initializationState.status === "failed"
        ? `Mandatory runtime owner initialization failed: ${this.initializationState.failureReason ?? "unknown failure"}`
        : "Mandatory runtime owners are initializing.",
      actionableMessage: this.initializationState.status === "failed"
        ? "Repair the named runtime owner before restarting."
        : null,
      ownerResponsible: "local-runtime",
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
