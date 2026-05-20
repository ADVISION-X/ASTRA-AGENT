import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { pathFromRepoRoot, toRepoRelativePath } from "./paths.js";
import type { LawRecord } from "./schema.js";

type LawRegistryViolation = {
  file: string;
  lawId?: string;
  message: string;
};

type MutableLawRecord = {
  lawId: string | undefined;
  status: string | undefined;
  tier: string | undefined;
  capabilityDomain: string | undefined;
  enforcementMode: string | undefined;
  evidenceMode: string | undefined;
  summary: string | undefined;
  lawFile?: string;
  sourceKind: LawRecord["sourceKind"];
};

type NormalizedLawFields = {
  lawId: string | undefined;
  status: string | undefined;
  tier: string | undefined;
  capabilityDomain: string | undefined;
  enforcementMode: string | undefined;
  evidenceMode: string;
  summary: string;
  sourceKind: LawRecord["sourceKind"];
};

const FILE_DOMAIN_DEFAULTS: Record<string, string> = {
  "module-code-purity.instructions.md": "code-purity",
  "module-RuntimeLogSpine.instructions.md": "runtime-logging",
};

const DEFAULT_EVIDENCE_MODE = "law+real-code-inspection";

const normalizeValue = (value: string | undefined): string | undefined =>
  value?.trim().replace(/^"|"$/g, "");

const toLawFilePath = (absolutePath: string): string => toRepoRelativePath(absolutePath);

const summaryFromHeading = (headingSummary: string | undefined, lawId: string): string =>
  headingSummary?.trim() || `${lawId} summary`;

const normalizeLawFields = (
  filePath: string,
  raw: MutableLawRecord,
): NormalizedLawFields => {
  const fileName = basename(filePath);
  const lawId = normalizeValue(raw.lawId);
  const status = normalizeValue(raw.status);
  return {
    lawId,
    status,
    tier: normalizeValue(raw.tier),
    capabilityDomain: normalizeValue(raw.capabilityDomain) ?? FILE_DOMAIN_DEFAULTS[fileName],
    enforcementMode: normalizeValue(raw.enforcementMode),
    evidenceMode: normalizeValue(raw.evidenceMode) ?? DEFAULT_EVIDENCE_MODE,
    summary: normalizeValue(raw.summary) ?? summaryFromHeading(raw.summary, lawId ?? "UNKNOWN-LAW"),
    sourceKind: raw.sourceKind,
  };
};

const pushLawRegistryViolation = (
  violations: LawRegistryViolation[],
  filePath: string,
  lawId: string | undefined,
  message: string,
): void => {
  violations.push({
    file: toLawFilePath(filePath),
    ...(lawId ? { lawId } : {}),
    message,
  });
};

const validateActiveLawFields = (
  filePath: string,
  fields: NormalizedLawFields,
  violations: LawRegistryViolation[],
): boolean => {
  let valid = true;
  if (!fields.lawId) {
    pushLawRegistryViolation(violations, filePath, undefined, "active law is missing lawId");
    valid = false;
  }
  if (!fields.capabilityDomain) {
    pushLawRegistryViolation(violations, filePath, fields.lawId, "active law is missing capabilityDomain");
    valid = false;
  }
  if (!fields.tier) {
    pushLawRegistryViolation(violations, filePath, fields.lawId, "active law is missing tier");
    valid = false;
  }
  if (!fields.enforcementMode) {
    pushLawRegistryViolation(violations, filePath, fields.lawId, "active law is missing enforcementMode");
    valid = false;
  }
  return valid;
};

const buildNormalizedLawRecord = (
  filePath: string,
  fields: NormalizedLawFields,
): LawRecord => {
  return {
    lawId: fields.lawId ?? "UNKNOWN-LAW",
    status: "active",
    tier: fields.tier ?? "UNKNOWN-TIER",
    capabilityDomain: fields.capabilityDomain ?? "unknown",
    enforcementMode: fields.enforcementMode ?? "unknown",
    evidenceMode: fields.evidenceMode,
    summary: fields.summary,
    lawFile: toLawFilePath(filePath),
    sourceKind: fields.sourceKind,
  };
};

const buildLawRecord = (
  filePath: string,
  raw: MutableLawRecord,
  violations: LawRegistryViolation[],
): LawRecord | undefined => {
  const fields = normalizeLawFields(filePath, raw);
  if (fields.status !== "active") return undefined;
  if (!validateActiveLawFields(filePath, fields, violations)) return undefined;
  return buildNormalizedLawRecord(filePath, fields);
};

const parseMetadataField = (block: string, fieldName: string): string | undefined =>
  normalizeValue(block.match(new RegExp(`^${fieldName}:\\s*([^\\n]+)`, "m"))?.[1]);

const parseMarkdownLawBlocks = (filePath: string, text: string): MutableLawRecord[] => {
  const records: MutableLawRecord[] = [];
  const matches = [...text.matchAll(/^## Law\s+([^\n]+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (!match || match.index === undefined || !match[1]) continue;
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    records.push({
      lawId: match[1].trim(),
      status: parseMetadataField(block, "status"),
      tier: parseMetadataField(block, "tier"),
      capabilityDomain: parseMetadataField(block, "capabilityDomain"),
      enforcementMode: parseMetadataField(block, "enforcementMode"),
      evidenceMode: parseMetadataField(block, "evidenceMode"),
      summary: parseMetadataField(block, "summary"),
      sourceKind: "markdown",
      lawFile: filePath,
    });
  }
  return records;
};

const parseFinalLawBlocks = (filePath: string, text: string): MutableLawRecord[] => {
  const records: MutableLawRecord[] = [];
  const matches = [...text.matchAll(/^###\s+([A-Z0-9-]+):\s*(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (!match || match.index === undefined || !match[1]) continue;
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    records.push({
      lawId: match[1].trim(),
      status: parseMetadataField(block, "status"),
      tier: parseMetadataField(block, "tier"),
      capabilityDomain: parseMetadataField(block, "capabilityDomain"),
      enforcementMode: parseMetadataField(block, "enforcementMode"),
      evidenceMode: parseMetadataField(block, "evidenceMode"),
      summary: parseMetadataField(block, "summary") ?? match[2]?.trim(),
      sourceKind: "final-law",
      lawFile: filePath,
    });
  }
  return records;
};

const parseApexLawBlocks = (filePath: string, text: string): MutableLawRecord[] => {
  const records: MutableLawRecord[] = [];
  const matches = [...text.matchAll(/```apex-law\s*([\s\S]*?)```/g)];
  for (const match of matches) {
    const payload = match[1];
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload) as Partial<Record<keyof MutableLawRecord, string>>;
      records.push({
        lawId: parsed.lawId,
        status: parsed.status,
        tier: parsed.tier,
        capabilityDomain: parsed.capabilityDomain,
        enforcementMode: parsed.enforcementMode,
        evidenceMode: parsed.evidenceMode,
        summary: parsed.summary,
        sourceKind: "apex-law",
        lawFile: filePath,
      });
    } catch {
      // ignore malformed draft blocks; the active law census will fail only on active blocks
    }
  }
  return records;
};

const collectLawRecords = (filePath: string): MutableLawRecord[] => {
  const text = readFileSync(filePath, "utf8");
  return [
    ...parseMarkdownLawBlocks(filePath, text),
    ...parseFinalLawBlocks(filePath, text),
    ...parseApexLawBlocks(filePath, text),
  ];
};

const walkInstructionFiles = (dirPath: string, acc: string[] = []): string[] => {
  if (!existsSync(dirPath)) return acc;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkInstructionFiles(nextPath, acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".instructions.md")) {
      acc.push(nextPath);
    }
  }
  return acc;
};

const collectNormalizedLaws = (files: string[], violations: LawRegistryViolation[]): LawRecord[] => {
  const laws: LawRecord[] = [];
  for (const filePath of files) {
    for (const record of collectLawRecords(filePath)) {
      const normalized = buildLawRecord(filePath, record, violations);
      if (normalized) {
        laws.push(normalized);
      }
    }
  }
  return laws;
};

const collectLawOwnershipViolations = (laws: LawRecord[], violations: LawRegistryViolation[]): void => {
  const lawOwnership = new Map<string, string>();
  for (const law of laws) {
    const current = lawOwnership.get(law.lawId);
    if (current && current !== law.capabilityDomain) {
      violations.push({
        file: law.lawFile,
        lawId: law.lawId,
        message: `lawId is assigned to multiple capability domains: ${current} and ${law.capabilityDomain}`,
      });
      continue;
    }
    lawOwnership.set(law.lawId, law.capabilityDomain);
  }
};

export const loadActiveLawRegistry = (): {
  laws: LawRecord[];
  violations: LawRegistryViolation[];
  filesScanned: number;
  scannedFiles: string[];
} => {
  const files = walkInstructionFiles(pathFromRepoRoot(".github/instructions"))
    .sort((left, right) => left.localeCompare(right));
  const violations: LawRegistryViolation[] = [];
  const laws = collectNormalizedLaws(files, violations);
  collectLawOwnershipViolations(laws, violations);
  return {
    laws,
    violations,
    filesScanned: files.length,
    scannedFiles: files.map((filePath) => toLawFilePath(filePath)),
  };
};
