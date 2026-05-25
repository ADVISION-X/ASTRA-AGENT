import type { ResearchAnswer } from "./deep-research-analysis.record-contracts.js";
import type { DeepResearchFinalReport, DeepResearchSourceNote } from "./deep-research-analysis.result.js";

type SourceNoteInput = {
  note: string;
  sourceType: DeepResearchSourceNote["sourceType"];
  subQuestionId?: string | null;
};

const normalizeSourceNoteText = (value: string): string =>
  value.trim().split(/\s+/u).join(" ");

const buildSourceNoteId = (index: number): string =>
  `source-note-${String(index + 1).padStart(3, "0")}`;

const readUrl = (note: string): string | null => {
  const token = note.split(/\s+/u).find((part) =>
    part.startsWith("https://") || part.startsWith("http://"));
  return token ?? null;
};

export const buildDeepResearchSourceNotes = (
  inputs: readonly SourceNoteInput[],
): DeepResearchSourceNote[] => {
  const grouped = new Map<string, { note: string; sourceType: DeepResearchSourceNote["sourceType"]; subQuestionIds: Set<string> }>();
  for (const input of inputs) {
    const note = normalizeSourceNoteText(input.note);
    if (!note) continue;
    const key = note.toLocaleLowerCase();
    const existing = grouped.get(key) ?? {
      note,
      sourceType: input.sourceType,
      subQuestionIds: new Set<string>(),
    };
    if (input.subQuestionId) {
      existing.subQuestionIds.add(input.subQuestionId);
    }
    grouped.set(key, existing);
  }
  return [...grouped.values()].map((entry, index) => ({
    sourceNoteId: buildSourceNoteId(index),
    label: `Source Note ${index + 1}`,
    note: entry.note,
    sourceType: entry.sourceType,
    subQuestionIds: [...entry.subQuestionIds].sort(),
    url: readUrl(entry.note),
  }));
};

export const buildDeepResearchSourceNotesFromAnswers = (
  answers: readonly ResearchAnswer[],
): DeepResearchSourceNote[] =>
  buildDeepResearchSourceNotes(
    answers.flatMap((answer) =>
      answer.evidenceMentions.map((note) => ({
        note,
        sourceType: "analysis_evidence_mention",
        subQuestionId: answer.subQuestionId,
      }))),
  );

export const buildDeepResearchSourceNotesFromReferences = (
  references: readonly string[],
): DeepResearchSourceNote[] =>
  buildDeepResearchSourceNotes(
    references.map((note) => ({
      note,
      sourceType: "final_reference",
    })),
  );

export const mergeDeepResearchFinalReportSourceNotes = (input: {
  finalReport: DeepResearchFinalReport;
  packageSourceNotes: readonly DeepResearchSourceNote[];
}): DeepResearchFinalReport => {
  if (input.finalReport.sourceNotes.length > 0) {
    return input.finalReport;
  }
  if (input.packageSourceNotes.length > 0) {
    return {
      ...input.finalReport,
      sourceNotes: [...input.packageSourceNotes],
    };
  }
  return {
    ...input.finalReport,
    sourceNotes: buildDeepResearchSourceNotesFromReferences(input.finalReport.references),
  };
};
