import { z } from "zod";

const isLawIdCharacter = (character: string): boolean =>
  (character >= "A" && character <= "Z") || (character >= "0" && character <= "9") || character === "-";

const hasLawIdPrefix = (value: string): boolean =>
  value.startsWith("APEX-") || value.startsWith("GRASSEYE-");

const isLawId = (value: string): boolean =>
  hasLawIdPrefix(value)
  && value.slice(value.indexOf("-") + 1).length > 0
  && [...value.slice(value.indexOf("-") + 1)].every(isLawIdCharacter);

export const lawIdSchema = z.string().refine(isLawId, "Law id must start with APEX- or GRASSEYE- and use uppercase letters, numbers, or dashes.");

export const clauseEvidenceModeSchema = z.enum(["static", "acceptance", "real-chrome"]);

export const lawClauseSchema = z
  .object({
    clauseId: z.string().min(1).refine((value) => value !== "primary", "Clause id must be semantic and cannot be primary."),
    statement: z.string().min(1),
    evidenceMode: clauseEvidenceModeSchema,
    ownerDomain: z.string().min(1),
  })
  .strict();

const lawMetadataBaseSchema = z
  .object({
    lawId: lawIdSchema,
    status: z.enum(["active", "retired", "draft"]),
    tier: z.string().min(1),
    capabilityDomain: z.string().min(1),
    enforcementMode: z.string().min(1),
    evidenceMode: z.string().min(1),
    summary: z.string().min(1),
    clauses: z.array(lawClauseSchema).min(1),
  })
  .passthrough();

export const lawMetadataSchema = lawMetadataBaseSchema.superRefine((law, context) => {
    if (law.status === "active" && law.clauses.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active laws must declare at least one stable clause.",
        path: ["clauses"],
      });
    }
    const clauseIds = new Set<string>();
    for (const [index, clause] of law.clauses.entries()) {
      if (clauseIds.has(clause.clauseId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate clauseId ${clause.clauseId}.`,
          path: ["clauses", index, "clauseId"],
        });
      }
      clauseIds.add(clause.clauseId);
    }
});

export type LawSource = z.infer<typeof lawMetadataBaseSchema> & {
  filePath: string;
  blockIndex: number;
};
