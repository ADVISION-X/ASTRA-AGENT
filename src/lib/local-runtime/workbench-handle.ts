import type { OnlineAiProviderPublicStatus } from "../online-ai/index.js";
import type { AppRunLimitSettings } from "./settings-types.js";
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

type AmazonInvoiceUploadAdminOpenInput = Parameters<OpenAmazonInvoiceAdminPage>[1];
type AmazonInvoiceUploadAdminOpenResult = Awaited<ReturnType<OpenAmazonInvoiceAdminPage>>;
type AmazonInvoiceUploadMissionInput = Parameters<StartAmazonInvoiceUploadMission>[2];
type AmazonInvoiceUploadMissionStartResult = Awaited<ReturnType<StartAmazonInvoiceUploadMission>>;
type AmazonInvoiceUploadTaskStartInput = Parameters<StartAmazonInvoiceUploadTask>[0]["task"];
type AmazonInvoiceUploadTaskResumeInput = { taskId: string };
type AmazonInvoiceUploadTaskRecord = Awaited<ReturnType<GetAmazonInvoiceUploadTaskStatus>>;

export type GrassEyeWorkbenchHandle = {
  init: () => Promise<void>;
  getDataDir: () => string;
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
};