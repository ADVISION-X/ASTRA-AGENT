import type { SourceFile } from "ts-morph";
import { resolve } from "node:path";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

export type FindingFactory = (
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
) => InspectorFinding;

export const inspectMissingTokens = (input: Readonly<{
  source: string;
  required: readonly string[];
  checkId: string;
  filePath: string;
  findings: InspectorFinding[];
  finding: FindingFactory;
  message(required: string): string;
}>): void => {
  for (const required of input.required) if (!input.source.includes(required)) {
    input.findings.push(input.finding(input.checkId, input.filePath, input.message(required)));
  }
};

export const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

export const sourceTextForPaths = (context: InspectorContext, paths: readonly string[]): string =>
  paths.map((path) => sourceFor(context, path)?.getFullText() ?? "").join("\n");
