import { z } from "zod";

export const DeepResearchBusinessDeckAudienceSchema = z.enum([
  "executive",
  "investor",
  "internal",
  "client",
  "general",
]);

export const DeepResearchBusinessDeckSlideTypeSchema = z.enum([
  "cover",
  "decision",
  "evidence",
  "ranking",
  "logic_map",
  "risk",
  "signal",
  "limitation",
  "reference",
  "appendix",
]);

export const DeepResearchBusinessDeckOmittedItemTypeSchema = z.enum([
  "rankedConclusion",
  "reverseCondition",
  "evidenceGap",
  "reference",
  "limitation",
  "other",
]);

export const DeepResearchBusinessDeckSlideSchema = z.object({
  slideNumber: z.number().int().positive(),
  slideType: DeepResearchBusinessDeckSlideTypeSchema,
  title: z.string().trim().min(1),
  headline: z.string().trim().min(1),
  bullets: z.array(z.string().trim().min(1)).min(1),
  visualSuggestion: z.string().trim().min(1),
  speakerNotes: z.string().trim().min(1),
  evidenceRefs: z.array(z.string().trim().min(1)).default([]),
  mustNotDrop: z.array(z.string().trim().min(1)).default([]),
}).strict();

export const DeepResearchBusinessDeckOutlineSchema = z.object({
  deckTitle: z.string().trim().min(1),
  deckSubtitle: z.string().trim().optional(),
  audience: DeepResearchBusinessDeckAudienceSchema,
  sourceDecisionPackageId: z.string().trim().optional(),
  sourceFinalReportId: z.string().trim().optional(),
  verdictPreservationCheck: z.object({
    directAnswerPreserved: z.literal(true),
    finalVerdictPreserved: z.literal(true),
    confidencePreserved: z.literal(true),
    rankedConclusionsPreserved: z.literal(true),
    reverseConditionsPreserved: z.literal(true),
    evidenceGapsPreserved: z.literal(true),
    limitationsPreserved: z.literal(true),
    noNewFactsAdded: z.literal(true),
  }).strict(),
  slides: z.array(DeepResearchBusinessDeckSlideSchema).min(8).max(15),
  deckWarnings: z.array(z.string().trim().min(1)).default([]),
  contentPreservationSummary: z.object({
    usedRankedConclusionCount: z.number().int().nonnegative(),
    usedReverseConditionCount: z.number().int().nonnegative(),
    usedEvidenceGapCount: z.number().int().nonnegative(),
    usedReferenceCount: z.number().int().nonnegative(),
    omittedItems: z.array(z.object({
      itemType: DeepResearchBusinessDeckOmittedItemTypeSchema,
      item: z.string().trim().min(1),
      reason: z.string().trim().min(1),
    }).strict()).default([]),
  }).strict(),
}).strict();

export type DeepResearchBusinessDeckOutline = z.infer<typeof DeepResearchBusinessDeckOutlineSchema>;