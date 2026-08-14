import { runOwnerFilesystemWriterEscapeAttacks } from "./audit-source-evidence-reachability.attacks.js";

runOwnerFilesystemWriterEscapeAttacks();
process.stdout.write("audit-owner-filesystem-writer-acceptance-ok\n");
