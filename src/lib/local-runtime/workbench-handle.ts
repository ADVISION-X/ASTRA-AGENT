import type {
  AmazonInvoiceUploadAdminOpenInput,
  AmazonInvoiceUploadAdminOpenResult,
  AmazonInvoiceUploadMissionInput,
  AmazonInvoiceUploadMissionStartResult,
  AmazonInvoiceUploadTaskRecord,
  AmazonInvoiceUploadTaskResumeInput,
  AmazonInvoiceUploadTaskStartInput,
} from "../../plugins/amazon-invoice-upload/index.js";
import type { OnlineAiProviderPublicStatus } from "../online-ai/index.js";
import type { AppRunLimitSettings } from "./settings-types.js";
import type {
  WorkbenchHealthReport,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightInput,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";

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