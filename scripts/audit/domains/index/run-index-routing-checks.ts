import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { indexRoutingRuleConstants } from "./index-routing-constants.js";
import { parseIndexLawDocument } from "./index-routing-parser.js";
import {
  buildIndexRoutingPhases,
  buildParseFailureRoutingFindings,
  collectIndexRoutingFindings,
  collectParsedRoutingFindings,
} from "./index-routing-validation.js";

const { INDEX_FILE } = indexRoutingRuleConstants;

export async function runIndexRoutingChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const content = await readTextFile(pathFromRepoRoot(INDEX_FILE));
  const parsed = parseIndexLawDocument(content);
  const groups = parsed
    ? await collectParsedRoutingFindings(parsed)
    : buildParseFailureRoutingFindings();
  const findings = collectIndexRoutingFindings(groups);

  return {
    findings,
    phases: buildIndexRoutingPhases({ findings, groups }),
  };
}