import type { Pick3PlaybookLessonRecord } from "./pick3-is-blind-eval.playbook-lesson-types.js";

/**
 * Self-prediction guard: a phase's blind chart is fully deterministic from official draws, so
 * re-targeting the SAME phase regenerates a pixel-identical chart. A lesson born from reviewing
 * that exact phase's failure was authored with hindsight knowledge of that exact chart's correct
 * answer — feeding it back into a prompt that predicts that exact same phase again is circular,
 * even though the lesson text itself contains no literal phase/imageId/front-back token. This
 * guard excludes any lesson whose source phase or source imageId matches the phase/image
 * currently being predicted, regardless of aggregateKey or text content.
 */
const isPick3LessonSafeToAssemble = (
  lesson: Pick3PlaybookLessonRecord,
  current: { currentPhase?: string | undefined; currentImageId?: string | undefined },
): boolean => {
  if (lesson.status === "rejected") return false;
  if (current.currentPhase && lesson.phase === current.currentPhase) return false;
  if (current.currentImageId && lesson.imageId === current.currentImageId) return false;
  return true;
};

const groupLessonsByAggregateKey = (
  lessons: readonly Pick3PlaybookLessonRecord[],
  current: { currentPhase?: string | undefined; currentImageId?: string | undefined },
): Map<string, Pick3PlaybookLessonRecord[]> => {
  const groups = new Map<string, Pick3PlaybookLessonRecord[]>();
  for (const lesson of lessons) {
    if (!isPick3LessonSafeToAssemble(lesson, current)) continue;
    const group = groups.get(lesson.aggregateKey) ?? [];
    group.push(lesson);
    groups.set(lesson.aggregateKey, group);
  }
  return groups;
};

/**
 * No code-side selection, ranking, deduping, or summarizing of which cases "matter most" — that
 * would be dead code passing judgment on dynamically generated content, which it has no standing
 * to do. Every non-excluded case in the group is rendered in full, in order, regardless of how
 * many there are (1 case or 10,000 cases): the AI reads all of it and weighs it itself.
 */
const renderLessonGroup = (aggregateKey: string, group: readonly Pick3PlaybookLessonRecord[]): string => [
  `- Historical experience (${group.length} accumulated case${group.length === 1 ? "" : "s"}, aggregate \`${aggregateKey}\`):`,
  ...group.map((lesson, index) => [
    `  Case ${index + 1}/${group.length}:`,
    `    Root cause pattern observed: ${lesson.rootCause}`,
    `    Candidate lesson: ${lesson.candidateLesson}`,
  ].join("\n")),
].join("\n");

/**
 * Assembles a "historical experience" prompt section live from the current state of
 * pick3_playbook_lessons. There is no saved candidate/promoted Playbook file and no minimum
 * lesson count gate: one accepted lesson is already experience and is included immediately.
 * Zero lessons means there is nothing to extract yet, not that a threshold was unmet. This is
 * recomputed from the database every time a prompt package is built, so the prompt always
 * reflects the latest accumulated AI-reviewed experience without any intermediate file layer.
 *
 * currentPhase/currentImageId identify the phase/image about to be predicted, so that a lesson
 * born from that exact phase's own past failure can never be fed back into predicting it again.
 */
export const assemblePick3ExperienceSection = (input: {
  lessons: readonly Pick3PlaybookLessonRecord[];
  currentPhase?: string;
  currentImageId?: string;
}): string | null => {
  const groups = groupLessonsByAggregateKey(input.lessons, { currentPhase: input.currentPhase, currentImageId: input.currentImageId });
  if (groups.size === 0) return null;
  return [
    "Historical experience reference (not a hard rule, assembled live from accumulated AI-reviewed failure cases for this position; this is not a saved file, it is recomputed from current records every time. Every accepted case is included as soon as it exists — there is no minimum count before experience counts):",
    "Each entry below must still be weighed against the actual visual evidence in the current image — it is a tendency observed in past cases, not a mandatory mapping.",
    "",
    [...groups.entries()].map(([aggregateKey, group]) => renderLessonGroup(aggregateKey, group)).join("\n\n"),
    "",
    "Do not memorize concrete answers. Use these as visual-grammar-grounded tendencies only, weighed against the current image's own evidence.",
  ].join("\n");
};
