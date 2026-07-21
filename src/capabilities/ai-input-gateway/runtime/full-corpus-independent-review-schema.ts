import { z } from "zod";
import { FULL_CORPUS_SOURCE_RETRIEVAL_SCHEMA_REF, FullCorpusSourceRetrievalSchema } from "./full-corpus-source-retrieval-schema.js";

const FullCorpusReviewClaimSchema = z.object({
  claim_ref: z.string().min(1),
  claim_text: z.string().min(1),
  range_refs: z.array(z.string().min(1)).min(1),
  support_type: z.enum(["support", "counter_evidence", "boundary"]),
  counter_evidence_refs: z.array(z.string().min(1)).default([]),
  school_tag: z.string(),
  uncertainty_notes: z.array(z.string().min(1)).default([]),
}).strict();

const FullCorpusReviewConflictSchema = z.object({
  conflict_ref: z.string().min(1),
  range_refs: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  conflict_text: z.string().min(1).optional(),
  resolution: z.string().min(1).optional(),
  uncertainty_notes: z.array(z.string().min(1)).default([]),
}).strict().refine((value) => Boolean(value.reason || value.description || value.conflict_text), { message: "conflict reason, description, or conflict_text is required" });

export const FULL_CORPUS_INDEPENDENT_REVIEW_SCHEMA_REF = "schema:full-corpus-independent-review-v1";
export const FULL_CORPUS_CONFLICT_ADJUDICATION_SCHEMA_REF = "schema:full-corpus-conflict-adjudication-v1";
export const FULL_CORPUS_RESEARCH_FINAL_SCHEMA_REF = "schema:full-corpus-research-final-v1";

const FullCorpusResearchFinalClaimSchema = z.object({
  claim_ref: z.string().min(1),
  claim_text: z.string().min(1),
  range_refs: z.array(z.string().min(1)).min(1),
  subject_fact_refs: z.array(z.string().min(1)).default([]),
  book_evidence_refs: z.array(z.string().min(1)).default([]),
  source_refs: z.array(z.string().min(1)).default([]),
  support_type: z.enum(["support", "counter_evidence", "boundary", "insufficient_evidence"]),
  counter_evidence_refs: z.array(z.string().min(1)).default([]),
  uncertainty_notes: z.array(z.string().min(1)).default([]),
}).strict();

export const FullCorpusResearchFinalSchema = z.object({
  status: z.enum(["validated", "blocked", "insufficient_evidence"]),
  claims: z.array(FullCorpusResearchFinalClaimSchema),
  conflicts: z.array(z.unknown()).default([]),
  blocking_reasons: z.array(z.string().min(1)),
}).strict();

export const FullCorpusIndependentReviewSchema = z.object({
  status: z.enum(["validated", "blocked"]),
  claims: z.array(FullCorpusReviewClaimSchema),
  conflicts: z.array(FullCorpusReviewConflictSchema),
  blocking_reasons: z.array(z.string().min(1)),
  uncertainty_notes: z.array(z.string().min(1)).default([]),
}).strict();

export const FullCorpusConflictAdjudicationSchema = z.object({
  status: z.enum(["resolved", "blocked"]),
  decisions: z.array(z.object({
    conflict_ref: z.string().min(1),
    decision: z.enum(["retain", "block", "needs_more_source"]),
    reason: z.string().min(1),
    evidence_refs: z.array(z.string().min(1)).min(1),
  }).strict()),
  blocking_reasons: z.array(z.string().min(1)),
}).strict();

export const validateExpectedOutputSchema = (schemaRef: string, parsedJson: unknown): boolean => {
  if (schemaRef === FULL_CORPUS_INDEPENDENT_REVIEW_SCHEMA_REF) {
    return FullCorpusIndependentReviewSchema.safeParse(parsedJson).success;
  }
  if (schemaRef === FULL_CORPUS_CONFLICT_ADJUDICATION_SCHEMA_REF) {
    return FullCorpusConflictAdjudicationSchema.safeParse(parsedJson).success;
  }
  if (schemaRef === FULL_CORPUS_SOURCE_RETRIEVAL_SCHEMA_REF) {
    return FullCorpusSourceRetrievalSchema.safeParse(parsedJson).success;
  }
  if (schemaRef === FULL_CORPUS_RESEARCH_FINAL_SCHEMA_REF) {
    return FullCorpusResearchFinalSchema.safeParse(parsedJson).success;
  }
  return false;
};
