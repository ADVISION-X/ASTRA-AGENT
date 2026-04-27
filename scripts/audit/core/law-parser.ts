import path from "node:path";

import { listImmediateFiles, readTextFile } from "./filesystem.js";
import { moduleLawHome, toRepoRelativePath } from "./paths.js";
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

export const parseModuleLaws = async (): Promise<{
  laws: LawRecord[];
  moduleLawFiles: string[];
  conflicts: AuditConflict[];
}> => {
  const lawFiles = (await listImmediateFiles(moduleLawHome))
    .filter((filePath) => filePath.endsWith(".instructions.md"))
    .sort();

  const laws: LawRecord[] = [];
  const conflicts: AuditConflict[] = [];
  const seenLawIds = new Map<string, string>();

  for (const filePath of lawFiles) {
    const content = await readTextFile(filePath);
    const matches = Array.from(content.matchAll(LAW_HEADER_PATTERN));

    if (matches.length === 0) {
      conflicts.push({
        kind: "LAW_PARSE",
        message: "No law headers found in module law file.",
        file: toRepoRelativePath(filePath),
      });
      continue;
    }

    for (const [index, match] of matches.entries()) {
      const lawId = match[1];
      if (!lawId) {
        conflicts.push({
          kind: "LAW_PARSE",
          message: "Law header is missing a concrete lawId.",
          file: toRepoRelativePath(filePath),
        });
        continue;
      }

      const blockStart = match.index ?? 0;
      const blockEnd = matches[index + 1]?.index ?? content.length;
      const block = content.slice(blockStart, blockEnd);
      const line = content.slice(0, blockStart).split("\n").length;

      const metadata = {
        status: extractField(block, "status"),
        tier: extractField(block, "tier"),
        capabilityDomain: extractField(block, "capabilityDomain"),
        enforcementMode: extractField(block, "enforcementMode"),
        evidenceMode: extractField(block, "evidenceMode"),
        summary: extractField(block, "summary"),
      };

      const missingFields = REQUIRED_FIELDS.filter((fieldName) => !metadata[fieldName]);
      if (missingFields.length > 0) {
        conflicts.push({
          kind: "LAW_PARSE",
          message: `Active law metadata is incomplete: ${missingFields.join(", ")}.`,
          file: toRepoRelativePath(filePath),
          lawId,
        });
      }

      if (metadata.status !== "active") {
        continue;
      }

      if (seenLawIds.has(lawId)) {
        conflicts.push({
          kind: "LAW_REGISTRY",
          message: "Duplicate active lawId detected.",
          file: toRepoRelativePath(filePath),
          lawId,
          detail: `Already declared in ${seenLawIds.get(lawId)}.`,
        });
      } else {
        seenLawIds.set(lawId, toRepoRelativePath(filePath));
      }

      laws.push({
        lawId,
        status: metadata.status ?? "",
        tier: metadata.tier ?? "",
        capabilityDomain: metadata.capabilityDomain ?? "",
        enforcementMode: metadata.enforcementMode ?? "",
        evidenceMode: metadata.evidenceMode ?? "",
        summary: metadata.summary ?? "",
        relativeFilePath: toRepoRelativePath(path.resolve(filePath)),
        line,
      });
    }
  }

  return {
    laws,
    moduleLawFiles: lawFiles.map((filePath) => toRepoRelativePath(filePath)),
    conflicts,
  };
};