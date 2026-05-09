import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

export type MarkdownSection = {
  line: number;
  lines: Array<{ text: string; line: number }>;
};

export const collectRequiredSectionLineFindings = (input: {
  requirementId: string;
  file: string;
  heading: string;
  sections: Map<string, MarkdownSection>;
  expectedLine: string;
  missingMessage: string;
  driftMessage: string;
}): Finding[] => {
  const section = input.sections.get(input.heading);
  if (!section) {
    return [createFinding({ lawId: input.requirementId, file: input.file, line: 1, severity: "fatal", message: input.missingMessage })];
  }

  const sectionLines = section.lines.map((line) => line.text.trim());
  if (sectionLines.includes(`- ${input.expectedLine}`)) {
    return [];
  }

  return [createFinding({
    lawId: input.requirementId,
    file: input.file,
    line: section.line,
    severity: "fatal",
    message: input.driftMessage,
  })];
};

export const parseMarkdownSections = (content: string): Map<string, MarkdownSection> => {
  const sections = new Map<string, MarkdownSection>();
  let currentHeading: string | null = null;

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const headingMatch = /^(##|###)\s+(.*)$/.exec(rawLine);
    if (headingMatch) {
      const heading = headingMatch[2]?.trim();
      if (!heading) {
        continue;
      }
      currentHeading = heading;
      sections.set(currentHeading, { line: lineNumber, lines: [] });
      continue;
    }

    if (!currentHeading) {
      continue;
    }

    sections.get(currentHeading)?.lines.push({ text: rawLine, line: lineNumber });
  }

  return sections;
};

const collectSectionListItems = (section: MarkdownSection): Array<{ value: string; line: number }> => {
  return section.lines
    .map((line) => ({ text: line.text.trim(), line: line.line }))
    .flatMap((line) => {
      if (line.text.startsWith("- ")) {
        return [{ value: line.text.slice(2).trim(), line: line.line }];
      }
      const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(line.text);
      return numberedMatch ? [{ value: numberedMatch[2]!.trim(), line: line.line }] : [];
    });
};

export const collectListDiffDetails = (actual: readonly string[], expected: readonly string[]): string[] => {
  const details: string[] = [];
  const missing = expected.filter((item) => !actual.includes(item));
  const unexpected = actual.filter((item) => !expected.includes(item));
  if (missing.length > 0) {
    details.push(`missing: ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    details.push(`unexpected: ${unexpected.join(", ")}`);
  }
  if (actual.length !== expected.length) {
    details.push(`count=${actual.length}, expected=${expected.length}`);
  }
  return details;
};

export const collectExactListFindings = (input: {
  requirementId: string;
  file: string;
  heading: string;
  sections: Map<string, MarkdownSection>;
  expected: readonly string[];
  missingMessage: string;
  driftMessage: string;
}): Finding[] => {
  const section = input.sections.get(input.heading);
  if (!section) {
    return [createFinding({ lawId: input.requirementId, file: input.file, line: 1, severity: "fatal", message: input.missingMessage })];
  }

  const actual = collectSectionListItems(section).map((item) => item.value);
  const details = collectListDiffDetails(actual, input.expected);
  return details.length === 0
    ? []
    : [createFinding({
        lawId: input.requirementId,
        file: input.file,
        line: section.line,
        severity: "fatal",
        message: `${input.driftMessage} Details: ${details.join("; ")}`,
      })];
};