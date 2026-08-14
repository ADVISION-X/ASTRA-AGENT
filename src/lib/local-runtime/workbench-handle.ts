import type { OnlineAiProviderPublicStatus } from "../online-ai/index.js";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";
import type {
  DeepResearchAnalysisStartInput,
  DeepResearchExportArtifactPayload,
  DeepResearchHistorySnapshot,
  DeepResearchInputAttachment,
  DeepResearchJobSnapshot,
  DeepResearchReportViewModel,
  DeepResearchTimelineSnapshot,
} from "../../plugins/deep-research-analysis/deep-research-analysis.public.js";
import type { AppRunLimitSettings } from "./settings-types.js";
import type {
  WorkbenchHealthReport,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightInput,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";
import type {
  XuanxueAiInterventionRecord,
  XuanxueAiOrderRecord,
} from "../../plugins/xuanxue-ai-production/index.js";
import type { PluginInterventionRequest, PluginInterventionSnapshot } from "../../types/plugin-intervention.js";

type OpenAmazonInvoiceAdminPage = typeof import("../../plugins/amazon-invoice-upload/index.js").startAmazonInvoiceAdminOpenTask;
type StartAmazonInvoiceUploadMission = typeof import("../../plugins/amazon-invoice-upload/index.js").startAmazonInvoiceUploadMission;
type StartAmazonInvoiceUploadTask = typeof import("../../plugins/amazon-invoice-upload/index.js").startAmazonInvoiceUploadTask;
type GetAmazonInvoiceUploadTaskStatus = typeof import("../../plugins/amazon-invoice-upload/index.js").getAmazonInvoiceUploadTaskStatus;
type ListAmazonInvoiceUploadLedger = typeof import("../../plugins/amazon-invoice-upload/index.js").listAmazonInvoiceUploadLedger;
type StartAmazonTaxInvoiceDownloadTask = typeof import("../../plugins/amazon-invoice-upload/index.js").startAmazonTaxInvoiceDownloadTask;
type GetAmazonTaxInvoiceDownloadTaskStatus = typeof import("../../plugins/amazon-invoice-upload/index.js").getAmazonTaxInvoiceDownloadTaskStatus;
type GetAmazonTaxInvoiceDownloadArtifact = typeof import("../../plugins/amazon-invoice-upload/index.js").getAmazonTaxInvoiceDownloadArtifact;
type StartAmazonProductMiningMission = typeof import("../../plugins/amazon-product-mining/index.js").startAmazonProductMiningMission;
type GetAmazonProductMiningTaskStatus = typeof import("../../plugins/amazon-product-mining/index.js").getAmazonProductMiningTaskStatus;
type ListAmazonProductMiningKeywordReviews = typeof import("../../plugins/amazon-product-mining/index.js").listAmazonProductMiningKeywordReviews;
type GetAmazonProductMiningKeywordReview = typeof import("../../plugins/amazon-product-mining/index.js").getAmazonProductMiningKeywordReview;
type ExportAmazonProductMiningResult = typeof import("../../plugins/amazon-product-mining/index.js").exportAmazonProductMiningResult;
type ContinueInterruptedAmazonProductMiningTasks = typeof import("../../plugins/amazon-product-mining/index.js").continueInterruptedAmazonProductMiningTasks;

type AmazonInvoiceUploadAdminOpenInput = Parameters<OpenAmazonInvoiceAdminPage>[1];
type AmazonInvoiceUploadAdminOpenResult = Awaited<ReturnType<OpenAmazonInvoiceAdminPage>>;
type AmazonInvoiceUploadMissionInput = Parameters<StartAmazonInvoiceUploadMission>[3];
type AmazonInvoiceUploadMissionStartResult = Awaited<ReturnType<StartAmazonInvoiceUploadMission>>;
type AmazonInvoiceUploadTaskStartInput = Parameters<StartAmazonInvoiceUploadTask>[0]["task"];
type AmazonInvoiceUploadTaskResumeInput = { taskId: string };
type AmazonInvoiceUploadTaskRecord = Awaited<ReturnType<GetAmazonInvoiceUploadTaskStatus>>;
type AmazonInvoiceUploadLedgerRecord = ReturnType<ListAmazonInvoiceUploadLedger>[number];
type AmazonTaxInvoiceDownloadMissionInput = Parameters<StartAmazonTaxInvoiceDownloadTask>[0]["mission"];
type AmazonTaxInvoiceDownloadTaskRecord = Awaited<ReturnType<GetAmazonTaxInvoiceDownloadTaskStatus>>;
type AmazonTaxInvoiceDownloadArtifactMetadata = ReturnType<GetAmazonTaxInvoiceDownloadArtifact>;
type AmazonProductMiningMissionInput = Parameters<StartAmazonProductMiningMission>[0]["rawInput"];
type AmazonProductMiningStartResult = ReturnType<StartAmazonProductMiningMission>;
type AmazonProductMiningTaskResult = ReturnType<GetAmazonProductMiningTaskStatus>;
type AmazonProductMiningKeywordReviewsResult = ReturnType<ListAmazonProductMiningKeywordReviews>;
type AmazonProductMiningKeywordReviewResult = ReturnType<GetAmazonProductMiningKeywordReview>;
type AmazonProductMiningExportResult = ReturnType<ExportAmazonProductMiningResult>;
type AmazonProductMiningAutoContinueResult = ReturnType<ContinueInterruptedAmazonProductMiningTasks>;
type ReadPluginIntervention = (taskId: string) => Promise<PluginInterventionSnapshot | null>;
type RequestPluginIntervention = (request: PluginInterventionRequest) => Promise<unknown>;

export type DeepResearchInputAttachmentStagingFile = {
  fileName: string;
  contentType: string | null;
  bytes: Buffer;
};

export type GrassEyeWorkbenchHandle = {
  init: () => Promise<void>;
  shutdown: () => Promise<void>;
  recordWorkbenchApiBoundaryEvent: (input: {
    authenticated: boolean;
    decision: "allowed" | "blocked";
    jobOwner?: string | undefined;
    method: string | undefined;
    originCategory: "local-ui" | "external-website" | "unknown";
    path: string;
    reason: string;
    requestId?: string | undefined;
    routePurpose?: string | undefined;
    sourceSystem?: string | undefined;
  }) => void;
  getDataDir: () => string;
  readAmazonInvoiceUploadIntervention: ReadPluginIntervention;
  pauseAmazonInvoiceUpload: RequestPluginIntervention;
  cancelAmazonInvoiceUpload: RequestPluginIntervention;
  takeoverAmazonInvoiceUpload: RequestPluginIntervention;
  resumeAmazonInvoiceUpload: RequestPluginIntervention;
  readAmazonProductMiningIntervention: ReadPluginIntervention;
  pauseAmazonProductMining: RequestPluginIntervention;
  cancelAmazonProductMining: RequestPluginIntervention;
  takeoverAmazonProductMining: RequestPluginIntervention;
  resumeAmazonProductMining: RequestPluginIntervention;
  readDeepResearchIntervention: ReadPluginIntervention;
  pauseDeepResearch: RequestPluginIntervention;
  cancelDeepResearch: RequestPluginIntervention;
  takeoverDeepResearch: RequestPluginIntervention;
  resumeDeepResearch: RequestPluginIntervention;
  getMediaProcessingAbilityGroup: () => MediaProcessingAbilityGroup;
  getAiInputGatewayAbilityGroup: () => AiInputGatewayAbilityGroup;
  getHealthReport: () => Promise<WorkbenchHealthReport>;
  getMissionReadinessReport: () => Promise<WorkbenchMissionReadinessReport>;
  getMissionStartPreflight: (
    input: WorkbenchPreflightInput,
  ) => Promise<WorkbenchPreflightResult>;
  getModeInfo: () => unknown;
  readXuanxueAiProductionStatus: (orderId: string) => {
    order: XuanxueAiOrderRecord;
    intervention: XuanxueAiInterventionRecord;
  } | null;
  pauseXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  cancelXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  takeoverXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  resumeXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  getAppRunLimitSettings: () => Promise<AppRunLimitSettings>;
  saveAppRunLimitSettings: (
    input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">,
  ) => Promise<AppRunLimitSettings>;
  getOnlineAiProviderSettings: () => Promise<OnlineAiProviderPublicStatus>;
  saveOnlineAiProviderSettings: (input: {
    displayName?: string | null;
    apiKey: string;
    modelName?: string | null;
  }) => Promise<OnlineAiProviderPublicStatus>;
  openAdminInvoicePage: (
    input: AmazonInvoiceUploadAdminOpenInput,
  ) => Promise<AmazonInvoiceUploadAdminOpenResult>;
  startAmazonInvoiceUploadMission: (
    input: AmazonInvoiceUploadMissionInput,
  ) => Promise<AmazonInvoiceUploadMissionStartResult>;
  startAmazonInvoiceUploadTask: (
    input: AmazonInvoiceUploadTaskStartInput,
  ) => Promise<AmazonInvoiceUploadTaskRecord>;
  resumeAmazonInvoiceUploadTask: (
    input: AmazonInvoiceUploadTaskResumeInput,
  ) => Promise<AmazonInvoiceUploadTaskRecord>;
  getAmazonInvoiceUploadTaskStatus: (
    taskId: string,
  ) => Promise<AmazonInvoiceUploadTaskRecord>;
  getLatestAmazonInvoiceUploadTaskForInvoice: (
    input: { amazonOrderId: string; invoiceNo?: string },
  ) => Promise<AmazonInvoiceUploadTaskRecord | null>;
  listAmazonInvoiceUploadLedger: () => Promise<AmazonInvoiceUploadLedgerRecord[]>;
  startAmazonTaxInvoiceDownloadTask: (
    input: AmazonTaxInvoiceDownloadMissionInput,
  ) => Promise<AmazonTaxInvoiceDownloadTaskRecord>;
  getAmazonTaxInvoiceDownloadTaskStatus: (
    taskId: string,
  ) => Promise<AmazonTaxInvoiceDownloadTaskRecord>;
  getLatestAmazonTaxInvoiceDownloadTask: (
    input?: { marketplace?: string; requestId?: string },
  ) => Promise<AmazonTaxInvoiceDownloadTaskRecord | null>;
  getAmazonTaxInvoiceDownloadArtifact: (
    taskId: string,
  ) => Promise<AmazonTaxInvoiceDownloadArtifactMetadata>;
  startDeepResearchAnalysis: (
    input: DeepResearchAnalysisStartInput,
  ) => Promise<DeepResearchJobSnapshot>;
  stageDeepResearchAnalysisInputAttachments: (input: {
    files: readonly DeepResearchInputAttachmentStagingFile[];
  }) => Promise<{ attachments: DeepResearchInputAttachment[] }>;
  getDeepResearchAnalysisJob: (
    jobId: string,
  ) => Promise<DeepResearchJobSnapshot | null>;
  listDeepResearchAnalysisJobs: (input?: {
    limit?: number;
    status?: DeepResearchHistorySnapshot["jobs"][number]["status"];
  }) => Promise<DeepResearchHistorySnapshot>;
  getDeepResearchAnalysisReport: (
    jobId: string,
  ) => Promise<DeepResearchReportViewModel | null>;
  getLatestDeepResearchAnalysisJob: () => Promise<DeepResearchJobSnapshot | null>;
  getDeepResearchAnalysisTimeline: (
    jobId: string,
  ) => Promise<DeepResearchTimelineSnapshot | null>;
  exportDeepResearchAnalysisArtifact: (input: {
    jobId: string;
    kind: DeepResearchExportArtifactPayload["kind"];
  }) => Promise<DeepResearchExportArtifactPayload | null>;
  deleteDeepResearchAnalysisJob: (
    jobId: string,
  ) => Promise<{ deleted: boolean; jobId: string }>;
  startAmazonProductMiningMission: (
    input: AmazonProductMiningMissionInput,
  ) => AmazonProductMiningStartResult;
  getAmazonProductMiningTaskStatus: (
    taskId: string,
  ) => AmazonProductMiningTaskResult;
  getLatestAmazonProductMiningTask: () => AmazonProductMiningTaskResult;
  listAmazonProductMiningKeywordReviews: (
    taskId?: string,
  ) => AmazonProductMiningKeywordReviewsResult;
  getAmazonProductMiningKeywordReview: (
    reviewId: string,
  ) => AmazonProductMiningKeywordReviewResult;
  exportAmazonProductMiningResult: (
    taskId: string,
  ) => AmazonProductMiningExportResult;
  continueInterruptedAmazonProductMiningTasks: () => AmazonProductMiningAutoContinueResult;
};
