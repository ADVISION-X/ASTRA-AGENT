import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSeoLiveTurns } from "./seo-live-turns.mjs";
import { loadPinnedSeoSource } from "./seo-live-source.mjs";

const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const catalog = JSON.parse(await readFile(new URL("../../../../src/lib/local-runtime/production/website-agent-route-policies.v1.json",
  import.meta.url), "utf8"));
const route = catalog.routes.find((entry) => entry.product_id === "public_knowledge_article_pipeline"
  && entry.action_id === "produce_article");
const source = { publicSource: { sourceKind: "LIVE_SEO_CAPTURE_SESSION_INPUT" },
  task: { job_id: "historical-seo-job", product_id: "public_knowledge_article_pipeline",
    action_id: "produce_article", parameters: { domain_id: "bazi", locale: "zh-CN" } }, route };

function assistant(prompt, value) {
  const raw = JSON.stringify(value);
  const scene = { sceneId: sha(`scene:${prompt.stepId}`),
    documentIdentityHash: sha("document"), observationRevisionHash: sha(`revision:${prompt.stepId}`),
    pageFacts: { conversationTurnBindings: [{ precedingPromptHash: prompt.promptHash,
      responseHash: sha(raw), assistantTurnIdHash: sha(`turn:${prompt.stepId}`) }] } };
  return { scene, exactAssistant: { semanticText: raw, semanticTextHash: sha(raw),
    assistantTurnIdHash: sha(`turn:${prompt.stepId}`), promptHash: prompt.promptHash,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash } };
}

const flow = createSeoLiveTurns(source);
const first = flow.prepare();
assert.equal(first.stepId, "corpus_research");
assert.equal(first.promptHash, sha(first.prompt));
assert.throws(() => flow.prepare(), /SEO_PRIOR_TURN_UNRESOLVED/u);
const research = assistant(first, { schema_version: route.result_contract.research.schema_version,
  decision: "proceed" });
assert.throws(() => flow.acceptTextTurn({ observedCallId: sha("call"),
  ...{ scene: research.scene, exactAssistant: { ...research.exactAssistant,
    promptHash: sha("wrong") } } }), /SEO_ASSISTANT_EXACT_SCENE_BINDING_INVALID/u);
const acceptedResearch = flow.acceptTextTurn({ observedCallId: sha("research-call"), ...research });
assert.equal(acceptedResearch.nextStepId, "article_synthesis");
const second = flow.prepare();
assert.equal(second.stepId, "article_synthesis");
assert.equal(second.promptHash, sha(second.prompt));
assert.match(second.prompt, /"decision":"proceed"/u);
const article = assistant(second, { schema_version: route.result_contract.article.schema_version });
const acceptedArticle = flow.acceptTextTurn({ observedCallId: sha("article-call"), ...article });
assert.equal(acceptedArticle.nextStepId, "article_image_generation");
const third = flow.prepare();
assert.equal(third.stepId, "article_image_generation");
assert.equal(third.promptHash, sha(third.prompt));
assert.equal(flow.receipts().length, 2);
const imageTurnId = sha("image-assistant-turn");
const imageScene = { sceneId: sha("image-scene"), pageFacts: { semanticMediaReady: true,
  userTurnBindings: [{ promptHash: third.promptHash, userTurnIdHash: sha("image-user-turn"),
    turnMarkerHashes: [third.turnMarkerHash] }],
  conversationTurnBindings: [{ precedingPromptHash: third.promptHash,
    assistantTurnIdHash: imageTurnId }] },
nodes: [{ tag: "img", media: { sourceHash: sha("image-source"), complete: true,
  ownerTurnIdHash: sha("other-assistant-turn") } }],
documentIdentityHash: sha("image-document"), observationRevisionHash: sha("image-revision") };
const imageFact = { promptHash: third.promptHash, sourceHash: sha("image-source"),
  assistantTurnIdHash: imageTurnId };
assert.throws(() => flow.acceptImageTurn({ observedCallId: sha("image-call"),
  scene: imageScene, imageFact }), /SEO_IMAGE_TURN_INVALID/u);
imageScene.nodes[0].media.ownerTurnIdHash = imageTurnId;
assert.throws(() => flow.acceptImageTurn({ observedCallId: sha("image-call"),
  scene: imageScene, imageFact: { ...imageFact, promptHash: sha("other-prompt") } }),
  /SEO_IMAGE_TURN_INVALID/u);
assert.equal(flow.acceptImageTurn({ observedCallId: sha("image-call"),
  scene: imageScene, imageFact }).terminal, true);
const declineFlow = createSeoLiveTurns(source);
const declinePrompt = declineFlow.prepare();
const declined = assistant(declinePrompt, { schema_version: route.result_contract.research.schema_version,
  decision: "decline" });
assert.equal(declineFlow.acceptTextTurn({ observedCallId: sha("decline-call"), ...declined }).terminal, true);
assert.throws(() => declineFlow.prepare(), /SEO_TURNS_TERMINAL/u);
const pinned = fileURLToPath(new URL("../assets/", import.meta.url));
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const pinnedSource = await loadPinnedSeoSource({ repo, pinnedDir: pinned });
assert.equal(pinnedSource.task.parameters.domain_id, "bazi");
const altered = await mkdtemp(join(tmpdir(), "seo-pinned-tamper-"));
try {
  await copyFile(join(pinned, "seo-task-envelope.json"), join(altered, "seo-task-envelope.json"));
  const snapshot = JSON.parse(await readFile(join(pinned, "seo-source-snapshot.json"), "utf8"));
  snapshot.task.parameters.domain_id = "altered-domain";
  await writeFile(join(altered, "seo-source-snapshot.json"), JSON.stringify(snapshot));
  await assert.rejects(loadPinnedSeoSource({ repo, pinnedDir: altered }),
    /SEO_PINNED_TASK_ENVELOPE_MISMATCH/u);
} finally { await rm(altered, { recursive: true, force: true }); }
process.stdout.write("seo-live-turns-acceptance-ok\n");
