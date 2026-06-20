import type { Pick3BatchSummary } from "./pick3-is-blind-eval.schema.js";
import type { Pick3PlaybookPromptPackage, Pick3PlaybookVersion } from "./pick3-is-blind-eval.playbook.js";

export type BuiltPick3Batch = Pick3BatchSummary & {
  playbooks: Pick3PlaybookVersion[];
  promptPackages: Pick3PlaybookPromptPackage[];
};
