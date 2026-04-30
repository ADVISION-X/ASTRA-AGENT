import type {
  CommanderConsoleAbilityGroup,
  CommanderMissionDashboardView,
} from "../../capabilities/commander-console/index.js";
import type { AiAbilityGroup } from "../../capabilities/ai/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import type { GeometryGuardAbilityGroup } from "../../capabilities/geometry-guard/index.js";
import type { MouseClickAbilityGroup } from "../../capabilities/mouse-click/index.js";
import type { MouseScrollAbilityGroup } from "../../capabilities/mouse-scroll/index.js";
import type { NerveBusAbilityGroup } from "../../capabilities/nerve-bus/index.js";
import type { OpenAbilityGroup } from "../../capabilities/open/contract.js";
import type { OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";
import type { PageStateAbilityGroup } from "../../capabilities/page-state/index.js";
import type { PostActionVerificationAbilityGroup } from "../../capabilities/post-action-verification/index.js";
import type { ScreenshotAbilityGroup } from "../../capabilities/screenshot/index.js";
import type { VisualTargetAbilityGroup } from "../../capabilities/visual-target/index.js";
import type { RuntimeHealthReport, MissionReadinessReport } from "../../types/runtime.js";
import type { BrowserController } from "../browser/browser-controller.js";
import type { LocalModelRole } from "../local-ai/model-config.js";
import type { EvidenceStoreService } from "../storage/evidence-store/evidence-store-service.js";
import type { StructuredLogBus } from "./structured-log-bus.js";

export type GrassEyePlatformTarget = "tiktok-web";

export type GrassEyeWorkbenchOptions = {
  dataDir?: string;
  baseUrl: string;
  platformTarget: GrassEyePlatformTarget;
  realPlatformUrl?: string;
  browserHeadless?: boolean;
  browserProfileDirectory?: string;
};

export type WorkbenchAbilityExecutionResult = {
  abilityGroupId: string;
  childCapabilityId?: string | null;
  status: "success" | "failed" | "review_required";
  failureReason?: string | { code?: string; message?: string; detail?: string | null } | null;
  reviewRequiredReason?: string | null;
};

export type MissionStartPreflightComponent = {
  name: "requestedPlatform" | "selectedMap" | "browserController" | "localAi" | "dataStore";
  ok: boolean;
  detail: string;
  ownerResponsible: string;
  actionableMessage: string;
};

export type WorkbenchBaseRuntime = {
  options: GrassEyeWorkbenchOptions;
  structuredLogBus: StructuredLogBus;
  evidenceStore: EvidenceStoreService;
  browserController: BrowserController;
  browserSessionConfig: { profileRef: string };
  aiAbilityGroup: AiAbilityGroup;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  openAbilityGroup: OpenAbilityGroup;
  mouseClickAbilityGroup: MouseClickAbilityGroup;
  textInputAbilityGroup: import("../../capabilities/text-input/index.js").TextInputAbilityGroup;
  mouseScrollAbilityGroup: MouseScrollAbilityGroup;
  pageStateAbilityGroup: PageStateAbilityGroup;
  postActionVerificationAbilityGroup: PostActionVerificationAbilityGroup;
  screenshotAbilityGroup: ScreenshotAbilityGroup;
  visualTargetAbilityGroup: VisualTargetAbilityGroup;
  geometryGuardAbilityGroup: GeometryGuardAbilityGroup;
};

export type WorkbenchRuntime = WorkbenchBaseRuntime & {
  nerveBusAbilityGroup: NerveBusAbilityGroup;
  orchestrationAbilityGroup: OrchestrationAbilityGroup;
  commanderConsole: CommanderConsoleAbilityGroup;
  init(): Promise<void>;
  getHealthReport(): Promise<RuntimeHealthReport>;
  getMissionReadinessReport(): Promise<MissionReadinessReport>;
  getMissionStartPreflight(input: {
    requestedPlatformId: import("../../capabilities/orchestration/index.js").RequestedPlatformId;
    selectedMapId: string;
  }): Promise<{
    status: "passed" | "blocked";
    actionableMessage: string;
    failureReason: string | null;
    nextAction: string;
    ownerResponsible: string;
    components: MissionStartPreflightComponent[];
  }>;
  recordCommanderDebugEvent(input: {
    eventType: string;
    status: "started" | "success" | "failed" | "review_required";
    traceId: string;
    spanId: string;
    attemptId: string;
    missionId?: string | null;
    mapId?: string | null;
    taskTemplateId?: string | null;
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
  }): Promise<void>;
  getCommanderConsoleSnapshot(): Promise<CommanderMissionDashboardView>;
  listRuntimeDebugEvents(tail?: number): Promise<unknown>;
  listRuntimeDebugActions(tail?: number): Promise<unknown>;
  getLocalAiRoleControls(): Promise<unknown>;
  setLocalAiRoleStartupState(input: { role: LocalModelRole; enabled: boolean }): Promise<unknown>;
  deleteCandidate(candidateId: string): Promise<void>;
  exportCandidateSummaries(): Promise<unknown>;
  getModeInfo(): {
    dataMode: "Real Platform";
    platformId: string;
    platformLabel: string;
    realPlatformConnection: string;
    browserMode: string;
    browserExecutable: string | null;
    browserProfileRef: string;
    browserProfileStatus: string;
    browserProfileDirectory: string;
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
    orientation: string;
  };
};