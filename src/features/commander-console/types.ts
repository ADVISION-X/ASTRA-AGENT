import type {
  CommanderCapabilityHealthEntry,
  CommanderMissionDashboardView,
  CommanderRecordSummaryView,
  CommanderRuntimeProofTimelineEntry,
} from "../../capabilities/commander-console/index.js";
import type { Locale } from "../../lib/localization/dictionaries.js";

export type CommanderConsolePrimaryPageId =
  | "command-center"
  | "mission-cockpit"
  | "records-exports"
  | "debug-health"
  | "map-lab"
  | "run-policy";

export type CommanderConsoleStatusTone = "ok" | "attention" | "blocked";

export type CommanderConsoleInspectKind =
  | "map"
  | "mission"
  | "round"
  | "evidence"
  | "record"
  | "export"
  | "log"
  | "policy"
  | "health";

export type CommanderConsoleTabView = {
  id: string;
  label: string;
  subtitle: string;
};

export type CommanderConsolePageView = {
  id: CommanderConsolePrimaryPageId;
  navCode: string;
  label: string;
  eyebrow: string;
  description: string;
  tabs: CommanderConsoleTabView[];
};

export type CommanderConsoleTopMetric = {
  id: string;
  label: string;
  value: string;
  tone: CommanderConsoleStatusTone;
};

export type CommanderConsoleBadge = {
  label: string;
  value: string;
  tone: CommanderConsoleStatusTone;
};

export type CommanderConsoleMapView = {
  packageId: string;
  version: string;
  mapId: string;
  title: string;
  readiness: CommanderConsoleStatusTone;
  summary: string;
  approvalStatus: string;
  lifecycleStatus: string;
  validationSummary: string;
  activationId: string | null;
  draftOnly: boolean;
  chain: string[];
};

export type CommanderConsolePreflightCheck = {
  id: string;
  label: string;
  status: CommanderConsoleStatusTone;
  detail: string;
};

export type CommanderConsoleTaskTemplate = {
  taskTemplateId: string;
  displayName: string;
  description: string;
  version: string;
  recommended: boolean;
  taskCategory: string;
  defaultRunLimit: {
    maxRounds: number;
    maxMinutes: number;
  };
  maxAllowedRunLimit: {
    maxRounds: number;
    maxMinutes: number;
  };
  safetyLevel: string;
  developerBinding?: {
    mapId: string | null;
    requestedPlatformId: "facebook-web" | "tiktok-web" | null;
    targetProfileRef: string | null;
    platformProfileRef: string | null;
  };
  userVisibleCapabilities: string[];
  advancedFields: {
    aiMode: string;
    logLevel: string;
  };
  defaultHumanGoal: string;
  availability: "ready" | "disabled";
  disabledReason?: string;
};

export type CommanderConsoleCommandDraft = {
  commandType: "start-mission";
  commandSource: "commander-console:start-form-submit";
  taskTemplateId: string | null;
  humanGoal: string;
  targetProfileRef: string | null;
  maxRounds: number;
  maxMinutes: number;
};

export type CommanderConsoleSummaryItem = {
  label: string;
  value: string;
  tone?: CommanderConsoleStatusTone;
};

export type CommanderConsoleReviewSummary = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  archivedCount: number;
};

export type CommanderConsoleFailureItem = {
  id: string;
  label: string;
  severity: CommanderConsoleStatusTone;
  detail: string;
};

export type CommanderConsoleLogEntry = {
  id: string;
  createdAt: string;
  step: string;
  status: string;
  message: string;
};

export type CommanderConsoleExportRequest = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

export type CommanderConsolePolicyCheck = {
  id: string;
  label: string;
  status: CommanderConsoleStatusTone;
  detail: string;
};

export type CommanderConsoleInspectReference = {
  label: string;
  value: string;
};

export type CommanderConsoleInspectItem = {
  kind: CommanderConsoleInspectKind;
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  owner: string;
  json: unknown;
  references: CommanderConsoleInspectReference[];
};

export type CommanderConsoleViewModel = {
  locale: Locale;
  appTitle: string;
  appSubtitle: string;
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

export interface CommanderConsolePublicHandlers {
  onDraftHumanCommand: (draft: CommanderConsoleCommandDraft) => void;
  onSubmitHumanCommand: (draft: CommanderConsoleCommandDraft) => Promise<void>;
  onPauseMission: () => Promise<void>;
  onResumeMission: () => Promise<void>;
  onStopMission: () => Promise<void>;
  onEmergencyStop: () => Promise<void>;
  onSubmitReviewDecision: (payload: { candidateId: string; disposition: "approve" | "reject" | "pending" }) => Promise<void>;
  onRequestExport: (payload: { exportType: "candidate-summary" }) => Promise<void>;
  onOpenInspect: (payload: { kind: CommanderConsoleInspectKind; id: string }) => void;
}