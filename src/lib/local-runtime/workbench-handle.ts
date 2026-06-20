import type { OnlineAiProviderPublicStatus } from "../online-ai/index.js";
import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";
import type { VideoDownloadAbilityGroup } from "../../capabilities/video-download/index.js";
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
type ListAmazonInvoiceUploadLedger = typeof import("../../plugins/amazon-invoice-upload/index.js").listAmazonInvoiceUploadLedger;
type StartAmazonTaxInvoiceDownloadTask = typeof import("../../plugins/amazon-invoice-upload/index.js").startAmazonTaxInvoiceDownloadTask;
type GetAmazonTaxInvoiceDownloadTaskStatus = typeof import("../../plugins/amazon-invoice-upload/index.js").getAmazonTaxInvoiceDownloadTaskStatus;
type GetAmazonTaxInvoiceDownloadArtifact = typeof import("../../plugins/amazon-invoice-upload/index.js").getAmazonTaxInvoiceDownloadArtifact;
type StartFacebookProductVideoMiningMission = typeof import("../../plugins/facebook-product-video-mining/index.js").startFacebookProductVideoMiningMission;
type GetFacebookProductVideoMiningRunStatus = typeof import("../../plugins/facebook-product-video-mining/index.js").getFacebookProductVideoMiningRunStatus;
type ListFacebookProductVideoMiningSavedRecords = typeof import("../../plugins/facebook-product-video-mining/index.js").listFacebookProductVideoMiningSavedRecords;
type ExportFacebookProductVideoMiningSelectionRecords = typeof import("../../plugins/facebook-product-video-mining/index.js").exportFacebookProductVideoMiningSelectionRecords;
type StartAmazonProductMiningMission = typeof import("../../plugins/amazon-product-mining/index.js").startAmazonProductMiningMission;
type GetAmazonProductMiningTaskStatus = typeof import("../../plugins/amazon-product-mining/index.js").getAmazonProductMiningTaskStatus;
type ListAmazonProductMiningKeywordReviews = typeof import("../../plugins/amazon-product-mining/index.js").listAmazonProductMiningKeywordReviews;
type GetAmazonProductMiningKeywordReview = typeof import("../../plugins/amazon-product-mining/index.js").getAmazonProductMiningKeywordReview;
type ExportAmazonProductMiningResult = typeof import("../../plugins/amazon-product-mining/index.js").exportAmazonProductMiningResult;
type ContinueInterruptedAmazonProductMiningTasks = typeof import("../../plugins/amazon-product-mining/index.js").continueInterruptedAmazonProductMiningTasks;
type StartAmazonProductSyncTask = typeof import("../../plugins/amazon-product-sync/index.js").startAmazonProductSyncTask;
type GetAmazonProductSyncTaskStatus = typeof import("../../plugins/amazon-product-sync/index.js").getAmazonProductSyncTaskStatus;
type GetLatestAmazonProductSyncTask = typeof import("../../plugins/amazon-product-sync/index.js").getLatestAmazonProductSyncTask;
type StartAmazonProductFeeSyncTask = typeof import("../../plugins/amazon-product-fee-sync/index.js").startAmazonProductFeeSyncTask;
type GetAmazonProductFeeSyncTaskStatus = typeof import("../../plugins/amazon-product-fee-sync/index.js").getAmazonProductFeeSyncTaskStatus;
type GetLatestAmazonProductFeeSyncTask = typeof import("../../plugins/amazon-product-fee-sync/index.js").getLatestAmazonProductFeeSyncTask;
type StartPick3IsBlindEvalTask = typeof import("../../plugins/pick3-is-blind-eval/index.js").runPick3IsBlindEvalFlow;
type GetLatestPick3IsBlindEvalTask = typeof import("../../plugins/pick3-is-blind-eval/index.js").getLatestPick3IsBlindEvalTask;
type DeletePick3HumanReviewTask = typeof import("../../plugins/pick3-is-blind-eval/index.js").deletePick3HumanReviewTask;
type ListPick3HumanReviewHistory = typeof import("../../plugins/pick3-is-blind-eval/index.js").listPick3HumanReviewHistory;
type GetPick3HumanReviewTask = typeof import("../../plugins/pick3-is-blind-eval/index.js").getPick3HumanReviewTask;
type GetPick3HumanReviewInteraction = typeof import("../../plugins/pick3-is-blind-eval/index.js").getPick3HumanReviewInteraction;
type ReviewPick3PlaybookLessonManually = typeof import("../../plugins/pick3-is-blind-eval/index.js").reviewPick3PlaybookLessonManually;
type ListPick3TrendSnapshot = typeof import("../../plugins/pick3-is-blind-eval/index.js").listPick3TrendSnapshot;

type AmazonInvoiceUploadAdminOpenInput = Parameters<OpenAmazonInvoiceAdminPage>[1];
type AmazonInvoiceUploadAdminOpenResult = Awaited<ReturnType<OpenAmazonInvoiceAdminPage>>;
type AmazonInvoiceUploadMissionInput = Parameters<StartAmazonInvoiceUploadMission>[2];
type AmazonInvoiceUploadMissionStartResult = Awaited<ReturnType<StartAmazonInvoiceUploadMission>>;
type AmazonInvoiceUploadTaskStartInput = Parameters<StartAmazonInvoiceUploadTask>[0]["task"];
type AmazonInvoiceUploadTaskResumeInput = { taskId: string };
type AmazonInvoiceUploadTaskRecord = Awaited<ReturnType<GetAmazonInvoiceUploadTaskStatus>>;
type AmazonInvoiceUploadLedgerRecord = ReturnType<ListAmazonInvoiceUploadLedger>[number];
type AmazonTaxInvoiceDownloadMissionInput = Parameters<StartAmazonTaxInvoiceDownloadTask>[0]["mission"];
type AmazonTaxInvoiceDownloadTaskRecord = Awaited<ReturnType<GetAmazonTaxInvoiceDownloadTaskStatus>>;
type AmazonTaxInvoiceDownloadArtifactMetadata = ReturnType<GetAmazonTaxInvoiceDownloadArtifact>;
type FacebookProductVideoMiningMissionInput = Parameters<StartFacebookProductVideoMiningMission>[0];
type FacebookProductVideoMiningRunStatus = Awaited<ReturnType<GetFacebookProductVideoMiningRunStatus>>;
type FacebookProductVideoMiningSavedRecords = Awaited<ReturnType<ListFacebookProductVideoMiningSavedRecords>>;
type FacebookProductVideoMiningSelectionExport = Awaited<ReturnType<ExportFacebookProductVideoMiningSelectionRecords>>;
type AmazonProductMiningMissionInput = Parameters<StartAmazonProductMiningMission>[0]["rawInput"];
type AmazonProductMiningStartResult = ReturnType<StartAmazonProductMiningMission>;
type AmazonProductMiningTaskResult = ReturnType<GetAmazonProductMiningTaskStatus>;
type AmazonProductMiningKeywordReviewsResult = ReturnType<ListAmazonProductMiningKeywordReviews>;
type AmazonProductMiningKeywordReviewResult = ReturnType<GetAmazonProductMiningKeywordReview>;
type AmazonProductMiningExportResult = ReturnType<ExportAmazonProductMiningResult>;
type AmazonProductMiningAutoContinueResult = ReturnType<ContinueInterruptedAmazonProductMiningTasks>;
type AmazonProductSyncStartInput = Parameters<StartAmazonProductSyncTask>[0];
type AmazonProductSyncTaskRecord = Awaited<ReturnType<GetAmazonProductSyncTaskStatus>>;
type AmazonProductSyncLatestTaskRecord = Awaited<ReturnType<GetLatestAmazonProductSyncTask>>;
type AmazonProductFeeSyncStartInput = Parameters<StartAmazonProductFeeSyncTask>[0];
type AmazonProductFeeSyncTaskRecord = Awaited<ReturnType<GetAmazonProductFeeSyncTaskStatus>>;
type AmazonProductFeeSyncLatestTaskRecord = Awaited<ReturnType<GetLatestAmazonProductFeeSyncTask>>;
type Pick3IsBlindEvalStartInput = Parameters<StartPick3IsBlindEvalTask>[0];
type Pick3IsBlindEvalTaskRecord = Awaited<ReturnType<StartPick3IsBlindEvalTask>>;
type Pick3IsBlindEvalLatestTaskRecord = ReturnType<GetLatestPick3IsBlindEvalTask>;
type Pick3HumanReviewDeleteResult = ReturnType<DeletePick3HumanReviewTask>;
type Pick3HumanReviewHistoryResult = ReturnType<ListPick3HumanReviewHistory>;
type Pick3HumanReviewTaskResult = ReturnType<GetPick3HumanReviewTask>;
type Pick3HumanReviewInteractionResult = ReturnType<GetPick3HumanReviewInteraction>;
type Pick3ManualPlaybookLessonResult = Awaited<ReturnType<ReviewPick3PlaybookLessonManually>>;
type Pick3TrendSnapshotResult = ReturnType<ListPick3TrendSnapshot>;

export type DeepResearchInputAttachmentStagingFile = {
  fileName: string;
  contentType: string | null;
  bytes: Buffer;
};

export type GrassEyeWorkbenchHandle = {
  init: () => Promise<void>;
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
  getVideoDownloadAbilityGroup: () => VideoDownloadAbilityGroup;
  getMediaProcessingAbilityGroup: () => MediaProcessingAbilityGroup;
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
  startAmazonProductSyncTask: (
    input: AmazonProductSyncStartInput,
  ) => Promise<NonNullable<AmazonProductSyncTaskRecord>>;
  getAmazonProductSyncTaskStatus: (
    taskId: string,
  ) => Promise<AmazonProductSyncTaskRecord>;
  getLatestAmazonProductSyncTask: () => Promise<AmazonProductSyncLatestTaskRecord>;
  startAmazonProductFeeSyncTask: (
    input: AmazonProductFeeSyncStartInput,
  ) => Promise<NonNullable<AmazonProductFeeSyncTaskRecord>>;
  getAmazonProductFeeSyncTaskStatus: (
    taskId: string,
  ) => Promise<AmazonProductFeeSyncTaskRecord>;
  getLatestAmazonProductFeeSyncTask: () => Promise<AmazonProductFeeSyncLatestTaskRecord>;
  startPick3IsBlindEvalTask: (
    input: Pick3IsBlindEvalStartInput,
  ) => Promise<Pick3IsBlindEvalTaskRecord>;
  getLatestPick3IsBlindEvalTask: () => Promise<Pick3IsBlindEvalLatestTaskRecord>;
  listPick3TrendSnapshot: () => Promise<Pick3TrendSnapshotResult>;
  listPick3HumanReviewHistory: () => Promise<Pick3HumanReviewHistoryResult>;
  getPick3HumanReviewTask: (
    taskId: string,
  ) => Promise<Pick3HumanReviewTaskResult>;
  getPick3HumanReviewInteraction: (input: {
    interactionId: string;
    taskId: string;
  }) => Promise<Pick3HumanReviewInteractionResult>;
  deletePick3HumanReviewTask: (
    taskId: string,
  ) => Promise<Pick3HumanReviewDeleteResult>;
  reviewPick3PlaybookLessonManually: (input: {
    phase: string;
    position: string;
    taskId: string;
  }) => Promise<Pick3ManualPlaybookLessonResult>;
};
