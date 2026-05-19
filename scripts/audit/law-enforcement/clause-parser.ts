import { readFileSync } from "node:fs";

import type { LawRecord } from "../core/schema.js";
import { pathFromRepoRoot } from "../core/paths.js";

export type ClauseSource =
  | "law-summary"
  | "required"
  | "forbidden"
  | "acceptance"
  | "blueprint"
  | "manifest"
  | "generated";

export type ParsedClause = {
  readonly lawId: string;
  readonly lawFilePath: string;
  readonly clauseId: string;
  readonly clauseSource: ClauseSource;
  readonly clauseText: string;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sanitizeId = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "clause";

const normalizeText = (value: string): string =>
  value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const stripCodeFences = (text: string): string =>
  text.replace(/```[\s\S]*?```/g, "");

const extractLawBlock = (law: LawRecord): string | undefined => {
  const text = readFileSync(pathFromRepoRoot(law.lawFile), "utf8");
  const patterns = [
    {
      start: new RegExp(`^## Law\\s+${escapeRegExp(law.lawId)}\\s*$`, "m"),
      end: /^## Law\s+/m,
    },
    {
      start: new RegExp(`^## \\[${escapeRegExp(law.lawId)}\\].*$`, "m"),
      end: /^## \[[A-Z0-9-]+\]/m,
    },
    {
      start: new RegExp(`^###\\s+${escapeRegExp(law.lawId)}:.*$`, "m"),
      end: /^###\s+[A-Z0-9-]+:/m,
    },
  ];

  for (const pattern of patterns) {
    const startMatch = pattern.start.exec(text);
    if (!startMatch || startMatch.index === undefined) continue;
    const startIndex = startMatch.index;
    const remainder = text.slice(startIndex + startMatch[0].length);
    const nextMatch = pattern.end.exec(remainder);
    const endIndex = nextMatch?.index !== undefined
      ? startIndex + startMatch[0].length + nextMatch.index
      : text.length;
    return text.slice(startIndex, endIndex);
  }

  return undefined;
};

const resolveSectionSource = (line: string): ClauseSource | null => {
  const normalized = line.replace(/^#+\s*/, "").trim().toLowerCase();
  if (normalized.startsWith("required") || normalized.startsWith("必须")) return "required";
  if (normalized.startsWith("forbidden") || normalized.startsWith("禁止")) return "forbidden";
  if (normalized.includes("验收")
    || normalized.includes("acceptance")
    || normalized.includes("ready")
    || normalized.includes("closeout")
    || normalized.includes("审计与验收")) {
    return "acceptance";
  }
  if (normalized.includes("施工图") || normalized.includes("蓝图") || normalized.includes("结构")) {
    return "blueprint";
  }
  return null;
};

const collectSectionClauses = (
  lawId: string,
  lawFilePath: string,
  prefix: string,
  source: ClauseSource,
  lines: string[],
): ParsedClause[] => {
  const text = stripCodeFences(lines.join("\n"));
  const bulletItems = [...text.matchAll(/^\s*(?:[-*]|\d+\.)\s+(.+)$/gm)]
    .map((match) => normalizeText(match[1] ?? ""))
    .filter(Boolean);
  const items = bulletItems.length > 0
    ? bulletItems
    : text
      .split(/\n\s*\n/)
      .map((item) => normalizeText(item))
      .filter((item) => item.length > 0 && !item.startsWith("##") && !item.startsWith("###"));

  return items.map((clauseText, index) => ({
    lawId,
    lawFilePath,
    clauseId: `${lawId}.${prefix}.${String(index + 1).padStart(2, "0")}.${sanitizeId(clauseText)}`,
    clauseSource: source,
    clauseText,
  }));
};

export const parseLawClauses = (law: LawRecord): {
  clauses: ParsedClause[];
  parseFailure?: string;
} => {
  const block = extractLawBlock(law);
  if (!block) {
    return { clauses: [], parseFailure: "law_parse_failed" };
  }

  const clauses: ParsedClause[] = [{
    lawId: law.lawId,
    lawFilePath: law.lawFile,
    clauseId: `${law.lawId}.summary.01`,
    clauseSource: "law-summary",
    clauseText: normalizeText(law.summary),
  }];
  const lines = stripCodeFences(block).split("\n");
  let currentSource: ClauseSource | null = null;
  let currentPrefix = "summary";
  let currentLines: string[] = [];

  const flush = (): void => {
    if (!currentSource || currentLines.length === 0) return;
    clauses.push(...collectSectionClauses(law.lawId, law.lawFile, currentPrefix, currentSource, currentLines));
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const nextSource = resolveSectionSource(trimmed);
    if (nextSource) {
      flush();
      currentSource = nextSource;
      currentPrefix = nextSource;
      currentLines = [];
      continue;
    }
    if (/^#{2,6}\s+/.test(trimmed)) {
      flush();
      currentSource = null;
      currentLines = [];
      continue;
    }
    if (currentSource) {
      currentLines.push(line);
    }
  }
  flush();

  return { clauses };
};

export const parseBlueprintClauses = (
  filePath: string,
  relatedLawIds: readonly string[],
): ParsedClause[] => {
  if (relatedLawIds.length === 0) return [];
  const text = stripCodeFences(readFileSync(pathFromRepoRoot(filePath), "utf8"));
  const lines = text.split("\n");
  const sections: Array<{ source: ClauseSource; heading: string; lines: string[] }> = [];
  let current: { source: ClauseSource; heading: string; lines: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    sections.push(current);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{2,6}\s+/.test(trimmed)) {
      flush();
      current = {
        source: resolveSectionSource(trimmed) ?? "blueprint",
        heading: trimmed.replace(/^#+\s*/, ""),
        lines: [],
      };
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }
  flush();

  return relatedLawIds.flatMap((lawId) => sections.flatMap((section, index) =>
    collectSectionClauses(
      lawId,
      filePath,
      `${section.source}.${String(index + 1).padStart(2, "0")}.${sanitizeId(section.heading)}`,
      section.source,
      section.lines,
    )));
};