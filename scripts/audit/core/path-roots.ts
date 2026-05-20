import path from "node:path";

export const repoRoot = path.resolve(process.cwd());
const auditHome = path.join(repoRoot, "scripts", "audit");
const lawHome = path.join(repoRoot, ".github", "instructions", "cursor-rules");
const moduleLawHome = path.join(lawHome, "modules");
export const domainsHome = path.join(auditHome, "domains");
export const generatedHome = path.join(auditHome, "generated");
const phaseGatesHome = path.join(auditHome, "phase-gates");
const defaultPhaseGatePath = path.join(phaseGatesHome, "phase-05-final-delivery-debug.json");
