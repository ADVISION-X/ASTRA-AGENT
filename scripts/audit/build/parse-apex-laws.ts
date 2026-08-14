import { readFileSync } from "node:fs";

import type { AuditConflict } from "../shared/generated-contracts.js";
import { isLawId, lawMetadataSchema, type LawSource } from "../shared/law-contracts.js";
import { splitLines } from "../shared/no-regex.js";
import { toRepoPath } from "../shared/paths.js";

const buildParseConflict = (filePath: string, message: string): AuditConflict => ({
  kind: "law-parse-error",
  filePath,
  message,
});

type FencedBlock = Readonly<{
  body: string;
  language: string;
}>;

const lawSectionId = (trimmedLine: string): string | null => {
  if (!trimmedLine.startsWith("#")) return null;
  const tokens: string[] = [];
  let token = "";
  for (const character of trimmedLine) {
    const isCandidateCharacter = (character >= "A" && character <= "Z")
      || (character >= "0" && character <= "9")
      || character === "-";
    if (isCandidateCharacter) {
      token += character;
      continue;
    }
    if (token) tokens.push(token);
    token = "";
  }
  if (token) tokens.push(token);
  return tokens.find(isLawId) ?? null;
};

const extractLawFileStructure = (
  text: string,
): { blocks: FencedBlock[]; hasActiveStatus: boolean; lawSectionIds: Set<string>; unclosedLanguage: string | null } => {
  const blocks: FencedBlock[] = [];
  const lawSectionIds = new Set<string>();
  let hasActiveStatus = false;
  let language: string | null = null;
  let body: string[] = [];
  for (const line of splitLines(text)) {
    const trimmed = line.trim();
    if (language === null) {
      const sectionId = lawSectionId(trimmed);
      if (sectionId) lawSectionIds.add(sectionId);
      if (trimmed === "status: active" || trimmed === "status: \"active\"") hasActiveStatus = true;
      const candidateLanguage = trimmed.startsWith("```") ? trimmed.slice(3).trim() : "";
      if (!["apex-law", "json", "law"].includes(candidateLanguage)) continue;
      language = candidateLanguage;
      body = [];
      continue;
    }
    if (trimmed.startsWith("```")) {
      blocks.push({ body: body.join("\n"), language });
      language = null;
      body = [];
      continue;
    }
    body.push(line);
  }
  return { blocks, hasActiveStatus, lawSectionIds, unclosedLanguage: language };
};

const isActiveMetadataOutsideApexLaw = (block: FencedBlock): boolean => {
  if (block.language === "apex-law") return false;
  try {
    const value = JSON.parse(block.body.trim()) as { lawId?: unknown; status?: unknown };
    return typeof value.lawId === "string" && value.status === "active";
  } catch {
    return false;
  }
};

export const parseApexLaws = (
  absolutePaths: readonly string[],
): { laws: LawSource[]; conflicts: AuditConflict[] } => {
  const laws: LawSource[] = [];
  const conflicts: AuditConflict[] = [];
  for (const absolutePath of absolutePaths) {
    const filePath = toRepoPath(absolutePath);
    const text = readFileSync(absolutePath, "utf8");
    const structure = extractLawFileStructure(text);
    const apexBlocks = structure.blocks.filter((block) => block.language === "apex-law");

    if (structure.unclosedLanguage !== null) {
      conflicts.push(buildParseConflict(filePath, `Unclosed fenced block ${structure.unclosedLanguage || "<plain>"}.`));
    }
    for (const block of structure.blocks) {
      if (block.language === "law" || isActiveMetadataOutsideApexLaw(block)) {
        conflicts.push(buildParseConflict(
          filePath,
          `Active law metadata must use the unique apex-law fence; found ${block.language || "<plain>"}.`,
        ));
      }
    }
    if (apexBlocks.length === 0 && structure.hasActiveStatus) {
      conflicts.push(buildParseConflict(filePath, "Active law module contains no apex-law metadata block."));
    }

    const parsedLawIds = new Set<string>();
    apexBlocks.forEach((block, index) => {
      try {
        const metadata = JSON.parse(block.body.trim());
        const parsed = lawMetadataSchema.safeParse(metadata);
        if (!parsed.success) {
          conflicts.push(buildParseConflict(filePath, parsed.error.message));
          return;
        }
        parsedLawIds.add(parsed.data.lawId);
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

    for (const sectionId of structure.lawSectionIds) {
      if (!parsedLawIds.has(sectionId)) {
        conflicts.push(buildParseConflict(filePath, `Law section ${sectionId} has no matching apex-law metadata block.`));
      }
    }
  }
  return { laws, conflicts };
};
