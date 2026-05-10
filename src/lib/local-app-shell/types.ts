type Locale = "en" | "zh";

type AppRunLimitSettings = {
  defaultMaxRounds: number;
  defaultMaxMinutes: number;
  updatedAt: string | null;
};

import type {
  CommanderCapabilityHealthEntry,
  CommanderMissionDashboardView,
  CommanderRecordSummaryView,
  CommanderRuntimeProofTimelineEntry,
} from "./commander-console-dashboard.types.js";

type CommanderConsolePrimaryPageId =
  | "command-center"
  | "mission-cockpit"
  | "records-exports"
  | "debug-health"
  | "map-lab"
  | "run-policy";

type CommanderConsoleStatusTone = "ok" | "attention" | "blocked";

type CommanderConsoleInspectKind =
  | "map"
  | "mission"
  | "round"
  | "evidence"
  | "record"
  | "export"
  | "log"
  | "policy"
  | "health";

type CommanderConsoleTabView = {
  id: string;
  label: string;
  subtitle: string;
};

type CommanderConsolePageView = {
  id: CommanderConsolePrimaryPageId;
  navCode: string;
  label: string;
  eyebrow: string;
  description: string;
  tabs: CommanderConsoleTabView[];
};

type CommanderConsoleTopMetric = {
  id: string;
  label: string;
  value: string;
  tone: CommanderConsoleStatusTone;
};

type CommanderConsoleBadge = {
  label: string;
  value: string;
  tone: CommanderConsoleStatusTone;
};

type CommanderConsoleMapView = {
  packageId: string;
  version: string;
  mapId: string;
  title: string;
  readiness: CommanderConsoleStatusTone;
  summary: string;
  activationGateStatus: string;
  lifecycleStatus: string;
  validationSummary: string;
  activationId: string | null;
  draftOnly: boolean;
  chain: string[];
};

type CommanderConsolePreflightCheck = {
  id: string;
  label: string;
  status: CommanderConsoleStatusTone;
  detail: string;
};

type CommanderConsoleTaskTemplate = {
  taskTemplateId: string;
  displayName: string;
  description: string;
  version: string;
  recommended: boolean;
  taskCategory: string;
  safetyLevel: string;
  userVisibleCapabilities: string[];
  defaultHumanGoal: string;
  availability: "ready" | "disabled";
  disabledReason?: string;
};

type CommanderConsoleStartPlatformId =
  | "facebook-web"
  | "tiktok-web";

type CommanderConsoleUserRequirementHistoryEntry = {
  id: string;
  title: string;
  userRequirementText: string;
  selectedPlatforms: CommanderConsoleStartPlatformId[];
  maxRounds: number;
  maxMinutes: number;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
};

type CommanderConsoleCommandDraft = {
  commandType: "start-mission";
  commandSource: "commander-console:start-form-submit";
  userRequirementText: string;
  selectedPlatforms: CommanderConsoleStartPlatformId[];
  historyEntryId: string | null;
  maxRounds: number;
  maxMinutes: number;
};

type CommanderConsoleSummaryItem = {
  label: string;
  value: string;
  tone?: CommanderConsoleStatusTone;
};

type CommanderConsoleReviewSummary = {
  pendingCount: number;
  gatePassedCount: number;
  rejectedCount: number;
  archivedCount: number;
};

type CommanderConsoleFailureItem = {
  id: string;
  label: string;
  severity: CommanderConsoleStatusTone;
  detail: string;
};

type CommanderConsoleLogEntry = {
  id: string;
  createdAt: string;
  step: string;
  status: string;
  message: string;
};

type CommanderConsoleExportRequest = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

type CommanderConsolePolicyCheck = {
  id: string;
  label: string;
  status: CommanderConsoleStatusTone;
  detail: string;
};

type CommanderConsoleInspectReference = {
  label: string;
  value: string;
};

type CommanderConsoleInspectItem = {
  kind: CommanderConsoleInspectKind;
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  owner: string;
  json: unknown;
  references: CommanderConsoleInspectReference[];
};

type CommanderConsoleViewModel = {
  locale: Locale;
  appTitle: string;
  appSubtitle: string;
  appRunLimitSettings: AppRunLimitSettings;
  missionSummary: string;
  badges: CommanderConsoleBadge[];
  topMetrics: CommanderConsoleTopMetric[];
  primaryPages: CommanderConsolePageView[];
  activeMissionSummary: CommanderConsoleSummaryItem[];
  activeRoundSummary: CommanderConsoleSummaryItem[];
  availableMaps: CommanderConsoleMapView[];
  taskTemplates: CommanderConsoleTaskTemplate[];
  preflightSummary: CommanderConsolePreflightCheck[];
  commandDraft: CommanderConsoleCommandDraft;
  userRequirementHistory: CommanderConsoleUserRequirementHistoryEntry[];
  capabilityHealth: CommanderCapabilityHealthEntry[];
  reviewQueueSummary: CommanderConsoleReviewSummary;
  failureRadarSummary: CommanderConsoleFailureItem[];
  structuredLogPreview: CommanderConsoleLogEntry[];
  evidencePackets: CommanderRecordSummaryView[];
  browseLedger: CommanderRecordSummaryView[];
  failedRecords: CommanderRecordSummaryView[];
  runtimeProofTimeline: CommanderRuntimeProofTimelineEntry[];
  exportSummary: CommanderConsoleExportRequest[];
  safetyLocks: CommanderConsolePolicyCheck[];
  runLimits: CommanderConsolePolicyCheck[];
  appShellReadiness: CommanderConsolePolicyCheck[];
  inspectItems: CommanderConsoleInspectItem[];
  rawSnapshot: CommanderMissionDashboardView;
};

interface CommanderConsolePublicHandlers {
  onDraftHumanCommand: (draft: CommanderConsoleCommandDraft) => void;
  onSubmitHumanCommand: (draft: CommanderConsoleCommandDraft) => Promise<void>;
  onPauseMission: () => Promise<void>;
  onResumeMission: () => Promise<void>;
  onStopMission: () => Promise<void>;
  onEmergencyStop: () => Promise<void>;
  onSubmitReviewDecision: (payload: { candidateId: string; disposition: "automationGate" | "reject" | "pending" }) => Promise<void>;
  onRequestExport: (payload: { exportType: "candidate-summary" }) => Promise<void>;
  onOpenInspect: (payload: { kind: CommanderConsoleInspectKind; id: string }) => void;
}

export type {
  AppRunLimitSettings,
  CommanderConsolePrimaryPageId,
  CommanderConsoleStatusTone,
  CommanderConsoleInspectKind,
  CommanderConsoleTabView,
  CommanderConsolePageView,
  CommanderConsoleTopMetric,
  CommanderConsoleBadge,
  CommanderConsoleMapView,
  CommanderConsolePreflightCheck,
  CommanderConsoleTaskTemplate,
  CommanderConsoleStartPlatformId,
  CommanderConsoleUserRequirementHistoryEntry,
  CommanderConsoleCommandDraft,
  CommanderConsoleSummaryItem,
  CommanderConsoleReviewSummary,
  CommanderConsoleFailureItem,
  CommanderConsoleLogEntry,
  CommanderConsoleExportRequest,
  CommanderConsolePolicyCheck,
  CommanderConsoleInspectReference,
  CommanderConsoleInspectItem,
  CommanderConsoleViewModel,
  CommanderConsolePublicHandlers,
  Locale,
};
