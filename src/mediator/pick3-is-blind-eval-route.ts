import {
  Pick3InputSchema,
  Pick3ResumeInputSchema,
  resumePick3IsBlindEvalTask,
  startPick3IsBlindEvalTask,
} from "../plugins/pick3-is-blind-eval/index.js";

export const runPick3IsBlindEvalRoute = (
  rawInput: unknown,
  context: Parameters<typeof startPick3IsBlindEvalTask>[1],
) => startPick3IsBlindEvalTask(Pick3InputSchema.parse(rawInput), context);

export const runResumePick3IsBlindEvalRoute = (
  rawInput: unknown,
  context: Parameters<typeof resumePick3IsBlindEvalTask>[1],
) => resumePick3IsBlindEvalTask(Pick3ResumeInputSchema.parse(rawInput), context);
