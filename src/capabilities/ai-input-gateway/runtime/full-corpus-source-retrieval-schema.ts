import { z } from "zod";

const SourceCitationSchema = z.object({
  citation_ref: z.string().min(1),
  book_title: z.string().min(1),
  edition_ref: z.string().min(1),
  source_ref: z.string().min(1),
  page_refs: z.array(z.string().min(1)),
  chapter_ref: z.string().min(1),
  paragraph_ref: z.string().min(1),
  range_ref: z.string().min(1),
  quoted_text: z.string().min(1),
  quoted_text_hash: z.string().regex(/^sha256:[0-9a-f]+$/),
  locator_hash: z.string().regex(/^sha256:[0-9a-f]+$/),
}).strict();

export const FULL_CORPUS_SOURCE_RETRIEVAL_SCHEMA_REF = "schema:full-corpus-source-retrieval-v1";

export const FullCorpusSourceRetrievalSchema = z.object({
  status: z.enum(["validated", "blocked"]),
  evidence: z.object({
    answer_text: z.string().min(1),
    citations: z.array(SourceCitationSchema),
    key_judgement_citation_refs: z.array(z.string().min(1)),
    reasoning_basis: z.array(z.string().min(1)),
    uncertainty: z.array(z.string().min(1)),
    review_required: z.array(z.string().min(1)),
  }).strict(),
  key_judgement_citation_refs: z.array(z.string().min(1)),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
}).strict();
