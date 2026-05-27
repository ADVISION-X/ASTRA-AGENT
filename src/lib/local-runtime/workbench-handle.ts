import type { OnlineAiProviderPublicStatus } from "../online-ai/index.js";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { VideoDownloadAbilityGroup } from "../../capabilities/video-download/index.js";
import type {
  DeepResearchAnalysisStartInput,
  DeepResearchExportArtifactPayload,
  DeepResearchHistorySnapshot,
  DeepResearchJobSnapshot,
  DeepResearchReportViewModel,
  DeepResearchTimelineSnapshot,
} from "../../plugins/deep-research-analysis/deep-research-analysis.public.js";
import type { AppRunLimitSettings } from "./settings-types.js";
import type {
  VideoDownloadSourcePage,
  VideoDownloadSourcePagePlatform,
} from "./workbench-video-download-support.js";
import type {
  WorkbenchHealthReport,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightInput,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";

type OpenAmazonInvoiceAdminPage = typeof import("../../plugins/amazon-invoice-upload/index.js").openAmazonInvoiceAdminPage;
type StartAmazonInvoiceUploadMission = typeof import("../../plugins/amazon-invoice-upload/index.js").startAmazonInvoiceUploadMission;
type StartAmazonInvoiceUploadTask = typeof import("../../plugins/amazon-invoice-upload/index.js").startAmazonInvoiceUploadTask;
type GetAmazonInvoiceUploadTaskStatus = typeof import("../../plugins/amazon-invoice-upload/index.js").getAmazonInvoiceUploadTaskStatus;
type StartFacebookProductVideoMiningMission = typeof import("../../plugins/facebook-product-video-mining/index.js").startFacebookProductVideoMiningMission;
type GetFacebookProductVideoMiningRunStatus = typeof import("../../plugins/facebook-product-video-mining/index.js").getFacebookProductVideoMiningRunStatus;
type ListFacebookProductVideoMiningSavedRecords = typeof import("../../plugins/facebook-product-video-mining/index.js").listFacebookProductVideoMiningSavedRecords;
type ExportFacebookProductVideoMiningSelectionRecords = typeof import("../../plugins/facebook-product-video-mining/index.js").exportFacebookProductVideoMiningSelectionRecords;
type StartAmazonProductMiningMission = typeof import("../../plugins/amazon-product-mining/index.js").startAmazonProductMiningMission;
type GetAmazonProductMiningTaskStatus = typeof import("../../plugins/amazon-product-mining/index.js").getAmazonProductMiningTaskStatus;
type ListAmazonProductMiningKeywordReviews = typeof import("../../plugins/amazon-product-mining/index.js").listAmazonProductMiningKeywordReviews;
type GetAmazonProductMiningKeywordReview = typeof import("../../plugins/amazon-product-mining/index.js").getAmazonProductMiningKeywordReview;
type IngestAmazonProductMiningKeywordReview = typeof import("../../plugins/amazon-product-mining/index.js").ingestAmazonProductMiningKeywordReview;
type ExportAmazonProductMiningResult = typeof import("../../plugins/amazon-product-mining/index.js").exportAmazonProductMiningResult;

type AmazonInvoiceUploadAdminOpenInput = Parameters<OpenAmazonInvoiceAdminPage>[1];
type AmazonInvoiceUploadAdminOpenResult = Awaited<ReturnType<OpenAmazonInvoiceAdminPage>>;
type AmazonInvoiceUploadMissionInput = Parameters<StartAmazonInvoiceUploadMission>[2];
type AmazonInvoiceUploadMissionStartResult = Awaited<ReturnType<StartAmazonInvoiceUploadMission>>;
type AmazonInvoiceUploadTaskStartInput = Parameters<StartAmazonInvoiceUploadTask>[0]["task"];
type AmazonInvoiceUploadTaskResumeInput = { taskId: string };
type AmazonInvoiceUploadTaskRecord = Awaited<ReturnType<GetAmazonInvoiceUploadTaskStatus>>;
type FacebookProductVideoMiningMissionInput = Parameters<StartFacebookProductVideoMiningMission>[0];
type FacebookProductVideoMiningRunStatus = Awaited<ReturnType<GetFacebookProductVideoMiningRunStatus>>;
type FacebookProductVideoMiningSavedRecords = Awaited<ReturnType<ListFacebookProductVideoMiningSavedRecords>>;
type FacebookProductVideoMiningSelectionExport = Awaited<ReturnType<ExportFacebookProductVideoMiningSelectionRecords>>;
type AmazonProductMiningMissionInput = Parameters<StartAmazonProductMiningMission>[0]["rawInput"];
type AmazonProductMiningStartResult = ReturnType<StartAmazonProductMiningMission>;
type AmazonProductMiningTaskResult = ReturnType<GetAmazonProductMiningTaskStatus>;
type AmazonProductMiningKeywordReviewsResult = ReturnType<ListAmazonProductMiningKeywordReviews>;
type AmazonProductMiningKeywordReviewResult = ReturnType<GetAmazonProductMiningKeywordReview>;
type AmazonProductMiningKeywordReviewIngestInput = Parameters<IngestAmazonProductMiningKeywordReview>[0]["rawInput"];
type AmazonProductMiningKeywordReviewIngestResult = ReturnType<IngestAmazonProductMiningKeywordReview>;
type AmazonProductMiningExportResult = ReturnType<ExportAmazonProductMiningResult>;

export type GrassEyeWorkbenchHandle = {
  init: () => Promise<void>;
  getDataDir: () => string;
  getVideoDownloadAbilityGroup: () => VideoDownloadAbilityGroup;
  findOpenVideoDownloadSourcePage: (
    platformId: VideoDownloadSourcePagePlatform,
    preferredSourcePageUrl?: string,
  ) => Promise<VideoDownloadSourcePage | null>;
  getAiInputGatewayAbilityGroup: () => AiInputGatewayAbilityGroup;
  getHealthReport: () => Promise<WorkbenchHealthReport>;
  getMissionReadinessReport: () => Promise<WorkbenchMissionReadinessReport>;
  getMissionStartPreflight: (
    input: WorkbenchPreflightInput,
  ) => Promise<WorkbenchPreflightResult>;
  getModeInfo: () => unknown;
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
  startFacebookProductVideoMiningMission: (
    input: FacebookProductVideoMiningMissionInput,
  ) => Promise<NonNullable<FacebookProductVideoMiningRunStatus>>;
  getFacebookProductVideoMiningRunStatus: (
    runId: string,
  ) => Promise<FacebookProductVideoMiningRunStatus>;
  getLatestFacebookProductVideoMiningRun: () => Promise<FacebookProductVideoMiningRunStatus>;
  listFacebookProductVideoMiningSavedRecords: (
    runId: string,
  ) => Promise<FacebookProductVideoMiningSavedRecords>;
  exportFacebookProductVideoMiningSelectionRecords: (
    runId: string,
  ) => Promise<FacebookProductVideoMiningSelectionExport>;
  startDeepResearchAnalysis: (
    input: DeepResearchAnalysisStartInput,
  ) => Promise<DeepResearchJobSnapshot>;
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
  ingestAmazonProductMiningKeywordReview: (
    input: AmazonProductMiningKeywordReviewIngestInput,
  ) => AmazonProductMiningKeywordReviewIngestResult;
  exportAmazonProductMiningResult: (
    taskId: string,
  ) => AmazonProductMiningExportResult;
};
