import {
  AmazonInvoiceUploadAdminOpenInputSchema,
  AmazonInvoiceUploadInterventionRequestSchema,
  AmazonInvoiceUploadMissionInputSchema,
  AmazonInvoiceUploadResumeInputSchema,
  AmazonInvoiceUploadTaskStartInputSchema,
  AmazonTaxInvoiceDownloadMissionInputSchema,
  cancelAmazonInvoiceUpload,
  pauseAmazonInvoiceUpload,
  resumeAmazonInvoiceUploadTask,
  startAmazonInvoiceAdminOpenTask,
  startAmazonInvoiceUploadMission,
  startAmazonInvoiceUploadTask,
  startAmazonTaxInvoiceDownloadTask,
  takeoverAmazonInvoiceUpload,
  resumeAmazonInvoiceUpload,
} from "../plugins/amazon-invoice-upload/index.js";

export const runPauseAmazonInvoiceUploadRoute = (rawInput: Parameters<typeof pauseAmazonInvoiceUpload>[1], dataDir: string) =>
  pauseAmazonInvoiceUpload(dataDir, AmazonInvoiceUploadInterventionRequestSchema.parse(rawInput));
export const runCancelAmazonInvoiceUploadRoute = (rawInput: Parameters<typeof cancelAmazonInvoiceUpload>[1], dataDir: string) =>
  cancelAmazonInvoiceUpload(dataDir, AmazonInvoiceUploadInterventionRequestSchema.parse(rawInput));
export const runTakeoverAmazonInvoiceUploadRoute = (rawInput: Parameters<typeof takeoverAmazonInvoiceUpload>[1], dataDir: string) =>
  takeoverAmazonInvoiceUpload(dataDir, AmazonInvoiceUploadInterventionRequestSchema.parse(rawInput));
export const runResumeAmazonInvoiceUploadInterventionRoute = (rawInput: Parameters<typeof resumeAmazonInvoiceUpload>[1], dataDir: string) =>
  resumeAmazonInvoiceUpload(dataDir, AmazonInvoiceUploadInterventionRequestSchema.parse(rawInput));

export const runAmazonInvoiceAdminOpenRoute = (
  rawInput: unknown,
  browser: Parameters<typeof startAmazonInvoiceAdminOpenTask>[0],
) => startAmazonInvoiceAdminOpenTask(
  browser,
  AmazonInvoiceUploadAdminOpenInputSchema.parse(rawInput),
);

export const runAmazonInvoiceUploadMissionRoute = (
  rawInput: unknown,
  runtime: Parameters<typeof startAmazonInvoiceUploadMission> extends [
    infer Browser,
    infer Logger,
    infer Evidence,
    unknown,
  ] ? readonly [Browser, Logger, Evidence] : never,
) => startAmazonInvoiceUploadMission(
  runtime[0],
  runtime[1],
  runtime[2],
  AmazonInvoiceUploadMissionInputSchema.parse(rawInput),
);

export const runAmazonInvoiceUploadTaskRoute = (
  rawInput: unknown,
  runtime: Omit<Parameters<typeof startAmazonInvoiceUploadTask>[0], "task">,
) => startAmazonInvoiceUploadTask({
  ...runtime,
  task: AmazonInvoiceUploadTaskStartInputSchema.parse(rawInput),
});

export const runAmazonInvoiceUploadResumeRoute = (
  rawInput: unknown,
  runtime: Omit<Parameters<typeof resumeAmazonInvoiceUploadTask>[0], "taskId">,
) => resumeAmazonInvoiceUploadTask({
  ...runtime,
  ...AmazonInvoiceUploadResumeInputSchema.parse(rawInput),
});

export const runAmazonTaxInvoiceDownloadRoute = (
  rawInput: unknown,
  runtime: Omit<Parameters<typeof startAmazonTaxInvoiceDownloadTask>[0], "mission">,
) => startAmazonTaxInvoiceDownloadTask({
  ...runtime,
  mission: AmazonTaxInvoiceDownloadMissionInputSchema.parse(rawInput),
});
