import assert from "node:assert/strict";

import { renderAppShell } from "../../src/app/app-shell/app-shell.js";
import { skillRegistry } from "../../src/app/app-shell/skill-registry.js";

const mediaOptimizer = skillRegistry.find((skill) => skill.id === "media-optimizer");
assert.ok(mediaOptimizer, "Skill Registry must include media-optimizer.");
assert.equal(mediaOptimizer.category, "content");
assert.equal(mediaOptimizer.route, "/skills/media-optimizer");
assert.equal(mediaOptimizer.primarySurface, "media-optimizer-workspace");
assert.ok(mediaOptimizer.allowedActions.some((action) => action === "Start"));

const html = renderAppShell();
assert.ok(html.indexOf('data-skill-workspace="media-optimizer"') >= 0, "App Shell must render the Media Optimizer workspace.");
assert.ok(html.indexOf("/api/media-processing/start-async") >= 0, "Media Optimizer client must submit through the approved async route.");
assert.ok(html.indexOf("outputArtifacts") >= 0, "Media Optimizer client must render ability output artifacts.");
assert.ok(html.indexOf("proofRef") >= 0, "Media Optimizer client must render the media-processing proofRef.");
assert.ok(html.indexOf("downloadsPaths") >= 0, "Media Optimizer client must render every async downloads artifact path.");
assert.ok(html.indexOf("ffmpeg") < 0, "Media Optimizer UI must not expose direct ffmpeg execution text.");

process.stdout.write("[ACCEPTANCE][media-optimizer-app-ui] PASS\n");
