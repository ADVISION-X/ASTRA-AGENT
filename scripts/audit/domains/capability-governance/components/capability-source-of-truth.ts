import { readFileSync } from "node:fs";

import { z } from "zod";

import { splitLines } from "../../../shared/no-regex.js";
import { resolveFromRepo } from "../../../shared/paths.js";

export const capabilityGovernanceLawPath = ".github/instructions/agent-rules/基础法案.md";
export const capabilityGovernanceBlueprintPath = ".github/instructions/agent-rules/功能法案.md";

type BlueprintAbilityDeclaration = {
  label: string;
  ownerPath: string | null;
};

export type CapabilityFacadePolicy = {
  allowedPublicChildFunctionExports?: ReadonlySet<string>;
  mode: "factory-contract" | "public-child-functions";
};

export type CapabilitySourceOfTruth = {
  blueprintDeclaredAbilities: BlueprintAbilityDeclaration[];
  lawActiveCapabilityRoots: string[];
  lawInfrastructureRoots: string[];
};

const LawRecordSchema = z.object({
  appliesTo: z.array(z.string()),
  status: z.literal("active"),
}).passthrough();

const activeLawPaths = [
  capabilityGovernanceLawPath,
  capabilityGovernanceBlueprintPath,
] as const;

const extractLawRecords = (repoPath: string): z.infer<typeof LawRecordSchema>[] => {
  const lines = splitLines(readFileSync(resolveFromRepo(repoPath), "utf8"));
  const records: z.infer<typeof LawRecordSchema>[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() !== "```law-record") continue;
    const closingIndex = lines.findIndex(
      (line, candidateIndex) => candidateIndex > index && line.trim() === "```",
    );
    if (closingIndex < 0) {
      throw new Error(`CAPABILITY_GOVERNANCE_LAW_RECORD_UNCLOSED:${repoPath}:${index + 1}`);
    }
    const parsed = LawRecordSchema.safeParse(
      JSON.parse(lines.slice(index + 1, closingIndex).join("\n")),
    );
    if (!parsed.success) {
      throw new Error(`CAPABILITY_GOVERNANCE_LAW_RECORD_INVALID:${repoPath}:${index + 1}`);
    }
    records.push(parsed.data);
    index = closingIndex;
  }
  return records;
};

const capabilityRoot = (appliesTo: string): string | null => {
  const segments = appliesTo.split("/");
  return segments.length === 4
    && segments[0] === "src"
    && segments[1] === "capabilities"
    && Boolean(segments[2])
    && segments[3] === "**"
    ? `src/capabilities/${segments[2]}`
    : null;
};

const activeCapabilityRoots = (): string[] => [...new Set(
  activeLawPaths
    .flatMap(extractLawRecords)
    .flatMap((record) => record.appliesTo)
    .flatMap((pathPattern) => {
      const root = capabilityRoot(pathPattern);
      return root ? [root] : [];
    }),
)].sort();

export const loadCapabilitySourceOfTruth = (): CapabilitySourceOfTruth => {
  const roots = activeCapabilityRoots();
  return {
    blueprintDeclaredAbilities: roots.map((ownerPath) => ({
      label: ownerPath.slice("src/capabilities/".length),
      ownerPath,
    })),
    lawActiveCapabilityRoots: roots,
    lawInfrastructureRoots: ["src/lib/browser", "src/lib/runtime-logs"],
  };
};

export const resolveCapabilityFacadePolicy = (
  _capabilityRoot: string,
): CapabilityFacadePolicy => ({ mode: "factory-contract" });
