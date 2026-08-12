import assert from "node:assert/strict";

import { createAuditProject } from "../audit/shared/project.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import { resolveFromRepo } from "../audit/shared/paths.js";
import { FacebookLogCoverageLaw } from "../audit/domains/facebook-product-video-mining-log-coverage/constants.js";
import { collectFacebookMiningStageCoverage } from "../audit/domains/facebook-product-video-mining-log-coverage/facebook-mining-stage-coverage.js";

const buildContext = (project: ReturnType<typeof createAuditProject>): InspectorContext => {
	const planEntry: InspectorContext["planEntry"] = {
		capabilityDomain: "facebook-product-video-mining-log-coverage",
		ownerInspectorPath: "scripts/audit/domains/facebook-product-video-mining-log-coverage/inspector.ts",
		executionGroup: "domain",
		bindings: Object.values(FacebookLogCoverageLaw).map((lawId) => ({
			lawId,
			clauseId: `${lawId.toLowerCase()}-fixture-requirement`,
			evidenceMode: "static",
			checkIds: ["facebook-product-video-mining-log-coverage/owner-assertion-set"],
			sourceEvidence: [{
				filePath: "scripts/audit/domains/facebook-product-video-mining-log-coverage/inspector.ts",
				symbolName: "inspectDomain",
			}],
		})),
		blueprintRefs: [],
		manifestPath: "scripts/audit/domains/facebook-product-video-mining-log-coverage/manifest.json",
		lawIds: Object.values(FacebookLogCoverageLaw),
	};
	return {
		checks: createInspectorCheckSession(planEntry).checks,
		project,
		planEntry,
		generatedPlan: [],
		completedReports: {},
	};
};

const realProject = createAuditProject();
const realCoverage = collectFacebookMiningStageCoverage(buildContext(realProject));

for (const stageName of [
	"FACEBOOK_MISSION_PREFLIGHT",
	"FACEBOOK_VIDEO_DOWNLOAD",
	"FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE",
	"FACEBOOK_NAVIGATION_NEXT",
	"FACEBOOK_ROUND_FINALIZE",
] as const) {
	const stage = realCoverage.stageCoverage.find((entry) => entry.stageName === stageName);
	assert.ok(stage, `missing semantic stage entry for ${stageName}`);
	assert.equal(stage?.confidence, "semantic");
	assert.equal(stage?.hasStartedLog, true, `${stageName} should have semantic started coverage`);
	assert.equal(stage?.hasTerminalLog, true, `${stageName} should have semantic terminal coverage`);
	assert.deepEqual(stage?.missingFields ?? [], [], `${stageName} should satisfy semantic stage contract`);
}

const fakeProject = createAuditProject();
fakeProject.createSourceFile(
	resolveFromRepo("src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts"),
	`
		export const fakeNavigationStageNoise = [
			"FACEBOOK_NAVIGATION_NEXT",
			"FACEBOOK_VERIFY_NEXT_STABLE",
			"beforeSignatureHash",
			"afterSignatureHash",
			"recoveryTrail",
			"durationMs"
		].join(":");
	`,
	{ overwrite: true },
);

const fakeCoverage = collectFacebookMiningStageCoverage(buildContext(fakeProject));
const fakeNavigation = fakeCoverage.stageCoverage.find((entry) => entry.stageName === "FACEBOOK_NAVIGATION_NEXT");

assert.ok(fakeNavigation, "missing fake navigation stage entry");
assert.equal(fakeNavigation?.confidence, "semantic");
assert.equal(fakeNavigation?.hasStartedLog, false);
assert.equal(fakeNavigation?.hasTerminalLog, false);
assert.ok(
	fakeCoverage.findings.some((finding) =>
		finding.checkId === "facebook-log-coverage/mandatory-stage"
		&& finding.file === "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts",
	),
	"semantic stage coverage should reject string-only fake navigation coverage",
);

process.stdout.write("[ACCEPTANCE] facebook-product-video-mining-log-coverage PASS\n");
