import { inspectDomain as inspectLocalizationContract } from "../xuanxue-ai-production/localization-contract-inspector.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export async function inspectDomain(context:InspectorContext):Promise<SessionInspectorOutput>{
  if(!context.project.getSourceFile(resolveFromRepo("scripts/audit/domains/xuanxue-ai-production/localization-contract-inspector.ts")))throw new Error("localization contract inspector source is missing");
  return inspectLocalizationContract(context);
}
