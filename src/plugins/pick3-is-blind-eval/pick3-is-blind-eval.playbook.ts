import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Pick3ImageRecord, Pick3Input, Pick3Position } from "./pick3-is-blind-eval.schema.js";
import type { Pick3PlaybookLessonRecord } from "./pick3-is-blind-eval.playbook-lesson-types.js";
import { assemblePick3ExperienceSection } from "./pick3-is-blind-eval.prompt-versioning.js";

type Pick3PromptMode = Pick3Input["promptMode"];

export type Pick3PlaybookRecord = {
  playbookVersionId: string;
  position: Pick3Position;
  version: number;
  status: "active" | "candidate" | "retired";
  sourceKind: "agent_builtin";
  contentPath: string;
  contentHash: string;
  systemPromptHash: string;
  visualGrammarHash: string;
  parentPlaybookVersionId: string | null;
  createdFromFailureReviewId: string | null;
  notes: string | null;
};

export type Pick3PlaybookVersion = Pick3PlaybookRecord & {
  content: string;
  systemPrompt: string;
  visualGrammar: string;
};

export type Pick3PlaybookPromptPackage = {
  playbookVersionId: string;
  position: Pick3Position;
  promptMode: Pick3PromptMode;
  systemPrompt: string;
  businessPrompt: string;
  systemPromptHash: string;
  businessPromptHash: string;
  visualGrammarHash: string;
  rawPromptHash: string;
  confidenceIsProbability: false;
  allowedLabels: ["lower", "upper", "abstain"];
  imageRef: {
    imageId: string;
    imageSha256: string;
  };
};

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const playbookDir = path.join(pluginDir, "playbooks");

const PICK3_POSITIONS: readonly Pick3Position[] = ["hundreds", "tens", "ones"];
const freeAnalysisPlaybookFile = "free-analysis-strict-reasoning.md";

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

const readPlaybookFile = (fileName: string): { content: string; contentPath: string } => {
  const contentPath = path.join(playbookDir, fileName);
  return {
    contentPath,
    content: readFileSync(contentPath, "utf8"),
  };
};

/**
 * There is no per-position static Playbook file (no Stream A/B/C content). The only
 * fixed text is the shared system.md rules and visual-grammar.md vocabulary. Position-specific
 * signal comes exclusively from the live-assembled experience pool in pick3_playbook_lessons,
 * because hand-authored "historical pattern" text is not real experience — only failure cases
 * that actually ran and were AI-reviewed count as experience.
 */
export const loadBuiltInPick3Playbooks = (promptMode: Pick3PromptMode = "playbook_v1"): Pick3PlaybookVersion[] => {
  if (promptMode === "free_analysis_strict_reasoning") {
    const free = readPlaybookFile(freeAnalysisPlaybookFile);
    const contentHash = hashText(free.content);
    const systemPrompt = "Analyze the attached anonymous L80 time-series chart. Follow the Free Analysis Strict Reasoning task instructions exactly.";
    return PICK3_POSITIONS.map((position) => ({
      playbookVersionId: `pick3_${position}_free_analysis_v1_${contentHash.slice(0, 12)}`,
      position,
      version: 1,
      status: "active",
      sourceKind: "agent_builtin",
      contentPath: free.contentPath,
      contentHash,
      systemPromptHash: hashText(systemPrompt),
      visualGrammarHash: hashText("free-analysis-no-fixed-visual-grammar"),
      parentPlaybookVersionId: null,
      createdFromFailureReviewId: null,
      notes: "AGENT-owned Free Analysis Strict Reasoning experiment v1.",
      content: free.content,
      systemPrompt,
      visualGrammar: "",
    }));
  }
  const system = readPlaybookFile("system.md");
  const visualGrammar = readPlaybookFile("visual-grammar.md");
  const systemPromptHash = hashText(system.content);
  const visualGrammarHash = hashText(visualGrammar.content);
  return PICK3_POSITIONS.map((position) => ({
    playbookVersionId: `pick3_${position}_l80_v1_${visualGrammarHash.slice(0, 12)}`,
    position,
    version: 1,
    status: "active",
    sourceKind: "agent_builtin",
    contentPath: visualGrammar.contentPath,
    contentHash: visualGrammarHash,
    systemPromptHash,
    visualGrammarHash,
    parentPlaybookVersionId: null,
    createdFromFailureReviewId: null,
    notes: "AGENT-owned L80 active Playbook v1. No per-position static file; position-specific signal comes only from the live-assembled experience pool in pick3_playbook_lessons.",
    content: "",
    systemPrompt: system.content,
    visualGrammar: visualGrammar.content,
  }));
};

export const buildPick3PlaybookPromptPackage = (
  playbook: Pick3PlaybookVersion,
  image: Pick3ImageRecord,
  promptMode: Pick3PromptMode = "playbook_v1",
  experienceLessons: readonly Pick3PlaybookLessonRecord[] = [],
): Pick3PlaybookPromptPackage => {
  if (playbook.position !== image.position) {
    throw new Error("pick3_playbook_position_mismatch");
  }
  const imagePayloadLine = "Image payload: inspect the attached image only. Do not use image id as evidence.";
  const experienceSection = promptMode === "playbook_v1"
    ? assemblePick3ExperienceSection({ lessons: experienceLessons, currentPhase: image.targetPhase, currentImageId: image.imageId })
    : null;
  const businessPrompt = promptMode === "free_analysis_strict_reasoning"
    ? [playbook.content, imagePayloadLine].join("\n\n")
    : [playbook.visualGrammar, ...(experienceSection ? [experienceSection] : []), imagePayloadLine].join("\n\n");
  return {
    playbookVersionId: playbook.playbookVersionId,
    position: playbook.position,
    promptMode,
    systemPrompt: playbook.systemPrompt,
    businessPrompt,
    systemPromptHash: playbook.systemPromptHash,
    businessPromptHash: hashText(businessPrompt),
    visualGrammarHash: playbook.visualGrammarHash,
    rawPromptHash: hashText(`${playbook.systemPrompt}\n\n${businessPrompt}`),
    confidenceIsProbability: false,
    allowedLabels: ["lower", "upper", "abstain"],
    imageRef: {
      imageId: image.imageId,
      imageSha256: image.imageSha256,
    },
  };
};
