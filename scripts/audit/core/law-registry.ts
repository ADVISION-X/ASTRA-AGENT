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

const buildLawRecord = (
  filePath: string,
  raw: MutableLawRecord,
  violations: LawRegistryViolation[],
): LawRecord | undefined => {
  const fileName = basename(filePath);
  const lawId = normalizeValue(raw.lawId);
  const status = normalizeValue(raw.status);
  if (status !== "active") return undefined;
  const capabilityDomain = normalizeValue(raw.capabilityDomain) ?? FILE_DOMAIN_DEFAULTS[fileName];
  const tier = normalizeValue(raw.tier);
  const enforcementMode = normalizeValue(raw.enforcementMode);
  const evidenceMode = normalizeValue(raw.evidenceMode) ?? DEFAULT_EVIDENCE_MODE;
  const summary = normalizeValue(raw.summary) ?? summaryFromHeading(raw.summary, lawId ?? "UNKNOWN-LAW");

  if (!lawId) {
    violations.push({ file: toLawFilePath(filePath), message: "active law is missing lawId" });
    return undefined;
  }
  if (!capabilityDomain) {
    violations.push({ file: toLawFilePath(filePath), lawId, message: "active law is missing capabilityDomain" });
    return undefined;
  }
  if (!tier) {
    violations.push({ file: toLawFilePath(filePath), lawId, message: "active law is missing tier" });
    return undefined;
  }
  if (!enforcementMode) {
    violations.push({ file: toLawFilePath(filePath), lawId, message: "active law is missing enforcementMode" });
    return undefined;
  }

  return {
    lawId,
    status,
    tier,
    capabilityDomain,
    enforcementMode,
    evidenceMode,
    summary,
    lawFile: toLawFilePath(filePath),
    sourceKind: raw.sourceKind,
  };
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

export const loadActiveLawRegistry = (): {
  laws: LawRecord[];
  violations: LawRegistryViolation[];
  filesScanned: number;
  scannedFiles: string[];
} => {
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

  const files = walkInstructionFiles(pathFromRepoRoot(".github/instructions"))
    .sort((left, right) => left.localeCompare(right));
  const laws: LawRecord[] = [];
  const violations: LawRegistryViolation[] = [];

  for (const filePath of files) {
    for (const record of collectLawRecords(filePath)) {
      const normalized = buildLawRecord(filePath, record, violations);
      if (normalized) {
        laws.push(normalized);
      }
    }
  }

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
  return {
    laws,
    violations,
    filesScanned: files.length,
    scannedFiles: files.map((filePath) => toLawFilePath(filePath)),
  };
};