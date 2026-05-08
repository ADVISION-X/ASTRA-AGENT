import type { WorkbenchBrowserController as BrowserController } from "./workbench-browser-types.js";
import type {
  WorkbenchCommanderConsoleAbilityGroup as CommanderConsoleAbilityGroup,
  WorkbenchCommanderMissionDashboardView as CommanderMissionDashboardView,
} from "./workbench-commander-types.js";
import type { LocalAiStartupReadiness } from "../../types/local-ai.js";
import type { WorkbenchEvidenceStoreService as EvidenceStoreService } from "./workbench-evidence-store-types.js";
import type { WorkbenchLocalModelRole as LocalModelRole } from "./workbench-local-ai-role-types.js";
import type {
  WorkbenchMissionReadinessReport as MissionReadinessReport,
  WorkbenchRuntimeHealthReport as RuntimeHealthReport,
} from "./workbench-runtime-report-types.js";
import type { StructuredLogBus } from "./structured-log-bus.js";
import type { WorkbenchNerveBusAbilityGroup as NerveBusAbilityGroup } from "./workbench-nerve-bus-types.js";
import type {
  MapLabActivationResult,
  MapLabAutomationGateResult,
  MapLabGenerateDraftResult,
  MapLabProviderConfigInput,
  MapLabProviderState,
  MapLabSnapshot,
} from "./map-lab/map-lab-types.js";

export type RequestedPlatformId =
  | "tiktok-web"
  | "facebook-web"
  | "macos-local"
  | "iphone-mirroring-facebook-app"
  | "iphone-mirroring-tiktok-app";

export type GrassEyePlatformTarget = RequestedPlatformId | "agent-shell";

export type GrassEyeWorkbenchOptions = {
  dataDir?: string;
  baseUrl: string;
  platformTarget: GrassEyePlatformTarget;
  startupReadiness?: (LocalAiStartupReadiness & { platformTarget: GrassEyePlatformTarget }) | null;
  realPlatformUrl?: string;
  browserHeadless?: boolean;
  browserProfileDirectory?: string;
};

export type WorkbenchAbilityExecutionResult = {
  abilityGroupId: string;
  childCapabilityId?: string | null;
  status: "success" | "failed" | "review_required";
  output?: unknown | null;
  runtimeProof?: unknown | null;
  failureReason?: string | { code?: string; message?: string; detail?: string | null } | null;
  reviewRequiredReason?: string | null;
};

type WorkbenchAiExecutionResult = WorkbenchAbilityExecutionResult & {
  taskType?: string | null;
  confidence?: number | null;
  output?: unknown | null;
  promptVersion?: string;
  modelProvider?: string;
  modelName?: string;
  runtime?: string;
};

type WorkbenchAiHealth = {
  ok: boolean;
  detail: string;
};

type WorkbenchAiRuntimeHealth = {
  lastTaskType: string | null;
  lastInvocationStatus: string | null;
  lastFailureReason: string | null;
};

type WorkbenchExecuteAbilityGroup = {
  execute(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
};

type WorkbenchAiAbilityGroup = {
  execute(input: unknown, options?: { signal?: AbortSignal | undefined }): Promise<WorkbenchAiExecutionResult>;
  getHealth(): Promise<WorkbenchAiHealth>;
  getRuntimeHealth(): Promise<WorkbenchAiRuntimeHealth>;
};

type WorkbenchForensicsAbilityGroup = {
  writeStructuredRuntimeEvent(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  writeStructuredActionLog(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  writeImageEvidence(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  writeOcrEvidence(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  writeAiResultRecord(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  finalizeBrowseLedger(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  finalizeEvidencePacket(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  finalizeFailedRecord(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
  updateRuntimeSnapshot(input: unknown): Promise<WorkbenchAbilityExecutionResult>;
};

type WorkbenchMissionStatus = "idle" | "pending" | "running" | "paused" | "review_required" | "failed" | "completed" | "stopped";

type WorkbenchLastHumanCommand =
  | "start-mission"
  | "pause-mission"
  | "resume-mission"
  | "stop-mission"
  | "emergency-stop"
  | "approve-candidate"
  | "reject-candidate"
  | "mark-review-required"
  | "submit-review-decision"
  | null;

type WorkbenchMissionState = {
  missionId: string | null;
  status: WorkbenchMissionStatus;
  humanGoal: string | null;
  activeTaskRunId: string | null;
  currentRoundIndex: number;
  requestedPlatform: RequestedPlatformId | null;
  mapId: string | null;
  lastHumanCommand: WorkbenchLastHumanCommand;
  reviewRequiredReason: string | null;
  failureReason: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  endedAt: string | null;
  currentStepId: string | null;
};

type WorkbenchOrchestrationAbilityGroup = {
  getMissionState(missionId?: string | null): Promise<WorkbenchMissionState>;
  startMission(input: unknown): Promise<WorkbenchMissionState>;
  pauseMission(missionId: string): Promise<WorkbenchMissionState>;
  resumeMission(missionId: string): Promise<WorkbenchMissionState>;
  stopMission(input: { missionId: string; reason: string }): Promise<WorkbenchMissionState>;
  emergencyStop(input: { missionId: string; reason: string }): Promise<WorkbenchMissionState>;
  listMapIds(): string[];
};

export type MissionStartPreflightComponent = {
  name: "requestedPlatform" | "selectedMap" | "commandTransportContract" | "missionCommandSchema" | "browserController" | "openLocalProgram" | "localAi" | "dataStore";
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
  aiAbilityGroup: WorkbenchAiAbilityGroup;
  forensicsPersistenceAbilityGroup: WorkbenchForensicsAbilityGroup;
  openAbilityGroup: WorkbenchExecuteAbilityGroup;
  mouseClickAbilityGroup: WorkbenchExecuteAbilityGroup;
  textInputAbilityGroup: WorkbenchExecuteAbilityGroup;
  mouseScrollAbilityGroup: WorkbenchExecuteAbilityGroup;
  pageStateAbilityGroup: WorkbenchExecuteAbilityGroup;
  postActionVerificationAbilityGroup: WorkbenchExecuteAbilityGroup;
  screenshotAbilityGroup: WorkbenchExecuteAbilityGroup;
  visualTargetAbilityGroup: WorkbenchExecuteAbilityGroup;
  geometryGuardAbilityGroup: WorkbenchExecuteAbilityGroup;
};

export type WorkbenchRuntime = WorkbenchBaseRuntime & {
  nerveBusAbilityGroup: NerveBusAbilityGroup;
  orchestrationAbilityGroup: WorkbenchOrchestrationAbilityGroup;
  commanderConsole: CommanderConsoleAbilityGroup;
  init(): Promise<void>;
  getHealthReport(): Promise<RuntimeHealthReport>;
  getMissionReadinessReport(): Promise<MissionReadinessReport>;
  getMissionStartPreflight(input: {
    requestedPlatformId: RequestedPlatformId;
    selectedMapId: string;
    taskTemplateId?: string | null;
    activationId?: string | null;
    activationSnapshotRef?: string | null;
    targetProfileRef?: string | null;
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
    runId?: string | null;
    mapId?: string | null;
    taskTemplateId?: string | null;
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
    refs?: string[];
    inputRefs?: string[];
    outputRefs?: string[];
    proofRefs?: string[];
    artifactRefs?: string[];
  }): Promise<void>;
  getCommanderConsoleSnapshot(): Promise<CommanderMissionDashboardView>;
  listRuntimeDebugEvents(tail?: number): Promise<unknown>;
  listRuntimeDebugActions(tail?: number): Promise<unknown>;
  getLocalAiRoleControls(): Promise<unknown>;
  setLocalAiRoleStartupState(input: { role: LocalModelRole; enabled: boolean }): Promise<unknown>;
  deleteCandidate(candidateId: string): Promise<void>;
  exportCandidateSummaries(): Promise<unknown>;
  getMapLabSnapshot(): Promise<MapLabSnapshot>;
  saveMapLabProviderConfig(input: MapLabProviderConfigInput): Promise<MapLabProviderState>;
  generateMapLabDraft(input: unknown): Promise<MapLabGenerateDraftResult>;
  passMapLabAutomationGate(input: { packageId: string; packageVersion: string; gateActor: string }): Promise<MapLabAutomationGateResult>;
  activateMapLabDraft(input: { packageId: string; packageVersion: string; gateActor: string; reason: string }): Promise<MapLabActivationResult>;
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
    browserProfileVerificationReason: string;
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
