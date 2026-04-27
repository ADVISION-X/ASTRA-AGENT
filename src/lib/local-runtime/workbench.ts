import path from "node:path";

import { AgentService } from "../../features/agent/agent-service.js";
import { EvidenceStoreService } from "../../features/local-data/evidence-store-service.js";
import { TikTokPlatformAdapter } from "../../features/platform-action/adapters/tiktok-platform-adapter.js";
import type { PlatformAdapter } from "../../features/platform-action/platform-adapter.js";
import type { BrowserController } from "../browser/browser-controller.js";
import { createOperatorVerifiedLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import { PlaywrightBrowserController } from "../browser/playwright-browser-controller.js";
import { getDefaultLocalDataDir } from "./default-data-dir.js";
import { LocalAiGateway } from "../local-ai/local-ai-gateway.js";
import type { RuntimeHealthReport } from "../../types/runtime.js";
import { buildBrowseRuntimeSnapshot } from "./build-browse-runtime-snapshot.js";

export type GrassEyePlatformTarget = "tiktok-web";

type GrassEyeWorkbenchOptions = {
  dataDir?: string;
  baseUrl: string;
  platformTarget: GrassEyePlatformTarget;
  realPlatformUrl?: string;
  browserHeadless?: boolean;
  browserProfileRef: string;
  browserUserDataDir: string;
};

export class GrassEyeWorkbench {
  readonly evidenceStore: EvidenceStoreService;
  readonly browserController: BrowserController;
  readonly localAiGateway: LocalAiGateway;
  readonly platformAdapter: PlatformAdapter;
  readonly agentService: AgentService;
  readonly browserSessionConfig;

  constructor(private readonly options: GrassEyeWorkbenchOptions) {
    const dataDir = options.dataDir ?? getDefaultLocalDataDir();
    this.evidenceStore = new EvidenceStoreService(dataDir);
    this.localAiGateway = new LocalAiGateway();
    if (options.platformTarget !== "tiktok-web") {
      throw new Error(`Unsupported GrassEye platform target: ${options.platformTarget}`);
    }

    this.browserSessionConfig = createOperatorVerifiedLocalBrowserSessionConfig({
      platform: options.platformTarget,
      profileRef: options.browserProfileRef,
      userDataDir: options.browserUserDataDir,
    });

    this.browserController = new PlaywrightBrowserController({
      sessionConfig: this.browserSessionConfig,
      screenshotDir: path.join(dataDir, "browser-captures"),
      headlessRequested: options.browserHeadless === true,
    });
    this.platformAdapter = new TikTokPlatformAdapter(
      this.browserController,
      options.realPlatformUrl ?? "https://www.tiktok.com/foryou"
    );

    this.agentService = new AgentService(this.platformAdapter, this.evidenceStore, this.localAiGateway);
  }

  async init(): Promise<void> {
    await this.evidenceStore.init();
  }

  async getHealthReport(): Promise<RuntimeHealthReport> {
    const dataStoreHealth = await this.evidenceStore.getHealth();
    const agentSnapshot = await this.agentService.getSnapshot();
    const localAiHealth = await this.localAiGateway.getHealth();
    return {
      generatedAt: new Date().toISOString(),
      components: [
        { name: "console", ok: true, detail: "local operator console route ready" },
        { name: "agent", ok: true, detail: this.agentService.getHealth().detail },
        { name: "browserController", ok: true, detail: this.browserController.getHealth().detail },
        { name: "localAi", ok: localAiHealth.ok, detail: localAiHealth.detail },
        { name: "dataStore", ok: dataStoreHealth.ok, detail: dataStoreHealth.detail }
      ]
    };
  }

  async getOperatorSnapshot() {
    const agentSnapshot = await this.agentService.getSnapshot();
    const stateSnapshot = await this.evidenceStore.getOperatorSnapshot();
    const browserSnapshot = this.browserController.getSessionState();
    return {
      runtime: await this.getHealthReport(),
      agent: agentSnapshot,
      browserSession: browserSnapshot,
      state: stateSnapshot,
      browseRuntimeSnapshot: buildBrowseRuntimeSnapshot({
        agentSnapshot,
        browserSnapshot,
        stateSnapshot,
      }),
      delivery: this.buildDeliverySnapshot(agentSnapshot, stateSnapshot),
      mode: this.getModeInfo(),
    };
  }

  private buildDeliverySnapshot(
    agentSnapshot: Awaited<ReturnType<AgentService["getSnapshot"]>>,
    stateSnapshot: Awaited<ReturnType<EvidenceStoreService["getOperatorSnapshot"]>>,
  ) {
    const latestExport = stateSnapshot.advancedAiExports.at(-1) ?? null;
    return {
      ...agentSnapshot.deliveryState,
      evidenceCount: stateSnapshot.videoEvidence.length + stateSnapshot.commentEvidence.length,
      actionLogCount: stateSnapshot.actionLogs.length,
      candidateCount: stateSnapshot.candidates.length,
      evidencePacketCount: stateSnapshot.evidencePackets.length,
      browseLedgerCount: stateSnapshot.browseLedgerEntries.length,
      roundLifecycleEventCount: stateSnapshot.roundLifecycleEvents.length,
      roundStructuralLogCount: stateSnapshot.roundStructuralLogs.length,
      advancedAiExportCount: stateSnapshot.advancedAiExports.length,
      latestBrowseSummary: latestExport?.browseSummary ?? null,
    };
  }

  async startTask() {
    return this.agentService.startOrResumeTask();
  }

  async pauseTask() {
    return this.agentService.pauseTask();
  }

  async stopTask() {
    return this.agentService.stopTask();
  }

  async updateCandidateDisposition(candidateId: string, disposition: "approve" | "reject" | "hold" | "pending", note?: string) {
    return this.evidenceStore.setCandidateDisposition(candidateId, disposition, note);
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    await this.evidenceStore.deleteCandidate(candidateId);
  }

  async exportCandidateSummaries() {
    return this.evidenceStore.exportCandidateSummaries();
  }

  async resetLocalStore(): Promise<void> {
    await this.evidenceStore.resetLocalStore();
    this.agentService.resetRuntimeState();
  }

  getModeInfo(): {
    dataMode: "Real Platform";
    platformId: string;
    platformLabel: string;
    realPlatformConnection: string;
    browserMode: string;
    browserExecutable: string | null;
    browserProfileRef: string;
    browserProfileStatus: string;
    browserProfileProvisioning: string;
    browserProfileVerificationStatus: string;
    browserProfileVerificationReason: string | null;
    loginState: string;
    lastLoginCheckAt: string | null;
    loginRequiredReason: string | null;
    reviewRequiredReason: string | null;
    storeScope: string;
    executionMode: string;
    fallbackMode: string;
    geometryGuard: string;
    viewport: string;
    calibration: string;
  } {
    const operatorMode = this.platformAdapter.getOperatorModeInfo();
    const session = this.browserController.getSessionState();
    return {
      dataMode: "Real Platform",
      platformId: this.platformAdapter.platformId,
      platformLabel: "TikTok web adapter",
      realPlatformConnection: this.browserController.getHealth().detail,
      browserMode: session.browserMode,
      browserExecutable: session.browserExecutable,
      browserProfileRef: session.browserProfileRef,
      browserProfileStatus: session.profileStatus,
      browserProfileProvisioning: session.profileProvisioning,
      browserProfileVerificationStatus: session.profileVerificationStatus,
      browserProfileVerificationReason: session.profileVerificationReason,
      loginState: session.loginState,
      lastLoginCheckAt: session.lastLoginCheckAt,
      loginRequiredReason: session.loginRequiredReason,
      reviewRequiredReason: session.reviewRequiredReason,
      storeScope: "Authorized local profile + local evidence store",
      executionMode: operatorMode.executionMode,
      fallbackMode: operatorMode.fallbackMode,
      geometryGuard: operatorMode.geometryGuard,
      viewport: operatorMode.viewport,
      calibration: operatorMode.calibration,
    };
  }
}