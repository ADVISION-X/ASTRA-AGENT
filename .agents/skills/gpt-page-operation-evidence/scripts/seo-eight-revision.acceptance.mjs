import { readFile } from 'node:fs/promises';
import { sealSeoRevision, validateSeoRevision } from './seo-report-revisions.mjs';

const path = process.argv[2];
if (!path) throw new Error('REAL_EIGHT_REVISION_PATH_REQUIRED');
const original = JSON.parse(await readFile(path, 'utf8'));
if (original.localizationSource?.entries?.length !== 5
  || original.stageReceipts?.length !== 8
  || original.frozenFlow?.expectedCalls?.length !== 83) {
  throw new Error('REAL_EIGHT_REVISION_REQUIRED');
}
validateSeoRevision(original);
const clone = (edit) => {
  const { contentHash, evidenceRevisionId, ...body } = structuredClone(original);
  edit(body);
  return sealSeoRevision(body);
};
const reject = (name, edit) => {
  let rejected = false;
  try { validateSeoRevision(clone(edit)); } catch { rejected = true; }
  if (!rejected) throw new Error(`FALSE_ACCEPT:${name}`);
};
reject('public-source-raw-injection', (body) => {
  body.localizationSource.entries[0].source_content = 'PRIVATE_TEXT_MUST_NOT_ENTER_REPORT';
});
reject('source-material-hash-drift', (body) => {
  body.localizationSource.entries[0].materials[0].sha256 = 'sha256:' + '0'.repeat(64);
});
reject('locale-stage-reorder', (body) => {
  [body.stageReceipts[3], body.stageReceipts[4]] = [body.stageReceipts[4], body.stageReceipts[3]];
});
reject('cross-locale-receipt-source', (body) => {
  body.stageReceipts[4].sourceJobIdHash = body.stageReceipts[3].sourceJobIdHash;
});
reject('cross-locale-call-source', (body) => {
  body.calls.find((call) => call.stepId === 'article_translation:ja-JP').sourceJobIdHash =
    body.localizationSource.entries[2].jobIdHash;
});
reject('duplicate-assistant-turn', (body) => {
  body.stageReceipts[4].assistantTurnIdHash = body.stageReceipts[3].assistantTurnIdHash;
});
reject('false-complete', (body) => { body.captureStatus = 'CAPTURE_COMPLETE'; });
reject('missing-final-translation-receipt', (body) => {
  body.stageReceipts.pop();
});
reject('changed-physical-call-id', (body) => {
  body.calls.find((call) => call.identityOrigin).observedCallId = 'sha256:' + '1'.repeat(64);
});
reject('unplanned-locale-child-route', (body) => {
  body.calls.find((call) => call.stepId === 'article_translation:ko-KR'
    && call.childCapabilityId === 'open_gpt_execution_profile').childCapabilityId = 'prepare_clean_gpt_chat';
});
let rejectedWrongV5Scope = false;
try {
  validateSeoRevision(clone((body) => {
    const scene = body.scenes.find((entry) =>
      entry.observationScope?.collectorProfile === 'CURRENT_TURN_NULL_UNREAD_V4');
    if (!scene) throw new Error('V4_SCENE_REQUIRED');
    scene.observationScope.collectorProfile = 'CURRENT_TURN_TARGETED_FILE_INPUT_V5';
    scene.observationScope.nodeCoverage =
      'SELECTED_VISIBLE_TARGETS_AND_TARGETED_HIDDEN_FILE_INPUT_NOT_FULL_DOCUMENT';
    // Its signed page fact still declares v1, so the V5 claim must fail closed.
  }));
} catch (error) {
  rejectedWrongV5Scope = /SEO_REVISION_COLLECTOR_SCOPE_FACT_MISMATCH/u.test(String(error));
}
if (!rejectedWrongV5Scope) throw new Error('FALSE_ACCEPT:V5_WITH_V1_PAGE_FACT');
console.log('seo-eight-revision-acceptance-ok');
