import { readFileSync } from "node:fs";

import type { AuditConflict } from "../shared/generated-contracts.js";
import { lawMetadataSchema, type LawSource } from "../shared/law-contracts.js";
import { splitLines } from "../shared/no-regex.js";
import { toRepoPath } from "../shared/paths.js";

const buildParseConflict = (filePath: string, message: string): AuditConflict => ({
  kind: "law-parse-error",
  filePath,
  message,
});

const extractApexLawBlocks = (text: string): string[] => {
  const blocks: string[] = [];
  let currentBlock: string[] | null = null;
  for (const line of splitLines(text)) {
    const trimmed = line.trim();
    if (currentBlock === null) {
      if (trimmed === "```apex-law") {
        currentBlock = [];
      }
      continue;
    }
    if (trimmed.startsWith("```")) {
      blocks.push(currentBlock.join("\n"));
      currentBlock = null;
      continue;
    }
    currentBlock.push(line);
  }
  return blocks;
};

export const parseApexLaws = (
  absolutePaths: readonly string[],
): { laws: LawSource[]; conflicts: AuditConflict[] } => {
  const laws: LawSource[] = [];
  const conflicts: AuditConflict[] = [];
  for (const absolutePath of absolutePaths) {
    const filePath = toRepoPath(absolutePath);
    const text = readFileSync(absolutePath, "utf8");
    const matches = extractApexLawBlocks(text);
    matches.forEach((match, index) => {
      try {
        const metadata = JSON.parse(match.trim());
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
