import type { GrassEyeWorkbenchOptions } from "./contract.js";
import { buildApiBoundaryLogHandle } from "./workbench-api-boundary-log.js";
import { createWorkbenchAssembly, type WorkbenchAssembly } from "./workbench-assembly.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import {
  getHealthReport,
  runtimeInitializationDisposition,
} from "./workbench-status.js";
import type {
  WorkbenchHealthReport,
  WorkbenchInitializationState,
} from "./workbench-status-types.js";
import { buildProductionRuntimeHandle } from "./workbench-production-runtime-handle.js";
import { startProductionRuntime, type ProductionRuntimeHandle } from "./production/runtime.js";
import { requireRuntimeLogWrite } from "../runtime-logs/index.js";

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
  shutdown: GrassEyeWorkbenchHandle["shutdown"],
  productionRuntime: ProductionRuntimeHandle,
  getInitializationState: () => WorkbenchInitializationState,
): GrassEyeWorkbenchHandle => {
  return {
    init,
    shutdown,
    ...buildApiBoundaryLogHandle(assembly),
    getHealthReport: async () => getHealthReport(
      assembly,
      getInitializationState(),
      productionRuntime.readHealth(),
    ),
    acceptBrowserAuthoritySocket: (input) => assembly.browserAuthority.acceptBrowserAuthoritySocket(input),
    readBrowserExtensionBootstrapState: () => ({
      ...assembly.browserAuthority.readOperatorPairingState(),
      releaseBuildId: assembly.browserAuthority.readReleaseBuildId(),
    }),
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
  private blockedRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private shuttingDown = false;
  private readonly stopIntent = new AbortController();
  private shutdownPromise: Promise<void> | null = null;
  private retryPromise: Promise<void> | null = null;
  private initializationState: WorkbenchInitializationState = {
    status: "initializing",
    failureReason: null,
  };

  constructor(private readonly options: GrassEyeWorkbenchOptions) {}

  private scheduleBlockedRuntimeRetry(): void {
    if (this.blockedRetryTimer || this.shuttingDown) return;
    this.blockedRetryTimer = setTimeout(() => {
      this.blockedRetryTimer = null;
      this.retryPromise = this.retryBlockedRuntime().finally(() => { this.retryPromise = null; });
    }, 5_000);
  }

  async init(): Promise<void> {
    if (this.shuttingDown || this.initializationState.status === "ready") return;
    this.initializationPromise ??= this.initializeOnce();
    try { await this.initializationPromise; }
    finally { this.initializationPromise = null; }
  }

  private async initializeOnce(): Promise<void> {
    try {
      this.assembly ??= await createWorkbenchAssembly(this.options);
      const assembly = this.assembly;
      this.productionRuntime = await startProductionRuntime({
        dataDir: assembly.dataDir, sourceHash: requireSourceCandidateHash(),
        gpt: assembly.gptAbilityGroup, evidenceStore: assembly.evidenceStore,
        browserAuthority: assembly.browserAuthority, runtimeLogger: assembly.runtimeLogger,
        stopSignal: this.stopIntent.signal,
      });
      if (this.shuttingDown) return;
      this.activeHandle = buildWorkbenchHandle(assembly, () => this.init(),
        closeShell => this.shutdown(closeShell), this.productionRuntime, () => this.initializationState);
      this.initializationState = { status: "ready", failureReason: null };
      if (this.productionRuntime.blocked) this.scheduleBlockedRuntimeRetry();
    } catch (error) {
      this.initializationState = { status: "failed",
        failureReason: error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000) };
      throw error;
    }
  }

  private async retryBlockedRuntime(): Promise<void> {
    const assembly = this.assembly;
    if (this.shuttingDown || !assembly || !this.productionRuntime?.blocked) return;
    try {
      await this.productionRuntime.close();
      this.productionRuntime = await startProductionRuntime({
        dataDir: assembly.dataDir, sourceHash: requireSourceCandidateHash(),
        gpt: assembly.gptAbilityGroup, evidenceStore: assembly.evidenceStore,
        browserAuthority: assembly.browserAuthority, runtimeLogger: assembly.runtimeLogger,
        stopSignal: this.stopIntent.signal,
      });
      if (this.shuttingDown) return;
      this.activeHandle = buildWorkbenchHandle(assembly, () => this.init(),
        closeShell => this.shutdown(closeShell), this.productionRuntime, () => this.initializationState);
      this.initializationState = { status: "ready", failureReason: null };
    } catch (error) {
      this.initializationState = { status: "failed",
        failureReason: error instanceof Error ? error.message : String(error) };
      if (this.shuttingDown) throw error;
    }
    if (this.productionRuntime?.blocked) this.scheduleBlockedRuntimeRetry();
  }

  shutdown(closeShell?: () => Promise<void>): Promise<void> {
    this.shuttingDown = true;
    this.stopIntent.abort();
    if (this.blockedRetryTimer) clearTimeout(this.blockedRetryTimer);
    this.blockedRetryTimer = null;
    this.shutdownPromise ??= this.closeResources(closeShell);
    return this.shutdownPromise;
  }

  private async closeResources(closeShell?: () => Promise<void>): Promise<void> {
    const errors: unknown[] = [];
    await this.initializationPromise?.catch(error => { errors.push(error); });
    await this.retryPromise?.catch(error => { errors.push(error); });
    await this.productionRuntime?.close().catch(error => { errors.push(error); });
    const assembly = this.assembly;
    await assembly?.browserAuthority.shutdown().catch(error => { errors.push(error); });
    await closeShell?.().catch(error => { errors.push(error); });
    if (assembly && errors.length === 0) requireRuntimeLogWrite(assembly.runtimeLogger.emitEvent({
      traceId: `producer:${assembly.runtimeLogger.producerRunId}`, operation: "runtime.shutdown",
      code: "PRODUCER_STOPPED",
      typedIdentity: { kind: "producer", producerId: assembly.runtimeLogger.producerRunId },
    }));
    this.activeHandle = null;
    this.productionRuntime = null;
    this.assembly = null;
    if (errors.length) throw new AggregateError(errors, "WORKBENCH_SHUTDOWN_INCOMPLETE");
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
      ["shutdown", () => (closeShell?: () => Promise<void>) => this.shutdown(closeShell)],
      ["getHealthReport", () => () => this.getHealthReport()],
      ["recordWorkbenchApiBoundaryEvent", () => (input: Parameters<GrassEyeWorkbenchHandle["recordWorkbenchApiBoundaryEvent"]>[0]) => {
        if (!this.assembly) return;
        buildApiBoundaryLogHandle(this.assembly).recordWorkbenchApiBoundaryEvent(input);
      }],
      ["acceptBrowserAuthoritySocket", () => (input: Parameters<GrassEyeWorkbenchHandle["acceptBrowserAuthoritySocket"]>[0]) => {
        if (!this.assembly) throw new Error("BROWSER_AUTHORITY_NOT_INITIALIZED");
        return this.assembly.browserAuthority.acceptBrowserAuthoritySocket(input);
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
    const disposition = runtimeInitializationDisposition();
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

}
