import { inspectDomain as inspectLocalizationContract } from "../xuanxue-ai-production/localization-contract-inspector.js";
import type { InspectorContext, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export async function inspectDomain(context:InspectorContext):Promise<SessionInspectorOutput>{
  const contractPath="src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.ts";
  if(!context.project.getSourceFile(resolveFromRepo(contractPath)))throw new Error("localization production contract source is missing");
  return inspectLocalizationContract(context);
}
