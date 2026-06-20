import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Pick3ImageRecord, Pick3Input, Pick3Position } from "./pick3-is-blind-eval.schema.js";

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

const positionPlaybookFiles: Record<Pick3Position, string> = {
  hundreds: "is_hundreds_l80_v1.md",
  tens: "is_tens_l80_v1.md",
  ones: "is_ones_l80_v1.md",
};
const freeAnalysisPlaybookFile = "free-analysis-strict-reasoning.md";

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

const readPlaybookFile = (fileName: string): { content: string; contentPath: string } => {
  const contentPath = path.join(playbookDir, fileName);
  return {
    contentPath,
    content: readFileSync(contentPath, "utf8"),
  };
};

export const loadBuiltInPick3Playbooks = (promptMode: Pick3PromptMode = "playbook_v1"): Pick3PlaybookVersion[] => {
  if (promptMode === "free_analysis_strict_reasoning") {
    const free = readPlaybookFile(freeAnalysisPlaybookFile);
    const contentHash = hashText(free.content);
    const systemPrompt = "Analyze the attached anonymous L80 time-series chart. Follow the Free Analysis Strict Reasoning task instructions exactly.";
    return (Object.keys(positionPlaybookFiles) as Pick3Position[]).map((position) => ({
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
  return (Object.entries(positionPlaybookFiles) as Array<[Pick3Position, string]>).map(([position, fileName]) => {
    const positionPlaybook = readPlaybookFile(fileName);
    const contentHash = hashText(positionPlaybook.content);
    return {
      playbookVersionId: `pick3_${position}_l80_v1_${contentHash.slice(0, 12)}`,
      position,
      version: 1,
      status: "active",
      sourceKind: "agent_builtin",
      contentPath: positionPlaybook.contentPath,
      contentHash,
      systemPromptHash,
      visualGrammarHash,
      parentPlaybookVersionId: null,
      createdFromFailureReviewId: null,
      notes: "AGENT-owned L80 active Playbook v1.",
      content: positionPlaybook.content,
      systemPrompt: system.content,
      visualGrammar: visualGrammar.content,
    };
  });
};

export const buildPick3PlaybookPromptPackage = (
  playbook: Pick3PlaybookVersion,
  image: Pick3ImageRecord,
  promptMode: Pick3PromptMode = "playbook_v1",
): Pick3PlaybookPromptPackage => {
  if (playbook.position !== image.position) {
    throw new Error("pick3_playbook_position_mismatch");
  }
  const businessPrompt = promptMode === "free_analysis_strict_reasoning"
    ? [playbook.content, "Image payload: inspect the attached image only. Do not use image id as evidence."].join("\n\n")
    : [playbook.visualGrammar, playbook.content, "Image payload: inspect the attached image only. Do not use image id as evidence."].join("\n\n");
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
