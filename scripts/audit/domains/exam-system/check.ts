import { pathToFileURL } from "node:url";
import { runRestoredDomain } from "../../shared/restored-domain-runner.js";
import { inspectDomain } from "./inspector.js";

export async function runExamSystemCheck(root=process.cwd()):Promise<void>{
  const findings=await runRestoredDomain("exam-system",inspectDomain,root);
  if(findings.length){for(const item of findings)process.stderr.write(`${item.checkId} ${item.filePath??"unknown"} ${item.message}\n`);process.exitCode=1;return}
  process.stdout.write("EXAM_SYSTEM_ENFORCEMENT_PASS\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runExamSystemCheck();
