import type { Pick3PlaybookLessonRecord } from "./pick3-is-blind-eval.playbook-lesson-types.js";

export const PICK3_PLAYBOOK_LESSON_PROMOTION_THRESHOLD = 3;

const groupLessonsByAggregateKey = (
  lessons: readonly Pick3PlaybookLessonRecord[],
): Map<string, Pick3PlaybookLessonRecord[]> => {
  const groups = new Map<string, Pick3PlaybookLessonRecord[]>();
  for (const lesson of lessons) {
    if (lesson.status === "rejected") continue;
    const group = groups.get(lesson.aggregateKey) ?? [];
    group.push(lesson);
    groups.set(lesson.aggregateKey, group);
  }
  return groups;
};

const renderLessonGroup = (aggregateKey: string, group: readonly Pick3PlaybookLessonRecord[]): string => {
  const latest = group[group.length - 1];
  if (!latest) throw new Error("pick3_playbook_lesson_group_empty");
  return [
    `- Historical experience (${group.length} accumulated case${group.length === 1 ? "" : "s"}, aggregate \`${aggregateKey}\`):`,
    `  Root cause pattern observed: ${latest.rootCause}`,
    `  Candidate lesson: ${latest.candidateLesson}`,
  ].join("\n");
};

/**
 * Assembles a "historical experience" prompt section live from the current state of
 * pick3_playbook_lessons. There is no saved candidate/promoted Playbook file: this section
 * is recomputed from the database every time a prompt package is built, so the prompt always
 * reflects the latest accumulated AI-reviewed experience without any intermediate file layer.
 */
export const assemblePick3ExperienceSection = (input: {
  lessons: readonly Pick3PlaybookLessonRecord[];
  threshold?: number;
}): string | null => {
  const threshold = input.threshold ?? PICK3_PLAYBOOK_LESSON_PROMOTION_THRESHOLD;
  const groups = groupLessonsByAggregateKey(input.lessons);
  const eligibleGroups = [...groups.entries()].filter(([, group]) => group.length >= threshold);
  if (eligibleGroups.length === 0) return null;
  return [
    "Historical experience reference (not a hard rule, assembled live from accumulated AI-reviewed failure cases for this position; this is not a saved file, it is recomputed from current records every time):",
    "Each entry below must still be weighed against the actual visual evidence in the current image — it is a tendency observed in past cases, not a mandatory mapping. Only patterns with enough accumulated cases are included.",
    "",
    eligibleGroups.map(([aggregateKey, group]) => renderLessonGroup(aggregateKey, group)).join("\n\n"),
    "",
    "Do not memorize concrete answers. Use these as visual-grammar-grounded tendencies only, weighed against the current image's own evidence.",
  ].join("\n");
};
