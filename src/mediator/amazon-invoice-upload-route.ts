import {
  AmazonInvoiceUploadAdminOpenInputSchema,
  AmazonInvoiceUploadMissionInputSchema,
  AmazonInvoiceUploadResumeInputSchema,
  AmazonInvoiceUploadTaskStartInputSchema,
  AmazonTaxInvoiceDownloadMissionInputSchema,
  resumeAmazonInvoiceUploadTask,
  startAmazonInvoiceAdminOpenTask,
  startAmazonInvoiceUploadMission,
  startAmazonInvoiceUploadTask,
  startAmazonTaxInvoiceDownloadTask,
} from "../plugins/amazon-invoice-upload/index.js";

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
