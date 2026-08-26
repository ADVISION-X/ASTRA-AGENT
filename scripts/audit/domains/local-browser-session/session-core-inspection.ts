import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { collectTransportPayloadCeilingFindings } from "./transport-payload-ceiling-inspector.js";
import { createLocalFinding, sourcePaths, targetAuthorityPath } from "./inspector-support.js";
import { inspectSingleTransport } from "./transport-inspector.js";

export const inspectSessionCore = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const path of [...sourcePaths, targetAuthorityPath].filter((candidate) => context.targetPaths.includes(candidate))) {
    if (context.project.getSourceFile(resolveFromRepo(path))) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: path,
      message: `${path} must exist in the ts-morph project.`,
    }));
  }
  inspectSingleTransport(context, findings, lawId);
  findings.push(...collectTransportPayloadCeilingFindings(context, lawId));
};
