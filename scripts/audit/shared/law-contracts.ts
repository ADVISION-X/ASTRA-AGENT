import { z } from "zod";

const isLawIdCharacter = (character: string): boolean =>
  (character >= "A" && character <= "Z") || (character >= "0" && character <= "9") || character === "-";

const hasLawIdPrefix = (value: string): boolean =>
  value.startsWith("APEX-") || value.startsWith("GRASSEYE-");

export const isLawId = (value: string): boolean =>
  hasLawIdPrefix(value)
  && value.slice(value.indexOf("-") + 1).length > 0
  && [...value.slice(value.indexOf("-") + 1)].every(isLawIdCharacter);

export const lawIdSchema = z.string().refine(isLawId, "Law id must start with APEX- or GRASSEYE- and use uppercase letters, numbers, or dashes.");

export const clauseEvidenceModeSchema = z.enum([
  "static",
  "acceptance",
  "acceptance+real-chrome",
  "real-chrome",
  "model+acceptance+real-chrome+real-provider",
  "artifact+real-chrome",
]);

export const clauseEvidenceFacetSchema = z.enum([
  "static",
  "model",
  "acceptance",
  "artifact",
  "real-chrome",
  "real-provider",
]);

export type ClauseEvidenceFacet = z.infer<typeof clauseEvidenceFacetSchema>;

export const evidenceModeFacets = (value: string): readonly ClauseEvidenceFacet[] =>
  Object.freeze(clauseEvidenceModeSchema.parse(value).split("+").map((facet) =>
    clauseEvidenceFacetSchema.parse(facet)));

export const evidenceModeIncludesRealChrome = (value: string): boolean =>
  evidenceModeFacets(value).includes("real-chrome");

export const evidenceModeIncludesRealProvider = (value: string): boolean =>
  evidenceModeFacets(value).includes("real-provider");

export const evidenceFacetIsDeferredDynamic = (
  facet: ClauseEvidenceFacet,
): boolean => facet === "real-chrome" || facet === "real-provider";

export const evidenceModeRequiresOwnerReceipt = (value: string): boolean =>
  evidenceModeFacets(value).some((facet) => !evidenceFacetIsDeferredDynamic(facet));

export const lawClauseSchema = z
  .object({
    clauseId: z.string().min(1).refine((value) => value !== "primary", "Clause id must be semantic and cannot be primary."),
    statement: z.string().min(1),
    evidenceMode: clauseEvidenceModeSchema,
    ownerDomain: z.string().min(1),
  })
  .strict();

const lawPathPairSchema = z.object({
  consumerFilePath: z.string().min(1),
  targetFilePath: z.string().min(1),
}).strict();

const lawRegistryConsumerSchema = z.object({
  consumerFilePath: z.string().min(1),
  registryFilePath: z.string().min(1),
  registryExportName: z.string().min(1),
}).strict();

const codePurityLivenessSchema = z.object({
  auditInspectionFiles: z.array(z.string().min(1)).optional(),
  externalEntryExports: z.array(z.object({
    exportName: z.string().min(1),
    filePath: z.string().min(1),
  }).strict()).optional(),
  externalEntryFiles: z.array(z.string().min(1)).optional(),
  lawfulDynamicImports: z.array(lawPathPairSchema).optional(),
  lawfulDynamicNamespaceConsumers: z.array(lawPathPairSchema).optional(),
  lawfulDynamicRegistryConsumers: z.array(lawRegistryConsumerSchema).optional(),
  lawfulSideEffectImports: z.array(lawPathPairSchema).optional(),
}).strict();

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
    codePurityLiveness: codePurityLivenessSchema.optional(),
  })
  .passthrough();

const inspectExtensionMetadata = (
  value: unknown,
  path: Array<string | number>,
  addIssue: (path: Array<string | number>, message: string) => void,
): void => {
  if (typeof value === "string") {
    const normalized = value.split("\\").join("/");
    if (normalized.includes("/inspector.ts") || normalized === "inspector.ts") {
      addIssue(path, `Law metadata must not hard-bind inspector path ${value}.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectExtensionMetadata(item, [...path, index], addIssue));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = [...path, key];
    if (key.toLowerCase().includes("inspector")) {
      addIssue(nestedPath, `Law metadata must not hard-bind inspector field ${key}.`);
    }
    inspectExtensionMetadata(nestedValue, nestedPath, addIssue);
  }
};

export const lawMetadataSchema = lawMetadataBaseSchema.superRefine((law, context) => {
  const clauseIds = new Set<string>();
  for (const [index, clause] of law.clauses.entries()) {
    if (clause.ownerDomain !== law.capabilityDomain) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Clause ${clause.clauseId} ownerDomain must equal law capabilityDomain ${law.capabilityDomain}.`,
        path: ["clauses", index, "ownerDomain"],
      });
    }
    if (clauseIds.has(clause.clauseId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate clauseId ${clause.clauseId}.`,
        path: ["clauses", index, "clauseId"],
      });
    }
    clauseIds.add(clause.clauseId);
  }
  const addIssue = (path: Array<string | number>, message: string): void => {
    context.addIssue({ code: z.ZodIssueCode.custom, message, path });
  };
  const atomicEvidenceLawIds = new Set([
    "APEX-AI-INPUT-GATEWAY-002-V1",
    "APEX-DOM-021-V1",
    "APEX-LOCAL-BROWSER-004-V4",
  ]);
  if (atomicEvidenceLawIds.has(law.lawId)) {
    const topLevel = clauseEvidenceModeSchema.safeParse(law.evidenceMode);
    if (!topLevel.success || law.clauses.some((clause) => clause.evidenceMode !== law.evidenceMode)) {
      addIssue(
        ["evidenceMode"],
        "Atomic IF-AND-THEN laws must use one canonical routed evidenceMode shared by the law and every clause.",
      );
    }
  }
  for (const [key, value] of Object.entries(law)) {
    if (key.toLowerCase().includes("inspector")) {
      addIssue([key], `Law metadata must not hard-bind inspector field ${key}.`);
    }
    inspectExtensionMetadata(value, [key], addIssue);
  }
});

export type LawSource = z.infer<typeof lawMetadataBaseSchema> & {
  filePath: string;
  blockIndex: number;
};
