import {
  runPrimaryEvidenceDeclarationAttacks,
  runSourceEvidenceReachabilityAttacks,
} from "./audit-source-evidence-reachability.attacks.js";

runSourceEvidenceReachabilityAttacks();
runPrimaryEvidenceDeclarationAttacks();
process.stdout.write("audit-source-evidence-reachability-acceptance-ok\n");
