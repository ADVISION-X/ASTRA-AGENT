# GrassEye Pick3 IS Blind Eval 施工图

version: 2026-06-17
status: construction-blueprint
targetLaw: `.github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md`
capabilityDomain: `pick3-is-blind-eval`
targetPlugin: `/Users/nexgen/Documents/AGENT/src/plugins/pick3-is-blind-eval`

施工图只作为实现地图，不高于 active law。

## Chrome Verification Baseline

This blueprint is based on live Chrome verification, not guessed selectors.

Verified pages:

```txt
https://www.theuaelottery.ae/lottery/pick3
https://www.theuaelottery.ae/lottery/pick3/results
https://www.theuaelottery.ae/lottery/results
```

Verified Pick3 page facts:

```txt
page title: Pick 3 | The UAE Lottery
current draw label: Draw No.:260617
internal Draw Results control class:
  .sensors-pick3-bet-drawresults
popup button:
  .common-antd-dialog-footer-single-btn .a-nl-button
popup rows observed:
  260616 -> 4 2 7
  260615 -> 5 5 1
  260614 -> 7 3 0
View More Results navigates to:
  /lottery/pick3/results
```

Verified results page facts:

```txt
page title: theuaelottery.ae/lottery/pick3/results
filters:
  Recent 10 Series dropdown
  From / To date range inputs
  Enter a series No. input
default visible rows:
  260616 Tuesday 21:30, 16/06/2026 -> 4 2 7
  260615 Monday 21:30, 15/06/2026 -> 5 5 1
  260614 Sunday 21:30, 14/06/2026 -> 7 3 0
  ...
```

Verified official APIs:

```txt
GET https://www.theuaelottery.ae/hapi/command/execute?command=660201&lang=en-US&lotteryType=72

GET https://www.theuaelottery.ae/qapi/command/execute?command=660104&lang=en-US&message=<base64-json>

GET https://www.theuaelottery.ae/qapi/command/execute?command=660301&lang=en-US&message=<base64-json>
```

## Plugin File Plan

Create:

```txt
src/plugins/pick3-is-blind-eval/
  index.ts
  pick3-is-blind-eval.schema.ts
  pick3-is-blind-eval.flow.ts
  pick3-is-blind-eval-task-service.ts
  pick3-is-blind-eval.storage.ts
  pick3-is-blind-eval.official-api.ts
  pick3-is-blind-eval.chrome-source.ts
  pick3-is-blind-eval.image.ts
  pick3-is-blind-eval.ai.ts
  pick3-is-blind-eval.scoring.ts
  pick3-is-blind-eval.failure-review.ts
  pick3-is-blind-eval.prompt-versioning.ts
  pick3-is-blind-eval.evidence.ts
```

Optional audit/acceptance:

```txt
scripts/audit/domains/pick3-is-blind-eval/manifest.json
scripts/audit/domains/pick3-is-blind-eval/inspector.ts
scripts/acceptance/pick3-is-blind-eval.acceptance.ts
scripts/audit/domains/pick3-is-blind-eval/inspector.ts
```

## Public API Helpers

### Base64 Message Encoding

```ts
const encodeMessage = (payload: unknown): string =>
  encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString("base64"));
```

Use compact JSON for stable hashes:

```ts
JSON.stringify(payload)
```

or stable-stringify if available locally.

### getPick3PrizeBounds

Endpoint:

```txt
/qapi/command/execute?command=660104&lang=en-US&message=base64({"data":{"lotteryType":72}})
```

Expected response:

```ts
type PrizeBoundsResponse = {
  code: 0;
  data: {
    defaultShowDrawnResultList: number[];
    lotteryTypePrizeTimeDto: {
      lotteryType: 72;
      startTime: string;
      endTime: string;
    };
  };
};
```

Verified values:

```txt
startTime=2025-06-04
endTime=2026-06-16
defaultShowDrawnResultList=[10,20,30]
```

### getLatestPick3Context

Endpoint:

```txt
/hapi/command/execute?command=660201&lang=en-US&lotteryType=72
```

Use for:

- current sale phase;
- next expected prize time;
- latest 10 `prizeHistory`;
- quick source health check.

Do not use it as full historical sync.

Digit position contract:

```txt
nums[0] -> hundreds
nums[1] -> tens
nums[2] -> ones
```

### getPick3PhaseHistory

Endpoint:

```txt
/qapi/command/execute?command=660301&lang=en-US&message=<base64-json>
```

Latest page payload:

```json
{
  "data": {
    "lotteryType": 72,
    "includeSelf": 1,
    "isDesc": 1,
    "prePhases": 10,
    "alreadyDrawn": 1
  }
}
```

Cursor payload:

```json
{
  "data": {
    "lotteryType": 72,
    "includeSelf": 0,
    "isDesc": 1,
    "phase": "260607",
    "prePhases": 10,
    "alreadyDrawn": 0
  }
}
```

Date range payload:

```json
{
  "data": {
    "lotteryType": 72,
    "includeSelf": 1,
    "isDesc": 1,
    "startTime": "2026-06-01 00:00:00",
    "endTime": "2026-06-16 23:59:59",
    "prePhases": 10,
    "alreadyDrawn": 1
  }
}
```

Result row shape:

```ts
type OfficialPhaseRow = {
  lotteryType: 72;
  phase: string;
  result: Array<{ key: "pick3"; data: [string, string, string] }>;
  resultDetail: Array<{
    key: "exact" | "any3" | "any6";
    bet: string;
    prize: number;
    prizeCent: number;
    totalPrize: number;
    totalPrizeCent: number;
  }>;
  totalWinningBetCount: number;
  expectedPrizeTime: string;
  expectedPrizeTimestamp: string;
  startSaleTime: string;
  endSaleTime: string;
};
```

## Sync Algorithm

### First Full Sync

```txt
1. call 660104 to get startTime/endTime.
2. call 660301 latest payload.
3. normalize and upsert returned rows.
4. set cursorPhase = oldest returned phase.
5. call 660301 cursor payload with phase=cursorPhase.
6. repeat until:
   - returned phaseList is empty, or
   - oldest expectedPrizeTime < startTime, or
   - oldest phase already exists and no new rows were inserted.
7. sort ascending by expectedPrizeTimestamp for image generation.
```

### Incremental Sync

```txt
1. read max expectedPrizeTimestamp / max phase from DB.
2. call 660201 for latest official health and prizeHistory.
3. call 660301 latest payload.
4. upsert all returned rows.
5. if newest official phase is already in DB and no gap exists, stop.
6. if a gap exists, cursor backwards from latest until the gap closes.
```

### Gap Check

Pick3 draws daily at 21:30 UAE time. A missing calendar date between `startTime` and latest official drawn date is a gap unless official API has no row for that date.

Gap handling:

```txt
status = partial_success
reason = historical_gap_detected
gapDates = [...]
```

Do not synthesize missing draws.

## Database Schema

Use SQLite via existing AGENT persistence pattern.

### pick3_draws

```sql
CREATE TABLE pick3_draws (
  source TEXT NOT NULL,
  lottery_type INTEGER NOT NULL,
  phase TEXT NOT NULL,
  expected_prize_time TEXT NOT NULL,
  expected_prize_timestamp TEXT NOT NULL,
  result_text TEXT NOT NULL,
  hundreds INTEGER NOT NULL,
  tens INTEGER NOT NULL,
  ones INTEGER NOT NULL,
  total_winning_bet_count INTEGER,
  result_detail_json TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source, lottery_type, phase)
);
```

### pick3_sync_runs

```sql
CREATE TABLE pick3_sync_runs (
  run_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  rows_seen INTEGER NOT NULL,
  rows_inserted INTEGER NOT NULL,
  rows_updated INTEGER NOT NULL,
  newest_phase TEXT,
  oldest_phase TEXT,
  source_api_refs_json TEXT NOT NULL,
  reason TEXT
);
```

### is_blind_batches

```sql
CREATE TABLE is_blind_batches (
  batch_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,
  lottery_type INTEGER NOT NULL,
  window_size INTEGER NOT NULL,
  target_phase TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sealed_answers_hash TEXT,
  prediction_hash TEXT,
  reveal_hash TEXT,
  artifact_dir TEXT NOT NULL
);
```

### is_blind_images

```sql
CREATE TABLE is_blind_images (
  image_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  position TEXT NOT NULL,
  target_phase TEXT NOT NULL,
  target_expected_prize_time TEXT NOT NULL,
  visible_start_phase TEXT NOT NULL,
  visible_end_phase TEXT NOT NULL,
  image_path TEXT NOT NULL,
  image_sha256 TEXT NOT NULL,
  answer_digit INTEGER NOT NULL,
  answer_label TEXT NOT NULL,
  FOREIGN KEY(batch_id) REFERENCES is_blind_batches(batch_id)
);
```

### ai_predictions

```sql
CREATE TABLE ai_predictions (
  prediction_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  image_detail TEXT NOT NULL,
  system_prompt_version_id TEXT NOT NULL,
  business_prompt_version_id TEXT NOT NULL,
  system_prompt_hash TEXT NOT NULL,
  business_prompt_hash TEXT NOT NULL,
  raw_prompt_hash TEXT NOT NULL,
  raw_response_ref TEXT NOT NULL,
  prediction_label TEXT NOT NULL,
  confidence REAL,
  confidence_is_probability INTEGER NOT NULL DEFAULT 0,
  abstain_reason TEXT,
  reason TEXT,
  predicted_at TEXT NOT NULL,
  sealed_before_reveal INTEGER NOT NULL
);
```

### ai_reveals

```sql
CREATE TABLE ai_reveals (
  reveal_id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  answer_digit INTEGER NOT NULL,
  answer_label TEXT NOT NULL,
  hit INTEGER NOT NULL,
  revealed_at TEXT NOT NULL,
  official_raw_hash TEXT NOT NULL,
  FOREIGN KEY(prediction_id) REFERENCES ai_predictions(prediction_id)
);
```

### prompt_versions

```sql
CREATE TABLE prompt_versions (
  prompt_version_id TEXT PRIMARY KEY,
  position TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt_path TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  parent_prompt_version_id TEXT,
  created_at TEXT NOT NULL,
  created_from_failure_review_id TEXT,
  notes TEXT
);
```

### failure_reviews

```sql
CREATE TABLE failure_reviews (
  failure_review_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position TEXT NOT NULL,
  prediction_id TEXT NOT NULL,
  answer_label TEXT NOT NULL,
  answer_digit INTEGER NOT NULL,
  provider_kind TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  image_detail TEXT NOT NULL,
  system_prompt_version_id TEXT NOT NULL,
  business_prompt_version_id TEXT NOT NULL,
  raw_prompt_hash TEXT NOT NULL,
  raw_response_ref TEXT NOT NULL,
  failure_type TEXT NOT NULL,
  prompt_problem TEXT NOT NULL,
  repair_instruction TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Image Generation

Use a Pick3-specific renderer or adapt the current IS renderer with explicit `maxWindow=80`.

Hard window law:

```txt
L=80
```

Do not edit `trend-intuition-brain/src/is_renderer.py` in place unless the boundary file is updated. Preferred plugin-owned renderer:

```txt
pick3-is-blind-eval.image.ts
```

Image constants:

```txt
window = 80
xGap = 30px
leftMargin = 24px
rightMargin = 24px
canvasWidth = 24 + 79*30 + 24 = 2418px
canvasHeight = 300px
yRange = 0..9
shoulder = 4.5
```

Strict blind-pixel rules:

```txt
no title
no axis
no tick labels
no target phase
no date
no answer digit
no Chart #
no point-count text
no position label
no watermark
```

File naming rules:

```txt
safe: image_<opaqueImageId>.png
forbidden: 260616_hundreds_answer_4.png
forbidden: hundreds_image_001_target_260616.png
```

The sample style that shows `Chart #` or `points shown` is invalid for this executor.

Output layout:

```txt
artifactDir/
  images/
    hundreds/
      image_001_L80.png
    tens/
      image_001_L80.png
    ones/
      image_001_L80.png
  sealed_answers.json
  predictions.json
  public_results.json
  failure_reviews.json
```

Each image is generated from:

```txt
digits = position sequence[targetIndex - 80 : targetIndex]
answer = position sequence[targetIndex]
```

## AI Prediction Flow

Prediction must use AI Input Gateway or the approved web-chat provider path.

Per image payload:

```txt
system/business prompt:
  position-specific prompt version content
attachment:
  one image only
required output:
  prediction_label: front | back | abstain
  confidence: number between 0.51 and 0.60 when front/back, null when abstain
  confidence_meaning: subjective_model_strength_not_probability
  abstain_reason: required when prediction_label = abstain
  reason: one sentence
```

Every prediction call must persist:

```txt
provider_kind
model_id
temperature
image_detail
system_prompt_version_id
business_prompt_version_id
system_prompt_hash
business_prompt_hash
raw_prompt_hash
raw_response_ref
```

Forbidden payload content:

```txt
targetPhase
expectedPrizeTime
answerDigit
answerLabel
future rows
neighboring target answers
```

For 3 positions:

```txt
hundreds -> prompts/is_hundreds_blind_visual_judgment_prompt.md
tens     -> prompts/is_tens_blind_visual_judgment_prompt.md
ones     -> prompts/is_ones_blind_visual_judgment_prompt.md
```

## Reveal And Scoring

Reveal only after:

```txt
PredictionSeal exists
all expected ai_predictions rows exist
sealed_before_reveal = 1
prediction_hash computed
```

Scoring:

```ts
const answerLabel = answerDigit <= 4 ? "front" : "back";
const hit = predictionLabel === answerLabel;
```

Reports:

```txt
overall hit rate
hit rate by position
coverage rate by position
abstain count by position
miss list by position
random baseline comparison:
  one-position baseline = 50%
  three-position combination baseline = 12.5%
profitability watch threshold:
  three-position hit rate > 25%
  approximate stable per-position hit rate > 63%
confidence calibration table:
  confidence is not probability
  bucket high/medium/low confidence and compare realized hit rate
promptVersionId table
```

Scoring rules:

```txt
front/back predictions enter accuracy denominator.
abstain predictions enter coverage denominator but not hit-rate denominator.
confidence must never be converted to开奖概率.
three-position combination score is calculated only when all three positions have non-abstain predictions for the same target phase.
```

## Failure Review Flow

Input for each failed image:

```txt
position prompt version
failed image
original prediction label
original reason
answer digit
answer label
```

Required output:

```json
{
  "failureType": "momentum_overfollow | shoulder_false_break | low_rebound_missed | high_exhaustion_missed | unknown",
  "promptProblem": "...",
  "repairInstruction": "...",
  "doNotGeneralizeWarning": "..."
}
```

The reviewer may see answers. This flow is not blind.

## Prompt Rewrite Flow

For each position:

```txt
1. group failure_reviews by failureType.
2. build a prompt patch proposal.
3. create new prompt version file or DB row.
4. never overwrite old prompt version.
5. mark new prompt status = candidate.
```

Prompt file targets in trend project:

```txt
/Users/nexgen/Documents/trend-intuition-brain/prompts/is_hundreds_blind_visual_judgment_prompt.md
/Users/nexgen/Documents/trend-intuition-brain/prompts/is_tens_blind_visual_judgment_prompt.md
/Users/nexgen/Documents/trend-intuition-brain/prompts/is_ones_blind_visual_judgment_prompt.md
```

Plugin should write candidate prompts as:

```txt
prompts/candidates/is_hundreds_v{n}.md
prompts/candidates/is_tens_v{n}.md
prompts/candidates/is_ones_v{n}.md
```

Human promotion can copy candidate to active prompt.

## Failure Replay Flow

Replay only failed images with candidate prompt.

Record:

```txt
mode = failure_replay
not_valid_for_accuracy = true
sourceFailureBatchId
candidatePromptVersionId
allCorrect = boolean
```

If replay becomes all correct:

```txt
status = success
meaning = prompt now explains known failures
not meaning = future prediction improved
```

Next blind batch is mandatory for true validation.

## Main Flow

```txt
runPick3IsBlindEvalFlow(input)
  -> validate input
  -> sync official source
  -> choose target phases
  -> create blind batch
  -> generate 80-draw images by position
  -> seal answers
  -> send each image to AI
  -> persist predictions
  -> reveal answers
  -> score
  -> review failures
  -> write candidate prompt versions
  -> optionally replay failures
  -> return task record
```

## Task Modes

```ts
type Pick3IsBlindEvalMode =
  | "sync_only"
  | "generate_batch"
  | "predict_batch"
  | "reveal_batch"
  | "review_failures"
  | "rewrite_prompts"
  | "replay_failures"
  | "full_pipeline";
```

## Input Schema

```ts
type Pick3IsBlindEvalInput = {
  mode: Pick3IsBlindEvalMode;
  source: "theuaelottery";
  lotteryType?: 72;
  windowSize?: 80;
  positions?: Array<"hundreds" | "tens" | "ones">;
  targetMode?: "latest_unrevealed" | "historical_blind_batch" | "explicit_phases";
  explicitTargetPhases?: string[];
  batchSize?: number;
  trendProjectRoot: string;
  artifactRoot?: string;
  promptPaths?: {
    hundreds: string;
    tens: string;
    ones: string;
  };
  aiProvider?: "web-chat" | "ai-input-gateway";
  dryRun?: boolean;
};
```

## Output Schema

```ts
type Pick3IsBlindEvalResult = {
  taskId: string;
  mode: Pick3IsBlindEvalMode;
  status: string;
  sync: {
    rowsSeen: number;
    rowsInserted: number;
    rowsUpdated: number;
    newestPhase: string | null;
    oldestPhase: string | null;
  };
  batch?: {
    batchId: string;
    artifactDir: string;
    imageCount: number;
    sealedAnswersHash: string;
  };
  scoring?: {
    total: number;
    hits: number;
    misses: number;
    abstains: number;
    coverageRate: number;
    byPosition: Record<string, { total: number; hits: number; misses: number }>;
    randomBaseline: {
      onePositionFrontBack: 0.5;
      threePositionCombination: 0.125;
      threePositionWatchThreshold: 0.25;
      approximatePerPositionStabilityThreshold: 0.63;
    };
    calibration: Array<{
      bucket: string;
      total: number;
      hits: number;
      realizedHitRate: number | null;
      confidenceIsProbability: false;
    }>;
  };
  promptCandidates?: Array<{
    position: "hundreds" | "tens" | "ones";
    promptVersionId: string;
    path: string;
    promptHash: string;
  }>;
};
```

## BrowserController Usage

Use Chrome for verification and fallback DOM extraction:

```txt
open /lottery/pick3/results
wait for DOM content
extract first visible Draw No + digits
compare with qapi 660301 latest first row
if mismatch:
  status = review_required
  reason = official_api_dom_mismatch
```

Do not use Chrome to inspect:

- cookies;
- local storage;
- login/account state;
- balance;
- cart;
- betting plan.

Do not click:

- Play Now;
- Add;
- My Plan;
- payment;
- login;
- account controls.

## DOM Fallback Extractor

Fallback parser may read visible result text from `/lottery/pick3/results`.

Expected pattern:

```txt
Draw No.: 260616
Tuesday 21:30, 16/06/2026
4 2 7
```

Fallback extraction must be capped:

```txt
maxRows = 30
```

If more history is needed, use qapi cursor, not DOM scrolling.

## Evidence Requirements

Persist:

```txt
officialApiUrl redacted message payload
officialApiResponseHash
chromePageUrl
chromeDomProofHash
dbRunId
batchId
sealedAnswersHash
predictionHash
publicResultsHash
promptVersionHash
```

Do not persist:

- raw cookies;
- local storage;
- auth headers;
- full unrelated page HTML;
- provider private account text.

## QA Plan

Add package scripts:

```json
{
  "audit:pick3-is-blind-eval": "tsx scripts/audit/domains/pick3-is-blind-eval/inspector.ts",
  "acceptance:pick3-is-blind-eval": "tsx scripts/acceptance/pick3-is-blind-eval.acceptance.ts"
}
```

Acceptance tests:

```txt
1. encodeMessage produces official-compatible base64 JSON.
2. 660104 parser reads startTime/endTime/defaultShowDrawnResultList.
3. 660301 parser maps ["4","2","7"] to hundreds=4,tens=2,ones=7.
4. cursor payload with phase returns older phases and excludes cursor phase.
5. database upsert is idempotent.
6. gap detector flags missing dates but does not synthesize draws.
7. image renderer creates 2418x300 L80 PNG with no text pixels beyond curve/dots/shoulder.
8. one-image AI payload contains no target phase/date/answer.
9. reveal refuses to run when predictions are missing.
10. failure replay records not_valid_for_accuracy=true.
```

Manual Chrome acceptance:

```txt
1. open https://www.theuaelottery.ae/lottery/pick3
2. verify Draw No. text visible.
3. click .sensors-pick3-bet-drawresults
4. verify popup rows.
5. click View More Results.
6. verify /lottery/pick3/results and Recent Series filters.
7. compare first visible row to qapi 660301 first row.
```

Verification commands:

```bash
npm run typecheck
npm run lint
npm run audit:pick3-is-blind-eval
npm run acceptance:pick3-is-blind-eval
```

## Construction Order

1. Add schema and storage.
2. Add official API client and parsers.
3. Add sync-only flow with acceptance tests.
4. Add Chrome DOM verifier.
5. Add L80 image renderer.
6. Add blind batch generation.
7. Add AI prediction adapter.
8. Add reveal/scoring.
9. Add failure review.
10. Add prompt versioning and replay.
11. Add audit and acceptance scripts.

## Stop Conditions

Return `review_required` when:

- official API code is nonzero;
- DOM first row conflicts with API first row;
- less than 81 historical draws exist for requested target;
- generated image contains text labels;
- AI provider output cannot be parsed;
- reveal requested before predictions are sealed;
- failure replay tries to overwrite original prediction.
