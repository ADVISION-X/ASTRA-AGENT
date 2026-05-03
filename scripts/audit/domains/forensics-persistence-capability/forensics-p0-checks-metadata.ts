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

function buildSchemaTextChecks(project: Project) {
  const aiText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/write-ai-result-record/schema.ts`).getFullText();
  const actionText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/write-structured-action-log/schema.ts`).getFullText();
  const browseText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-browse-ledger/schema.ts`).getFullText();
  const evidencePacketText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-evidence-packet/schema.ts`).getFullText();
  const failedRecordText = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-failed-record/schema.ts`).getFullText();

  return [
    {
      file: `${CHILDREN_ROOT}/write-ai-result-record/schema.ts`,
      text: aiText,
      snippets: ["promptContractId: z.string().min(1)", "promptContractVersion: z.string().min(1)", "promptCatalogVersion: z.string().min(1)"],
      message: "AI result record schema must require prompt contract refs.",
    },
    {
      file: `${CHILDREN_ROOT}/write-structured-action-log/schema.ts`,
      text: actionText,
      snippets: ["actionRef: z.string().min(1)", "postActionVerificationRef: z.string().min(1)"],
      message: "Action log schema must require actionRef and postActionVerificationRef.",
    },
    {
      file: `${CHILDREN_ROOT}/finalize-browse-ledger/schema.ts`,
      text: browseText,
      snippets: ["decisionRef: z.string().min(1)"],
      message: "Browse-ledger finalization schema must require decisionRef.",
    },
    {
      file: `${CHILDREN_ROOT}/finalize-evidence-packet/schema.ts`,
      text: evidencePacketText,
      snippets: ["decisionRef: z.string().min(1)"],
      message: "Evidence-packet finalization schema must require decisionRef.",
    },
    {
      file: `${CHILDREN_ROOT}/finalize-failed-record/schema.ts`,
      text: failedRecordText,
      snippets: ["decisionRef: z.string().min(1)"],
      message: "Failed-record finalization schema must require decisionRef.",
    },
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