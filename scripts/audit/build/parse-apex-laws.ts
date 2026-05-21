import { readFileSync } from "node:fs";

import type { AuditConflict } from "../shared/generated-contracts.js";
import { lawMetadataSchema, type LawSource } from "../shared/law-contracts.js";
import { toRepoPath } from "../shared/paths.js";

const apexLawBlockPattern = /^```apex-law\s*$\n([\s\S]*?)^```+\s*$/gmu;

const buildParseConflict = (filePath: string, message: string): AuditConflict => ({
  kind: "law-parse-error",
  filePath,
  message,
});

export const parseApexLaws = (
  absolutePaths: readonly string[],
): { laws: LawSource[]; conflicts: AuditConflict[] } => {
  const laws: LawSource[] = [];
  const conflicts: AuditConflict[] = [];
  for (const absolutePath of absolutePaths) {
    const filePath = toRepoPath(absolutePath);
    const text = readFileSync(absolutePath, "utf8");
    const matches = [...text.matchAll(apexLawBlockPattern)];
    matches.forEach((match, index) => {
      try {
        const metadata = JSON.parse(match[1]?.trim() ?? "");
        const parsed = lawMetadataSchema.safeParse(metadata);
        if (!parsed.success) {
          conflicts.push(buildParseConflict(filePath, parsed.error.message));
          return;
        }
        laws.push({
          ...parsed.data,
          filePath,
          blockIndex: index,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown apex-law parse error.";
        conflicts.push(buildParseConflict(filePath, message));
      }
    });
  }
  return { laws, conflicts };
};