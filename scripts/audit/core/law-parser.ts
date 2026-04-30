import path from "node:path";

import { listImmediateFiles, readTextFile } from "./filesystem.js";
import { moduleLawHome } from "./path-roots.js";
import { toRepoRelativePath } from "./paths.js";
import type { AuditConflict, LawRecord } from "./schema.js";

const LAW_HEADER_PATTERN = /^## Law (GRASSEYE-[A-Z0-9-]+)$/gm;
const REQUIRED_FIELDS = [
  "status",
  "tier",
  "capabilityDomain",
  "enforcementMode",
  "evidenceMode",
  "summary",
] as const;

const extractField = (block: string, fieldName: (typeof REQUIRED_FIELDS)[number]): string | undefined => {
  const match = block.match(new RegExp(`^${fieldName}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim();
};

const listModuleLawFiles = async (): Promise<string[]> =>
  (await listImmediateFiles(moduleLawHome))
    .filter((filePath) => filePath.endsWith(".instructions.md"))
    .sort();

const createMissingHeaderConflict = (filePath: string): AuditConflict => ({
  kind: "LAW_PARSE",
  message: "No law headers found in module law file.",
  file: toRepoRelativePath(filePath),
});

const createMissingLawIdConflict = (filePath: string): AuditConflict => ({
  kind: "LAW_PARSE",
  message: "Law header is missing a concrete lawId.",
  file: toRepoRelativePath(filePath),
});

const collectLawMetadata = (block: string) => ({
  status: extractField(block, "status"),
  tier: extractField(block, "tier"),
  capabilityDomain: extractField(block, "capabilityDomain"),
  enforcementMode: extractField(block, "enforcementMode"),
  evidenceMode: extractField(block, "evidenceMode"),
  summary: extractField(block, "summary"),
});

const appendMetadataConflict = (
  conflicts: AuditConflict[],
  filePath: string,
  lawId: string,
  metadata: ReturnType<typeof collectLawMetadata>,
): void => {
  const missingFields = REQUIRED_FIELDS.filter((fieldName) => !metadata[fieldName]);
  if (missingFields.length === 0) {
    return;
  }

  conflicts.push({
    kind: "LAW_PARSE",
    message: `Active law metadata is incomplete: ${missingFields.join(", ")}.`,
    file: toRepoRelativePath(filePath),
    lawId,
  });
};

const appendDuplicateLawConflict = (
  conflicts: AuditConflict[],
  seenLawIds: Map<string, string>,
  filePath: string,
  lawId: string,
): void => {
  if (seenLawIds.has(lawId)) {
    conflicts.push({
      kind: "LAW_REGISTRY",
      message: "Duplicate active lawId detected.",
      file: toRepoRelativePath(filePath),
      lawId,
      detail: `Already declared in ${seenLawIds.get(lawId)}.`,
    });
    return;
  }

  seenLawIds.set(lawId, toRepoRelativePath(filePath));
};

const parseLawMatch = (input: {
  filePath: string;
  content: string;
  matches: RegExpMatchArray[];
  index: number;
  match: RegExpMatchArray;
  conflicts: AuditConflict[];
  seenLawIds: Map<string, string>;
}): LawRecord | null => {
  const lawId = input.match[1];
  if (!lawId) {
    input.conflicts.push(createMissingLawIdConflict(input.filePath));
    return null;
  }

  const blockStart = input.match.index ?? 0;
  const blockEnd = input.matches[input.index + 1]?.index ?? input.content.length;
  const block = input.content.slice(blockStart, blockEnd);
  const line = input.content.slice(0, blockStart).split("\n").length;
  const metadata = collectLawMetadata(block);

  appendMetadataConflict(input.conflicts, input.filePath, lawId, metadata);
  if (metadata.status !== "active") {
    return null;
  }

  appendDuplicateLawConflict(input.conflicts, input.seenLawIds, input.filePath, lawId);

  return {
    lawId,
    status: metadata.status ?? "",
    tier: metadata.tier ?? "",
    capabilityDomain: metadata.capabilityDomain ?? "",
    enforcementMode: metadata.enforcementMode ?? "",
    evidenceMode: metadata.evidenceMode ?? "",
    summary: metadata.summary ?? "",
    relativeFilePath: toRepoRelativePath(path.resolve(input.filePath)),
    line,
  };
};

const parseLawFile = async (input: {
  filePath: string;
  conflicts: AuditConflict[];
  seenLawIds: Map<string, string>;
}): Promise<LawRecord[]> => {
  const content = await readTextFile(input.filePath);
  const matches = Array.from(content.matchAll(LAW_HEADER_PATTERN));
  if (matches.length === 0) {
    input.conflicts.push(createMissingHeaderConflict(input.filePath));
    return [];
  }

  return matches
    .map((match, index) => parseLawMatch({ ...input, content, matches, index, match }))
    .filter((law): law is LawRecord => law !== null);
};

export const parseModuleLaws = async (): Promise<{
  laws: LawRecord[];
  moduleLawFiles: string[];
  conflicts: AuditConflict[];
}> => {
  const lawFiles = await listModuleLawFiles();
  const laws: LawRecord[] = [];
  const conflicts: AuditConflict[] = [];
  const seenLawIds = new Map<string, string>();

  for (const filePath of lawFiles) {
    laws.push(...await parseLawFile({ filePath, conflicts, seenLawIds }));
  }

  return {
    laws,
    moduleLawFiles: lawFiles.map((filePath) => toRepoRelativePath(filePath)),
    conflicts,
  };
};