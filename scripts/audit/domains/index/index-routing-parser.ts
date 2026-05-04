import type { ModuleTarget, ParsedIndexLawDocument } from "./index-routing-constants.js";

const stripQuotedValue = (value: string): string => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const isMarkdownSeparatorRow = (cells: string[]): boolean =>
  cells.every((cell) => /^-+$/.test(cell.replace(/ /g, "")));

const parseModuleTargetRow = (rawLine: string, lineNumber: number): ModuleTarget | null => {
  if (!rawLine.startsWith("|")) {
    return null;
  }

  const cells = rawLine.split("|").map((cell) => cell.trim()).filter(Boolean);
  if (cells.length !== 3 || cells[0] === "Path or trigger" || isMarkdownSeparatorRow(cells)) {
    return null;
  }

  const [triggerText = "", moduleFile = "", noteText = ""] = cells;
  return triggerText && moduleFile && noteText
    ? { triggerText, moduleFile, noteText, lineNumber }
    : null;
};

const parseFrontmatter = (lines: string[]): { frontmatter: Record<string, string>; bodyStartIndex: number } | null => {
  if (lines[0]?.trim() !== "---") {
    return null;
  }

  const frontmatter: Record<string, string> = {};
  let cursor = 1;
  for (; cursor < lines.length; cursor += 1) {
    const rawLine = lines[cursor] ?? "";
    if (rawLine.trim() === "---") {
      return { frontmatter, bodyStartIndex: cursor + 1 };
    }

    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    if (!key) {
      return null;
    }

    frontmatter[key] = stripQuotedValue(rawLine.slice(separatorIndex + 1));
  }

  return null;
};

export const extractSectionLines = (lines: string[], heading: string): string[] => {
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) {
      break;
    }
    sectionLines.push(line.trim());
  }

  return sectionLines;
};

export const parseActiveModuleTargets = (lines: string[]): ModuleTarget[] => {
  const headingIndex = lines.findIndex((line) => line.trim() === "## Active Module Routes");
  if (headingIndex === -1) {
    return [];
  }

  const moduleTargets: ModuleTarget[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index]?.trim() ?? "";
    if (!rawLine && moduleTargets.length > 0) {
      break;
    }

    const row = parseModuleTargetRow(rawLine, index + 1);
    if (row) {
      moduleTargets.push(row);
    }
  }

  return moduleTargets;
};

export const parseIndexLawDocument = (content: string): ParsedIndexLawDocument | null => {
  const lines = content.split("\n");
  const frontmatterState = parseFrontmatter(lines);
  if (!frontmatterState) {
    return null;
  }

  const bodyLines = lines.slice(frontmatterState.bodyStartIndex);
  const roleIndex = bodyLines.findIndex((line) => line.startsWith("Role:"));
  const authorityIndex = bodyLines.findIndex((line) => line.startsWith("Authority:"));

  return {
    lines,
    frontmatter: frontmatterState.frontmatter,
    bodyLines,
    roleLineNumber: roleIndex === -1 ? 1 : frontmatterState.bodyStartIndex + roleIndex + 1,
    roleLine: roleIndex === -1 ? null : (bodyLines[roleIndex] ?? "").trim(),
    authorityLineNumber: authorityIndex === -1 ? 1 : frontmatterState.bodyStartIndex + authorityIndex + 1,
    authorityLine: authorityIndex === -1 ? null : (bodyLines[authorityIndex] ?? "").trim(),
    moduleTargets: parseActiveModuleTargets(lines),
  };
};