import { z } from "zod";

import { PRODUCT_DISCOVERY_OUTCOME_OPTIONS } from "../route-plans/product-discovery-route-plan.constants.js";
import { RequestedPlatformIdSchema } from "../schema/platform-id.schema.js";

const MapAuthoringBinaryOutcomeOptionSchema = z.object({
  optionId: z.string().min(1),
  label: z.string().min(1),
  routeLabel: z.string().min(1),
  description: z.string().min(1),
}).strict();

const toAuthoringOutcomeOption = (option: (typeof PRODUCT_DISCOVERY_OUTCOME_OPTIONS)[number]) => ({
  optionId: option.optionId,
  label: option.label,
  routeLabel: option.routeLabel,
  description: option.description,
});

const DEFAULT_PRODUCT_POSITIVE_OUTCOME_OPTIONS = PRODUCT_DISCOVERY_OUTCOME_OPTIONS
  .filter((option) => option.decision === "product_yes")
  .map(toAuthoringOutcomeOption);
const DEFAULT_PRODUCT_NEGATIVE_OUTCOME_OPTIONS = PRODUCT_DISCOVERY_OUTCOME_OPTIONS
  .filter((option) => option.decision === "product_no")
  .map(toAuthoringOutcomeOption);

export const DEFAULT_PRODUCT_POSITIVE_OUTCOME_ID = "read_comments_and_save_evidence";
export const DEFAULT_PRODUCT_NEGATIVE_OUTCOME_ID = "skip_current_video";

export const MapAuthoringRequestSchema = z.object({
  missionId: z.string().min(1),
  objective: z.string().min(1),
  targetPlatform: RequestedPlatformIdSchema,
  allowedAutomationScope: z.union([z.array(z.string().min(1)), z.string()]).default(["observe_and_prepare_draft_only"]).transform((value) =>
    Array.isArray(value)
      ? value
      : value.split(",").map((item) => item.trim()).filter((item) => item.length > 0),
  ),
  mustAskBefore: z.union([z.array(z.string().min(1)), z.string()]).default([]).transform((value) =>
    Array.isArray(value)
      ? value
      : value.split(",").map((item) => item.trim()).filter((item) => item.length > 0),
  ),
  failureHandlingPreference: z.string().min(1).default("failed"),
  evidencePreference: z.string().min(1).default("refs_and_hashes_only"),
  productPositiveOutcomeOptions: z.array(MapAuthoringBinaryOutcomeOptionSchema).min(1).default([...DEFAULT_PRODUCT_POSITIVE_OUTCOME_OPTIONS]),
  productNegativeOutcomeOptions: z.array(MapAuthoringBinaryOutcomeOptionSchema).min(1).default([...DEFAULT_PRODUCT_NEGATIVE_OUTCOME_OPTIONS]),
  selectedProductPositiveOutcomeId: z.string().min(1).default(DEFAULT_PRODUCT_POSITIVE_OUTCOME_ID),
  selectedProductNegativeOutcomeId: z.string().min(1).default(DEFAULT_PRODUCT_NEGATIVE_OUTCOME_ID),
  runLimit: z.union([
    z.object({ maxRounds: z.number().int().positive(), maxMinutes: z.number().int().positive() }).strict(),
    z.string(),
  ]).default({ maxRounds: 5, maxMinutes: 15 }).transform((value) => {
    if (typeof value !== "string") {
      return value;
    }
    return {
      maxRounds: Number(value.match(/maxRounds=(\d+)/u)?.[1] ?? 5),
      maxMinutes: Number(value.match(/maxMinutes=(\d+)/u)?.[1] ?? 15),
    };
  }),
  operatorNotes: z.string().default(""),
  outputLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
}).strict().superRefine((value, context) => {
  const positiveOptionIds = new Set(value.productPositiveOutcomeOptions.map((option) => option.optionId));
  const negativeOptionIds = new Set(value.productNegativeOutcomeOptions.map((option) => option.optionId));
  if (!positiveOptionIds.has(value.selectedProductPositiveOutcomeId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selectedProductPositiveOutcomeId must reference productPositiveOutcomeOptions.",
      path: ["selectedProductPositiveOutcomeId"],
    });
  }
  if (!negativeOptionIds.has(value.selectedProductNegativeOutcomeId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selectedProductNegativeOutcomeId must reference productNegativeOutcomeOptions.",
      path: ["selectedProductNegativeOutcomeId"],
    });
  }
});

export type MapAuthoringRequest = z.output<typeof MapAuthoringRequestSchema>;
export type MapAuthoringBinaryOutcomeOption = z.output<typeof MapAuthoringBinaryOutcomeOptionSchema>;
