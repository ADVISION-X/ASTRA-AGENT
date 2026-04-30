import path from "node:path";

export const repoRoot = path.resolve(process.cwd());
export const auditHome = path.join(repoRoot, "scripts", "audit");
export const lawHome = path.join(repoRoot, ".github", "instructions", "cursor-rules");
export const moduleLawHome = path.join(lawHome, "modules");
export const domainsHome = path.join(auditHome, "domains");
export const generatedHome = path.join(auditHome, "generated");
export const phaseGatesHome = path.join(auditHome, "phase-gates");
export const defaultPhaseGatePath = path.join(phaseGatesHome, "phase-04-full-enforcement.json");