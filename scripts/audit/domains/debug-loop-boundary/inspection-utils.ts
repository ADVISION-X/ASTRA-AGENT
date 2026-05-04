import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

export type TextRule = { lawId: string; message: string; pattern: RegExp };

const matchLine = (content: string, matchIndex: number): number => content.slice(0, matchIndex).split("\n").length;

export const buildFinding = (input: {
  lawId: string;
  file: string;
  line: number;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: input.lawId,
  file: input.file,
  line: input.line,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

export const extractBlock = (content: string, marker: string): string => {
  const start = content.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const next = content.indexOf("\nfunction ", start + marker.length);
  return next === -1 ? content.slice(start) : content.slice(start, next);
};

export const extractSection = (content: string, heading: string): string => {
  const start = content.indexOf(heading);
  if (start === -1) {
    return "";
  }

  const next = content.indexOf("\n## ", start + heading.length);
  return next === -1 ? content.slice(start) : content.slice(start, next);
};

export const extractArrayBlock = (content: string, marker: string, terminator: string): string => {
  const start = content.indexOf(marker);
  if (start === -1) {
    return "";
  }

  const end = content.indexOf(terminator, start + marker.length);
  return end === -1 ? content.slice(start) : content.slice(start, end + terminator.length);
};

export const collectRuleFindings = (input: {
  file: string;
  content: string;
  rules: TextRule[];
}): Finding[] => input.rules.flatMap((rule) => {
  const match = rule.pattern.exec(input.content);
  return match && typeof match.index === "number"
    ? [buildFinding({ lawId: rule.lawId, file: input.file, line: matchLine(input.content, match.index), message: rule.message })]
    : [];
});

export const requirePattern = (input: {
  lawId: string;
  file: string;
  content: string;
  pattern: RegExp;
  message: string;
}): Finding[] => input.pattern.test(input.content)
  ? []
  : [buildFinding({ lawId: input.lawId, file: input.file, line: 1, message: input.message })];

export const createCheckPhase = (input: {
  name: string;
  findings: Finding[];
  pass: string;
  fail: string;
  classification?: InspectorPhase["classification"];
}): InspectorPhase => createPhase(
  input.name,
  input.findings.length === 0 ? "PASS" : (input.classification ?? "CODE VIOLATION"),
  input.findings.length === 0,
  input.findings.length === 0 ? input.pass : input.fail,
);