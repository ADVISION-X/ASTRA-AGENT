import { z } from "zod";

const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeInteger = z.number().int().nonnegative();

export const MissionRoundProgressSchema = z.object({
  savedLeadCount: nonNegativeInteger.default(0),
  skippedCount: nonNegativeInteger.default(0),
  reviewRequiredCount: nonNegativeInteger.default(0),
  failedActionCount: nonNegativeInteger.default(0),
  consecutiveFailureCount: nonNegativeInteger.default(0),
}).strict();

export const MissionLastActionSummarySchema = z.object({
  sourceActionCode: nullableString,
  status: z.enum(["success", "failed", "review_required", "pending"]).default("pending"),
  gridCell: nullableString,
  targetName: nullableString,
  summary: nullableString,
  actionInputRef: nullableString,
  outputRef: nullableString,
  failureReason: nullableString,
  completedAt: nullableString,
}).strict();
