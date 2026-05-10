import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding, InspectorContext } from "../../core/schema.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";

const {
  CHILDREN_ROOT,
  LAW_ARTIFACT_PROMOTION,
  LAW_CHAIN,
  LAW_ENFORCEMENT,
  PORTS_ROOT,
  SHARED_ROOT,
} = forensicsPersistenceInspectionConstants;

const PRODUCT_LEAD_SCHEMA_SNIPPETS = [
  "platformId: z.string().min(1)",
  "targetUrl: z.string().min(1)",
  "targetTitle: z.string().min(1)",
  "screenshotEvidenceRef: z.string().min(1)",
  "productPresenceAiResultRef: z.string().min(1)",
  "decision: ProductLeadDecisionSchema",
  "routeLabel: z.string().min(1)",
  "confidence: z.number().min(0).max(1)",
  "visibleProductTypes: z.array(z.string().min(1)).default([])",
  "reason: z.string().min(1)",
  "capturedAt: z.string().datetime()",
  "createdAt: z.string().datetime()",
  "runId: z.string().min(1)",
  "missionId: z.string().min(1)",
] as const;

const buildCoreSchemaTextChecks = (input: {
  aiText: string;
  actionText: string;
  browseText: string;
  evidencePacketText: string;
  failedRecordText: string;
}) => [
  {
    file: `${CHILDREN_ROOT}/write-ai-result-record/schema.ts`,
    text: input.aiText,
    snippets: ["promptContractId: z.string().min(1)", "promptContractVersion: z.string().min(1)", "promptCatalogVersion: z.string().min(1)"],
    message: "AI result record schema must require prompt contract refs.",
  },
  {
    file: `${CHILDREN_ROOT}/write-structured-action-log/schema.ts`,
    text: input.actionText,
    snippets: ["actionRef: z.string().min(1)", "postActionVerificationRef: z.string().min(1)"],
    message: "Action log schema must require actionRef and postActionVerificationRef.",
  },
  {
    file: `${CHILDREN_ROOT}/finalize-browse-ledger/schema.ts`,
    text: input.browseText,
    snippets: ["decisionRef: z.string().min(1)"],
    message: "Browse-ledger finalization schema must require decisionRef.",
  },
  {
    file: `${CHILDREN_ROOT}/finalize-evidence-packet/schema.ts`,
    text: input.evidencePacketText,
    snippets: ["decisionRef: z.string().min(1)"],
    message: "Evidence-packet finalization schema must require decisionRef.",
  },
  {
    file: `${CHILDREN_ROOT}/finalize-failed-record/schema.ts`,
    text: input.failedRecordText,
    snippets: ["decisionRef: z.string().min(1)"],
    message: "Failed-record finalization schema must require decisionRef.",
  },
] as const;

const buildProductLeadSchemaTextCheck = (productLeadText: string) => ({
  file: `${CHILDREN_ROOT}/write-product-lead-record/schema.ts`,
  text: productLeadText,
  snippets: PRODUCT_LEAD_SCHEMA_SNIPPETS,
  message: "Product lead record schema must require the V1 screenshot/url/title/AI summary persistence fields.",
});

function buildSchemaTextChecks(project: Project) {
  const aiText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/write-ai-result-record/schema.ts`).getFullText();
  const actionText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/write-structured-action-log/schema.ts`).getFullText();
  const productLeadText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/write-product-lead-record/schema.ts`).getFullText();
  const browseText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-browse-ledger/schema.ts`).getFullText();
  const evidencePacketText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-evidence-packet/schema.ts`).getFullText();
  const failedRecordText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-failed-record/schema.ts`).getFullText();

  return [
    ...buildCoreSchemaTextChecks({ aiText, actionText, browseText, evidencePacketText, failedRecordText }),
    buildProductLeadSchemaTextCheck(productLeadText),
  ];
}

export function collectSchemaRefFindings(project: Project): Finding[] {
  return buildSchemaTextChecks(project).flatMap((check) => {
    return check.snippets.every((snippet) => check.text.includes(snippet))
      ? []
      : [createFinding({ lawId: LAW_CHAIN, file: check.file, line: 1, severity: "fatal", message: check.message })];
  });
}

export function collectArtifactPromotionFindings(project: Project): Finding[] {
  const baseSchemaText = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-base-schema.ts`).getFullText();
  const requiredSnippets = [
    "artifactLifecycleManifestRef: nullableString",
    "retentionClass: ForensicsArtifactRetentionClassSchema.nullable().default(null)",
    "promotionStatus: ForensicsArtifactPromotionStatusSchema.default(\"not_promoted\")",
    "artifactHash: nullableString",
    "byteSize: nonNegativeInt.nullable().default(null)",
    "promotedByRecordRef: ForensicsRecordRefSchema.nullable().default(null)",
    "pinnedByRecordRefs: z.array(ForensicsRecordRefSchema).default([])",
    "legalHoldReason: nullableString",
    "cleanupLedgerRef: nullableString",
    "refCount: nonNegativeInt.default(0)",
    "cleanupEligible: z.boolean().default(false)",
  ];

  return requiredSnippets.every((snippet) => baseSchemaText.includes(snippet))
    ? []
    : [createFinding({
        lawId: LAW_ARTIFACT_PROMOTION,
        file: `${SHARED_ROOT}/forensics-base-schema.ts`,
        line: 1,
        severity: "fatal",
        message: "ForensicsArtifactRef must carry lifecycle manifest, promotion, pin, cleanup-ledger, and refCount truth.",
      })];
}

export function collectLawCoverageFindings(context: InspectorContext): Finding[] {
  const domainLaws = context.lawRegistry.laws
    .filter((law) => law.capabilityDomain === "forensics-persistence-capability" && law.lawId.startsWith("GRASSEYE-FORENSICS-PERSISTENCE-"))
    .map((law) => law.lawId);
  const manifest = context.manifestsByDomain.get("forensics-persistence-capability");

  if (!manifest) {
    return [];
  }

  const missingLawIds = domainLaws.filter((lawId) => !manifest.allowedLawIds.includes(lawId));
  return missingLawIds.length > 0
    ? [createFinding({ lawId: LAW_ENFORCEMENT, file: manifest.manifestPath, line: 1, severity: "fatal", message: "Forensics manifest does not cover all active Forensics laws.", detail: missingLawIds.join(", ") })]
    : [];
}