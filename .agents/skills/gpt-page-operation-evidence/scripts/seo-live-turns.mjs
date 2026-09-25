import { createHash } from "node:crypto";
import { researchPrompt, articlePrompt, imagePrompt } from "../../../../src/plugins/public-knowledge-article-pipeline/seo-turn-prompts.ts";
import { parsePublicKnowledgeResearch, parsePublicKnowledgeArticle } from "../../../../src/plugins/public-knowledge-article-pipeline/result-contract.ts";
import { turnMarker } from "../../../../src/plugins/public-knowledge-article-pipeline/seo-turn-contract.ts";

const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const stages = ["corpus_research", "article_synthesis", "article_image_generation"];

/** In-memory prompt/result chain. Raw prompt and assistant text never enter the public report. */
export function createSeoLiveTurns(source) {
  if (source?.publicSource?.sourceKind !== "LIVE_SEO_CAPTURE_SESSION_INPUT"
    || source.task?.product_id !== "public_knowledge_article_pipeline"
    || source.task?.action_id !== "produce_article") throw new Error("SEO_LIVE_SOURCE_REQUIRED");
  let stageIndex = 0;
  let pending = null;
  let research = null;
  let article = null;
  const receipts = [];
  function prepare() {
    if (pending !== null) throw new Error("SEO_PRIOR_TURN_UNRESOLVED");
    if (stageIndex >= stages.length) throw new Error("SEO_TURNS_TERMINAL");
    const stepId = stages[stageIndex];
    const marker = turnMarker(source.task, stepId);
    const prompt = stepId === "corpus_research" ? researchPrompt(source.task, marker, source.route)
      : stepId === "article_synthesis" ? articlePrompt(source.task, marker, source.route, research)
        : imagePrompt(source.task, marker, article);
    pending = Object.freeze({ stepId, marker, promptHash: sha(prompt) });
    return Object.freeze({ stepId, marker, turnMarkerHash: sha(marker),
      prompt, promptHash: pending.promptHash });
  }
  function acceptTextTurn({ observedCallId, scene, exactAssistant }) {
    if (pending === null || pending.stepId === "article_image_generation") throw new Error("SEO_TEXT_TURN_NOT_PENDING");
    if (!observedCallId || !scene || !exactAssistant
      || exactAssistant.promptHash !== pending.promptHash
      || exactAssistant.semanticTextHash !== sha(exactAssistant.semanticText)
      || exactAssistant.documentIdentityHash !== scene.documentIdentityHash
      || exactAssistant.observationRevisionHash !== scene.observationRevisionHash
      || !scene.pageFacts?.conversationTurnBindings?.some((entry) =>
        entry.precedingPromptHash === pending.promptHash
        && entry.responseHash === exactAssistant.semanticTextHash
        && entry.assistantTurnIdHash === exactAssistant.assistantTurnIdHash)) {
      throw new Error("SEO_ASSISTANT_EXACT_SCENE_BINDING_INVALID");
    }
    const result = pending.stepId === "corpus_research"
      ? parsePublicKnowledgeResearch(exactAssistant.semanticText, source.route)
      : parsePublicKnowledgeArticle(exactAssistant.semanticText, source.route);
    receipts.push(Object.freeze({ observedCallId, stepId: pending.stepId,
      sceneId: scene.sceneId, promptHash: pending.promptHash,
      responseHash: exactAssistant.semanticTextHash,
      assistantTurnIdHash: exactAssistant.assistantTurnIdHash,
      documentIdentityHash: scene.documentIdentityHash,
      observationRevisionHash: scene.observationRevisionHash,
      parsedResultHash: sha(JSON.stringify(result)),
      ...(pending.stepId === "corpus_research" ? { decision: result.decision } : {}) }));
    if (pending.stepId === "corpus_research") research = result;
    else article = result;
    const decline = pending.stepId === "corpus_research" && result.decision === "decline";
    stageIndex = decline ? stages.length : stageIndex + 1;
    pending = null;
    return Object.freeze({ terminal: decline, nextStepId: decline ? null : stages[stageIndex],
      receipt: receipts.at(-1) });
  }
  function acceptImageTurn({ observedCallId, scene, imageFact }) {
    if (pending?.stepId !== "article_image_generation" || !observedCallId
      || !scene?.pageFacts?.semanticMediaReady || !imageFact?.sourceHash
      || !imageFact?.assistantTurnIdHash
      || imageFact.promptHash !== pending.promptHash
      || scene.pageFacts?.userTurnBindings?.filter((entry) =>
        entry.promptHash === pending.promptHash && entry.userTurnIdHash
        && entry.turnMarkerHashes.includes(sha(pending.marker))).length !== 1
      || scene.pageFacts?.conversationTurnBindings?.filter((entry) =>
        entry.precedingPromptHash === pending.promptHash
        && entry.assistantTurnIdHash === imageFact.assistantTurnIdHash).length !== 1
      || scene.nodes?.filter((node) => node.tag === "img"
        && node.media?.sourceHash === imageFact.sourceHash && node.media.complete === true
        && node.media.ownerTurnIdHash === imageFact.assistantTurnIdHash).length !== 1) {
      throw new Error("SEO_IMAGE_TURN_INVALID");
    }
    receipts.push(Object.freeze({ observedCallId, stepId: pending.stepId,
      sceneId: scene.sceneId, promptHash: pending.promptHash,
      imageSourceHash: imageFact.sourceHash, assistantTurnIdHash: imageFact.assistantTurnIdHash,
      documentIdentityHash: scene.documentIdentityHash,
      observationRevisionHash: scene.observationRevisionHash }));
    pending = null;
    stageIndex = stages.length;
    return Object.freeze({ terminal: true, receipt: receipts.at(-1) });
  }
  return Object.freeze({ prepare, acceptTextTurn, acceptImageTurn,
    receipts: () => Object.freeze([...receipts]),
    status: () => pending ? "AWAITING_PAGE_RESULT" : stageIndex === stages.length ? "TERMINAL" : "READY" });
}
