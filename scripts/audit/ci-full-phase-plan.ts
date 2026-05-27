export type CommandStep = readonly [
  name: string,
  command: readonly [string, ...string[]],
  filePathHint: string | null,
  lawIdHint: string | null,
  minimalFixHint: string,
];

export type PlannedStep = readonly [phase: string, name: string, command: string];

const formatCommand = (command: readonly string[]): string => command.join(" ");

const createAcceptanceStep = (
  name: string,
  command: readonly [string, ...string[]],
  filePathHint: string,
  minimalFixHint: string,
): CommandStep => [name, command, filePathHint, null, minimalFixHint];

export const codexEntryGateStep: CommandStep = [
  "codex-entry-gate",
  ["npm", "run", "codex:entry-gate"],
  "scripts/audit/codex-entry-gate.ts",
  "APEX-AUDIT-001-V1",
  "Repair codex-entry-gate before rerunning npm run ci:full.",
];

export const typecheckStep: CommandStep = [
  "typecheck",
  ["npm", "run", "typecheck"],
  "tsconfig.json",
  null,
  "Run npm run typecheck directly and repair the first TypeScript error before rerunning ci:full.",
];

export const acceptanceSteps: readonly CommandStep[] = [
  createAcceptanceStep("code-purity-zombie-deep", ["npm", "run", "acceptance:code-purity-zombie-deep"], "package.json", "Run npm run acceptance:code-purity-zombie-deep directly and fix its first failing assertion."),
  createAcceptanceStep("audit-truth-coverage", ["npm", "run", "acceptance:audit-truth-coverage"], "package.json", "Run npm run acceptance:audit-truth-coverage directly and fix the first failing meta-quality assertion."),
  createAcceptanceStep("ci-summary-truth", ["npm", "run", "acceptance:ci-summary-truth"], "scripts/acceptance/ci-summary-truth.acceptance.ts", "Repair the ci-full summary contract and rerun npm run acceptance:ci-summary-truth."),
  createAcceptanceStep("runtime-truth-completed-evidence", ["npm", "run", "acceptance:runtime-truth-completed-evidence"], "package.json", "Run npm run acceptance:runtime-truth-completed-evidence directly and repair its first failure."),
  createAcceptanceStep("runtime-log-spine", ["npm", "run", "acceptance:runtime-log-spine"], "package.json", "Run npm run acceptance:runtime-log-spine directly and repair the first failing runtime-log acceptance."),
  createAcceptanceStep("deep-research-analysis-smoke", ["npm", "run", "acceptance:deep-research-analysis-smoke"], "scripts/acceptance/deep-research-analysis-smoke.ts", "Run npm run acceptance:deep-research-analysis-smoke directly and repair the first failing smoke assertion."),
  createAcceptanceStep("deep-research-promptbundle-sovereignty", ["npm", "run", "acceptance:deep-research-promptbundle-sovereignty"], "scripts/acceptance/deep-research-promptbundle-sovereignty.acceptance.ts", "Repair the first failing Deep Research promptbundle sovereignty assertion."),
  createAcceptanceStep("deep-research-per-subquestion-promptbundle", ["npm", "run", "acceptance:deep-research-per-subquestion-promptbundle"], "scripts/acceptance/deep-research-per-subquestion-promptbundle.acceptance.ts", "Repair the first failing per-subquestion promptbundle assertion."),
  createAcceptanceStep("deep-research-single-chain", ["npm", "run", "acceptance:deep-research-single-chain"], "scripts/acceptance/deep-research-single-chain.acceptance.ts", "Repair the first failing Deep Research single-chain assertion."),
  createAcceptanceStep("deep-research-full-case-file", ["npm", "run", "acceptance:deep-research-full-case-file"], "scripts/acceptance/deep-research-full-case-file.acceptance.ts", "Repair the first failing Deep Research full-case-file assertion."),
  createAcceptanceStep("deep-research-runtime-shell-only", ["npm", "run", "acceptance:deep-research-runtime-shell-only"], "scripts/acceptance/deep-research-runtime-shell-only.acceptance.ts", "Repair the first failing Deep Research runtime-shell assertion."),
  createAcceptanceStep("deep-research-raw-response-sovereignty", ["npm", "run", "acceptance:deep-research-raw-response-sovereignty"], "scripts/acceptance/deep-research-raw-response-sovereignty.acceptance.ts", "Repair the first failing raw-response sovereignty assertion."),
  createAcceptanceStep("deep-research-format-shell-boundary", ["npm", "run", "acceptance:deep-research-format-shell-boundary"], "scripts/acceptance/deep-research-format-shell-boundary.acceptance.ts", "Repair the first failing format-shell boundary assertion."),
  createAcceptanceStep("deep-research-final-adjudication-raw", ["npm", "run", "acceptance:deep-research-final-adjudication-raw"], "scripts/acceptance/deep-research-final-adjudication-raw.acceptance.ts", "Repair the first failing final-adjudication-raw assertion."),
  createAcceptanceStep("deep-research-no-system-confidence", ["npm", "run", "acceptance:deep-research-no-system-confidence"], "scripts/acceptance/deep-research-no-system-confidence.acceptance.ts", "Repair the first failing no-system-confidence assertion."),
  createAcceptanceStep("deep-research-promptbundle-field-consistency", ["npm", "run", "acceptance:deep-research-promptbundle-field-consistency"], "scripts/acceptance/deep-research-promptbundle-field-consistency.acceptance.ts", "Repair the first failing promptbundle field-consistency assertion."),
  createAcceptanceStep("deep-research-html-uses-raw-final-answer", ["npm", "run", "acceptance:deep-research-html-uses-raw-final-answer"], "scripts/acceptance/deep-research-html-uses-raw-final-answer.acceptance.ts", "Repair the first failing html-uses-raw-final-answer assertion."),
  createAcceptanceStep("deep-research-final-adjudication-promptbundle-input", ["npm", "run", "acceptance:deep-research-final-adjudication-promptbundle-input"], "scripts/acceptance/deep-research-final-adjudication-promptbundle-input.acceptance.ts", "Repair the first failing final-adjudication promptbundle-input assertion."),
  createAcceptanceStep("deep-research-html-promptbundle-input", ["npm", "run", "acceptance:deep-research-html-promptbundle-input"], "scripts/acceptance/deep-research-html-promptbundle-input.acceptance.ts", "Repair the first failing html promptbundle-input assertion."),
  createAcceptanceStep("deep-research-html-report-only", ["npm", "run", "acceptance:deep-research-html-report-only"], "scripts/acceptance/deep-research-html-report-only.acceptance.ts", "Repair the first failing html-report-only assertion."),
  createAcceptanceStep("deep-research-html-full-process-report", ["npm", "run", "acceptance:deep-research-html-full-process-report"], "scripts/acceptance/deep-research-html-full-process-report.acceptance.ts", "Repair the first failing html full-process report assertion."),
  createAcceptanceStep("deep-research-subquestion-failure-stop", ["npm", "run", "acceptance:deep-research-subquestion-failure-stop"], "scripts/acceptance/deep-research-subquestion-failure-stop.acceptance.ts", "Repair the first failing subquestion-failure-stop assertion."),
  createAcceptanceStep("deep-research-report-export", ["npm", "run", "acceptance:deep-research-report-export"], "scripts/acceptance/deep-research-report-export.acceptance.ts", "Repair the first failing Deep Research export assertion."),
  createAcceptanceStep("deep-research-no-compatibility-formats", ["npm", "run", "acceptance:deep-research-no-compatibility-formats"], "scripts/acceptance/deep-research-single-format-path.acceptance.ts", "Repair the first failing single-format-path assertion."),
  createAcceptanceStep("deep-research-app-ui", ["npm", "run", "acceptance:deep-research-app-ui"], "scripts/acceptance/deep-research-app-ui.acceptance.ts", "Repair the first failing Deep Research app UI assertion."),
  createAcceptanceStep("deep-research-case-reader-ui", ["npm", "run", "acceptance:deep-research-case-reader-ui"], "scripts/acceptance/deep-research-case-reader-ui.acceptance.ts", "Repair the first failing case-reader UI assertion."),
  createAcceptanceStep("deep-research-promptbundle-visibility-ui", ["npm", "run", "acceptance:deep-research-promptbundle-visibility-ui"], "scripts/acceptance/deep-research-promptbundle-visibility-ui.acceptance.ts", "Repair the first failing promptbundle visibility UI assertion."),
  createAcceptanceStep("deep-research-clean-raw-index-ui", ["npm", "run", "acceptance:deep-research-clean-raw-index-ui"], "scripts/acceptance/deep-research-clean-raw-index-ui.acceptance.ts", "Repair the first failing clean-raw-index UI assertion."),
  createAcceptanceStep("deep-research-html-delivery-status-ui", ["npm", "run", "acceptance:deep-research-html-delivery-status-ui"], "scripts/acceptance/deep-research-html-delivery-status-ui.acceptance.ts", "Repair the first failing html-delivery-status UI assertion."),
  createAcceptanceStep("amazon-invoice-upload-smoke", ["npm", "run", "acceptance:amazon-invoice-upload-smoke"], "scripts/acceptance/amazon-invoice-upload-smoke.ts", "Repair the first failing Amazon invoice upload smoke assertion."),
  createAcceptanceStep("facebook-product-video-mining", ["npm", "run", "acceptance:facebook-product-video-mining"], "package.json", "Run npm run acceptance:facebook-product-video-mining directly and repair the first failing Facebook acceptance."),
  createAcceptanceStep("amazon-product-mining", ["npm", "run", "acceptance:amazon-product-mining"], "package.json", "Run npm run acceptance:amazon-product-mining directly and repair the first failing Amazon acceptance."),
  createAcceptanceStep("video-download-telegram-web", ["npm", "run", "acceptance:video-download-telegram-web"], "scripts/acceptance/video-download-telegram-web.acceptance.ts", "Run npm run acceptance:video-download-telegram-web directly and repair the first failing video-download acceptance."),
];

export const plannedSteps: readonly PlannedStep[] = [
  ["codex-entry-gate", codexEntryGateStep[0], formatCommand(codexEntryGateStep[1])],
  ["build-audit-artifacts", "build-audit-artifacts", "internal:buildAuditArtifacts()"],
  ["active-law-full-coverage", "active-law-full-coverage", "internal:verifyActiveLawFullCoverage()"],
  ["meta-quality", "meta-quality", 'internal:runGeneratedPlanFiltered({ capabilityDomains: ["audit-truth"] })'],
  ["typecheck", typecheckStep[0], formatCommand(typecheckStep[1])],
  ["domain-audit-runner", "domain-audit-runner", 'internal:runGeneratedPlanFiltered({ excludeCapabilityDomains: ["audit-truth"] })'],
  ...acceptanceSteps.map((step) => ["acceptance-runner", step[0], formatCommand(step[1])] as const),
  ["generated-artifact-truth", "generated-artifact-truth", "internal:verifyGeneratedArtifactTruth()"],
];