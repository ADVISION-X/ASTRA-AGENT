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
  pick3-is-blind-eval.playbook.ts
  pick3-is-blind-eval.ai.ts
  pick3-is-blind-eval.scoring.ts
  pick3-is-blind-eval.failure-review.ts
  pick3-is-blind-eval.prompt-versioning.ts
  pick3-is-blind-eval.evidence.ts
  playbooks/
    system.md
    visual-grammar.md
```

Position-specific signal does not come from a hand-authored file. There is no is_hundreds_l80_v1.md / is_tens_l80_v1.md / is_ones_l80_v1.md (no "Stream A/B/C" files). All position-specific experience is assembled live from pick3_playbook_lessons; see "Prompt Rewrite Flow (Live Experience Assembly)".

Optional audit/acceptance:

```txt
scripts/audit/domains/pick3-is-blind-eval/manifest.json
scripts/audit/domains/pick3-is-blind-eval/inspector.ts
scripts/acceptance/pick3-is-blind-eval.acceptance.ts
scripts/audit/domains/pick3-is-blind-eval/inspector.ts
```

Next prediction stability extends the same Pick3 chain only:

```txt
pick3-is-blind-eval.schema.ts        add next_prediction_stability mode and result types
pick3-is-blind-eval.image.ts         build next-period image from latest confirmed L80
pick3-is-blind-eval.flow.ts          branch after official sync, before reveal/scoring
pick3-is-blind-eval.ai.ts            repeat-send the same image through Prompt Exchange
app-shell-layout.ts                  expose next_prediction_stability in the existing Pick3 form
workbench-home-pick3-client.ts       render per-repeat results from the existing start/latest routes
```

No new route, runner, provider adapter, prediction table, scoring path, or external Playbook path.

Official trend display extends the same Pick3 Workbench read model only:

```txt
pick3-is-blind-eval.trend.ts          read stored official pick3_draws and expose windowSize=80 metadata
workbench-pick3-routes.ts             add GET /api/pick3-is-blind-eval/trend inside the existing Pick3 route handler
workbench-api-boundary.ts             admit /api/pick3-is-blind-eval/trend as local UI only
workbench-pick3-support.ts            expose listPick3TrendSnapshot from the existing Workbench handle
app-shell-layout.ts                   expose Trend as an existing Pick3 workspace page
workbench-home-pick3-trend-client.ts  render fixed 80-draw three-row SVG trend with hover and drag
```

No new official source, browser scraper, route bus, storage table, prediction path, image payload path, or AI-visible trend payload.

Historical target range selection extends the same Pick3 start payload only:

```txt
pick3-is-blind-eval.schema.ts        add optional lastTargetPhase to Pick3Input
pick3-is-blind-eval.storage.ts       select eligible target draws ending at lastTargetPhase, walking backward by batchSize
pick3-is-blind-eval.flow.ts          pass lastTargetPhase into existing target selection for historical batches
app-shell-layout.ts                  expose Last target phase as a select in the existing Pick3 run form
workbench-home-pick3-target-client.ts populate the selector from stored official pick3_draws via the existing trend read model
workbench-home-pick3-client.ts       submit lastTargetPhase through POST /api/pick3-is-blind-eval/start when non-empty
```

No new route, runner, storage table, trend-driven execution path, or second target selector.

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
   - oldest expectedPrizeTime <= startTime.
7. never stop only because rows already exist; an existing latest slice does not prove the historical floor.
8. sort ascending by expectedPrizeTimestamp for image generation.
9. run `verifyPick3FullHistoryCoverage` before returning success:
   - local oldest draw date <= official `startTime`;
   - local newest draw date >= official `endTime`;
   - every calendar date from official `startTime` through official `endTime` has one stored official draw.
10. if coverage fails, return no success status and expose one of:
   - `pick3_full_history_missing_earliest`;
   - `pick3_full_history_missing_latest`;
   - `pick3_full_history_date_gap`.
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
status != success
reason = pick3_full_history_date_gap_<YYYY-MM-DD>
gapDates = [...]
```

Do not synthesize missing draws.
Do not report partial_success as acceptable full database coverage.

Full-history boundary evidence:

```txt
officialStartTime = 660104 lotteryTypePrizeTimeDto.startTime
officialEndTime = 660104 lotteryTypePrizeTimeDto.endTime
reason = pick3_full_history_missing_earliest
reason = pick3_full_history_missing_latest
reason = pick3_full_history_date_gap
```

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
  interaction_id TEXT NOT NULL,
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
  tail_shapes TEXT,
  zone_weight TEXT,
  driving_evidence TEXT,
  abstain_reason TEXT,
  reason TEXT,
  predicted_at TEXT NOT NULL,
  sealed_before_reveal INTEGER NOT NULL
);
```

### pick3_ai_interactions

```sql
CREATE TABLE pick3_ai_interactions (
  interaction_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position TEXT NOT NULL,
  prompt_package_id TEXT NOT NULL,
  prompt_contract_id TEXT NOT NULL,
  playbook_version_id TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  image_detail TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  rendered_prompt_text TEXT NOT NULL,
  input_refs_json TEXT NOT NULL,
  raw_response_text TEXT NOT NULL,
  raw_response_hash TEXT NOT NULL,
  raw_output_ref TEXT NOT NULL,
  provider_proof_json TEXT NOT NULL,
  parse_status TEXT NOT NULL,
  parse_failure_reason TEXT,
  created_at TEXT NOT NULL
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

### pick3_playbooks

```sql
CREATE TABLE pick3_playbooks (
  playbook_version_id TEXT PRIMARY KEY,
  position TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  content_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  system_prompt_hash TEXT NOT NULL,
  visual_grammar_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  parent_playbook_version_id TEXT,
  created_from_failure_review_id TEXT,
  notes TEXT
);
```

### pick3_playbook_lessons

```sql
CREATE TABLE pick3_playbook_lessons (
  lesson_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  position TEXT NOT NULL,
  image_id TEXT NOT NULL,
  prediction_id TEXT NOT NULL,
  interaction_id TEXT NOT NULL,
  failure_review_id TEXT NOT NULL,
  prompt_package_id TEXT NOT NULL,
  playbook_version_id TEXT NOT NULL,
  predicted_label TEXT NOT NULL,
  answer_label TEXT NOT NULL,
  ai_review_prompt TEXT NOT NULL,
  ai_review_raw_text TEXT NOT NULL,
  ai_review_raw_hash TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  candidate_lesson TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  aggregate_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

Lesson store rules:

```txt
source: auto_review | manual_review
status: candidate | accepted | rejected | promoted
position: hundreds | tens | ones
aggregate_key must begin with the position, e.g. tens:shoulder_false_break
free_analysis_strict_reasoning must not write pick3_playbook_lessons
```

## AGENT-Owned IS Brain

The Pick3 IS Brain is not an external project dependency. The active brain source is:

```txt
src/plugins/pick3-is-blind-eval/playbooks/
```

Required active Playbook files:

```txt
system.md
visual-grammar.md
```

No is_hundreds_l80_v1.md / is_tens_l80_v1.md / is_ones_l80_v1.md ("Stream A/B/C") files exist or are required. Position-specific signal comes only from the live-assembled experience pool, never a hand-written file.

Runtime rules:

```txt
AGENT is the only Playbook source.
No /Users/nexgen/Documents/trend-intuition-brain runtime read.
No fallback prompt path.
No bridge prompt loader.
No external prompt mirror.
```

Playbook training phases:

```txt
Phase 1 — Evidence-Mandatory Exploration (current):
  AI analyzes every chart and derives a direction conclusion from named visual evidence.
  Guessing without named evidence is forbidden. Analysis is always mandatory.
  AI must name specific shape words observed in the tail and state L80 zone weight for every prediction.
  A prediction without named evidence is invalid output.
  abstain is valid ONLY when analysis identifies both a named lower signal and a named upper signal
    of equal weight that directly cancel each other out.
  bare_low, kill_down, low_pressure are lower-leaning signals — analysis must conclude lower
    unless a named upper signal of equal or greater weight is also present.
  Confidence 0.51 = one named evidence item, no contradiction — valid analysis conclusion, not a guess.
  Confidence range: 0.51–0.75.
  Goal: collect named visual evidence from correct predictions and corrected wrong predictions.

Phase 2 — Evidence-Calibrated (future, after Phase 1 data):
  Built from Phase 1 correct evidence + corrected wrong-prediction evidence.
  Abstain rules re-introduced based on empirically observed failure patterns.
  Confidence recalibrated based on observed conditional accuracy.

Evidence collection protocol (Phase 1 → Phase 2 transition):
  Correct predictions: extract named shape words and zone weight as positive evidence.
  Wrong predictions: DO NOT show AI the correct answer first.
    Ask "what visual signal did you see that led to the wrong call, and what did you miss?"
    Use the missed signal as the corrective evidence in Phase 2.
  Do not ask AI to explain why the correct answer was correct — this produces hindsight rationalization.
```

Free Analysis Strict Reasoning experiment:

```txt
promptMode = free_analysis_strict_reasoning

This is not a loose guess mode.
It uses the same Pick3 Prompt Exchange, one-image blind payload, sealed prediction,
reveal, and scoring chain.

Workbench AI analysis mode entry:
  mode = full_pipeline or next_prediction_stability
  promptMode = user-selected free_analysis_strict_reasoning
  UI label = AI free analysis mode
  This is an AI analysis mode, not a task mode. It must not create a second
  free_analysis task mode, second Prompt Exchange, second scoring path, or second
  prediction table.

Required:
  - no direction rules
  - no fixed visual vocabulary
  - no position-specific mapping
  - no shape-to-label playbook constraints
  - mandatory chartReading
  - mandatory recentBehavior
  - mandatory supportingEvidence
  - mandatory counterEvidence
  - mandatory decisionLogic
  - mandatory zoneCount (lowerCount, upperCount as counted integers, not estimated labels)
  - mandatory patternRecurrence (named-pattern occurrence count + how many of those occurrences matched the predicted direction)
  - mandatory weakestLink (the single weakest assumption in the AI's own reasoning chain)

  zoneCount / patternRecurrence / weakestLink are probing fields, not vocabulary or direction
  rules. They force the AI to produce verifiable, countable intermediate output instead of an
  impression-based narrative, while leaving full freedom over how to interpret what it counts.

Parser rule:
  Missing or shallow chartReading / recentBehavior / supportingEvidence / decisionLogic
  is parse_failed_raw_available and blocks reveal/scoring.
  Missing zoneCount (must be two non-negative integers), missing patternRecurrence,
  or missing weakestLink is also parse_failed_raw_available.

Forbidden:
  - V1 tailShapes / zoneWeight / visual-grammar constraints inside Free Analysis
  - second AI transport chain
  - second prediction table
  - second scoring path
  - counting a run clean when any image lacks prompt-submitted and answer-captured proof
```

The active Playbook may contain:

```txt
mission
image law
position stream boundary
visual grammar
decision rules
confidence discipline
abstain rules (Phase 2 only)
evidence requirement
failure risk language
output schema
```

The active Playbook must not contain:

```txt
targetPhase
expectedPrizeTime
answerDigit
answerLabel
concrete historical failed-case answer memory
future results
lottery source outside UAE Pick 3
betting advice
```

Failure examples with revealed answers belong only in `failure_reviews`, candidate repair notes, or diagnostic replay records. They are not part of the blind prediction payload.

Playbook prompt package:

```ts
type Pick3PlaybookPromptPackage = {
  playbookVersionId: string;
  position: "hundreds" | "tens" | "ones";
  systemPrompt: string;
  businessPrompt: string;
  systemPromptHash: string;
  businessPromptHash: string;
  visualGrammarHash: string;
  rawPromptHash: string;
  confidenceIsProbability: false;
  allowedLabels: ["lower", "upper", "abstain"];
  imageRef: {
    imageId: string;
    imageSha256: string;
  };
};
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
trailingBlank = 50px  ← blank space to the right of the last data point
canvasWidth = 24 + 79*30 + 24 + 50 = 2468px
canvasHeight = 300px
yRange = 0..9
shoulder = 4.5

trailingBlank purpose: creates a visible "next-point space" on the right edge.
The AI sees the line ending with open space ahead, signalling the series is incomplete
and a continuation value is expected — improving spatial awareness of the prediction task.
The midline extends into the trailing blank (x2 = canvasWidth - 24).
Data points are unchanged; only the canvas is wider.

shoulder = 4.5 is an internal rendering constant only. The chart has no axis labels, so
prompt text sent to the AI must never name this position as "4.5" — that would give the AI
an unverifiable number it cannot check against an unlabeled image. All AI-facing prompt and
playbook text must call it "the red dashed horizontal line" instead.

midlineStrokeColor = #dc2626 (red)
midlineDashPattern = 8px 6px dash-gap (logical px, scaled by IMAGE_SCALE in code)
midline was previously a solid gray (#d1d5db) line; switched to red dashed to increase
contrast against the blue (#2563eb) solid data line, after observing the AI losing track
of the midline when scanning dense oscillation regions.
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

### Historical Target Range Selection

Default historical batch selection:

```txt
eligible target draws = stored official pick3_draws where targetIndex >= 80
targetDraws = latest eligible target draws limited by batchSize
```

Optional ending phase selection:

```txt
lastTargetPhase = operator-selected stored official phase
eligible target draws = stored official pick3_draws where targetIndex >= 80 and targetIndex <= lastTargetPhase index
targetDraws = last batchSize eligible draws ending at lastTargetPhase
```

Rules:

```txt
lastTargetPhase is selected from a Workbench dropdown populated from stored official pick3_draws through the existing Pick3 read model, then accepted only through the existing POST /api/pick3-is-blind-eval/start payload.
The phase must resolve against stored official pick3_draws; no external source, fixture row, DOM scrape, or trend UI state may become target truth.
The selected target phase itself is the answer/reveal phase; the blind image still uses only the 80 draws before it.
If lastTargetPhase is empty, behavior stays latest eligible targets.
If lastTargetPhase does not exist, or it exists before 80 prior draws are available, the batch is not generated.
The UI must not use a free-form text box for lastTargetPhase in production.
```

Mode boundary:

```txt
generate_batch: lastTargetPhase may control historical target range.
full_pipeline: lastTargetPhase may control historical target range.
next_prediction_stability: lastTargetPhase is ignored; batchSize remains repeat-send count for the same next-period image.
sync_only: lastTargetPhase has no effect.
```

### Next Prediction Stability Image

Mode:

```txt
next_prediction_stability
```

This is a next-period stability observation mode, not historical scoring.

Precondition:

```txt
PICK3_OFFICIAL_SYNC must return status=success with full official coverage.
If latest official data is not fully confirmed, stop before image generation.
```

Image construction:

```txt
visible = latest confirmed 80 official draws
targetPhase = next_after_<latest official phase>
answerDigit = null
answerLabel = null
```

For each selected position:

```txt
generate exactly 1 blind L80 image
do not generate batchSize images
do not persist reveal/scoring artifacts
do not claim accuracy before the official answer exists
```

AI analysis mode:

```txt
promptMode is the user-selected AI analysis mode.
promptMode=playbook_v1 -> use the existing Playbook prompt package.
promptMode=free_analysis_strict_reasoning -> use the existing Free Analysis Strict Reasoning prompt package.
Do not hardcode, override, or silently coerce next_prediction_stability to one promptMode.
```

The blind-pixel rules are identical to historical batches: no title, axis, tick label, target phase, date, answer, Chart number, point count, position text, or watermark.

## AI Prediction Flow

Prediction must use Pick3 Prompt Exchange. The exchange is intentionally aligned with Deep Research Analysis:

```txt
SEND
  build one-image prompt package
  compute prompt hash
CAPTURE
  call Pick3GatewaySender / AI Input Gateway compatible sender
  capture raw GPT/web-chat output
  capture providerProofJson
PARSE
  parse predictionLabel/confidence/tailShapes/zoneWeight/drivingEvidence/discountedEvidence/reason/abstainReason
  keep parse_failed_raw_available interactions
PERSIST
  write pick3_ai_interactions first
SEAL
  create ai_predictions only from parsed interactions
REVEAL
  compare sealed predictions against official stored answers
```

Manual GPT chat is allowed only as the capture surface behind `Pick3GatewaySender`. It must return raw output and provider proof into `pick3_ai_interactions`; it must not write `ai_predictions` directly.

GPT workspace law:

```txt
Pick3 must use one AI Input Gateway web-chat workspace:
  workspaceId = pick3-is-blind-eval

For each one-image prompt:
  focus the same ChatGPT provider tab
  click New chat inside that tab
  upload exactly one image
  send prompt
  verify the last submitted user message contains the bound image attachment
  capture response

Forbidden:
  one browser tab per image
  untracked ChatGPT tab cleanup
  accepting GPT JSON when the last submitted user message has no image
```

Workbench runtime entry:

```txt
src/lib/local-runtime/workbench-pick3-support.ts
  -> reuse assembly.aiInputGateway
  -> pick3GatewaySender(input) = assembly.aiInputGateway.execute(input)
  -> runPick3IsBlindEvalFlow({ mode: "full_pipeline" }, context)
```

App Shell must expose:

```txt
mode = full_pipeline
source label = Full pipeline via GPT web chat
default zh label = 通过 GPT 网页聊天运行完整链路
providerKind = gpt-web-chat | gemini-web-chat
promptMode = playbook_v1 | free_analysis_strict_reasoning
AI analysis mode = Playbook mode | AI free analysis mode
Gemini DOM evidence:
  composer = div[role="textbox"][contenteditable="true"][aria-label="Enter a prompt for Gemini"]
  fresh conversation = navigate the existing Gemini workspace tab to https://gemini.google.com/app before every Pick3 image; verified empty state has userQueryCount=0 and no "Gemini said" answer text.
  upload = same macOS clipboard file-object paste flow as GPT after focusing the Gemini composer
  upload probe = after file-object paste, composer attachment preview was visible within about 1 second, while clipboard text paste still produced composerText=""
  prompt entry = for Gemini, focus the verified Quill composer and use real clipboard paste immediately after upload; do not spend the generic 20s GPT clipboard-paste verification window before diagnosing Gemini prompt entry
  composer readiness = for Gemini, wait up to 60s for the fresh /app composer; if one active-tab DOM probe times out at 10s, log provider_composer_ready_probe fallback and keep waiting inside the same composer-ready window
  workspace URL persistence = if the active-tab DOM probe used to read the provider workspace URL times out after a completed provider response, fall back to browser.getSessionState().currentUrl rather than failing the one-image exchange
  provider error page recovery = if Chrome reports chrome-error://chromewebdata/ before attachment upload, reopen the provider home in the same workspace tab and re-assert the provider host; do not do this after upload or prompt submission because it could clear an in-flight prompt
  prompt paste retry = if Gemini paste verification returns composerChars=0 or prompt prefix missing, retry inside gemini_clipboard_prompt_paste with verified composer focus and replacing clipboard paste before escalating to one-image retry
  pre-submit snapshot = skip for Gemini Pick3 because each image opens a fresh /app conversation; log pre_submit_snapshot skipped fresh_gemini_pick3_conversation instead of waiting for a stable assistant answer before prompt entry
  prompt probe = direct textContent/execCommand writes do not reliably update Gemini's Quill editor for the 10k Pick3 prompt; real paste produced <p>short quill paste probe</p> in the composer DOM
  timing logs = [GRASSEYE][AI-GATEWAY][WEB-CHAT] must show provider_composer_ready, upload_file_clipboard_paste, pre_submit_snapshot, prompt_prepare, gemini_clipboard_prompt_paste, verify_attachments_before_submit, and prompt_submit elapsedMs
  submitted user message proof = user-query-content / .user-query-container contains both prompt text and an image/file preview
  Gemini DOM selectors and submitted-message proof must stay in the Gemini web-chat provider layer, not inside GPT-specific recovery code.
  Never stack multiple Pick3 images into one Gemini conversation; prior prompts/answers would contaminate blind isolation.
```

Per image payload:

```txt
identity:
  imageId = opaque image id
  promptPackageId = active playbook package id

system/business prompt:
  de-lotteried anonymous time-series prompt
  no Pick3 / UAE / lottery / digit-game wording
  position-specific prompt version content
attachment:
  one image only
AI-visible required output:
  imageId: exact input imageId
  promptPackageId: exact input promptPackageId
  predictionLabel: lower | upper | abstain
  confidence: number between 0.51 and 0.75 when lower/upper (Phase 1), null when abstain
  confidence_meaning: subjective_model_strength_not_probability
  tailShapes: array of named grammar shape/motion words observed in the last 3–8 points (required, min 1 item)
             VOCABULARY RESTRICTION: values must be drawn exclusively from the visual-grammar.md word list.
             Valid words: surge_up, rise, slow_rise, hold, slow_fall, upper_fall, kill_down,
               sharp_top, sharp_bottom, bare_low, upward_inertia, downward_inertia,
               shoulder_return, shoulder_reject, shoulder_hold, high_pressure, low_pressure,
               high_to_shoulder_edge, oscillation_hold_upper, disordered_chop.
             Informal descriptors (climb, ascending, drop, descend, etc.) are invalid and cause parse failure.
  zoneWeight: "lower_weighted" | "upper_weighted" | "balanced" — L80 overall zone weight (required)
  drivingEvidence: one sentence naming the specific shape that determined the direction (required)
  discountedEvidence: one sentence naming any opposing signal noticed but not allowed to override the conclusion,
                      or null if no opposing signal was observed (required; must not be empty string)
                      CONTRARIAN RULE: when the model's own analysis (informed by live-assembled
                      experience or its own reading of the image) overrides the standard grammar
                      interpretation of a named shape, the standard grammar interpretation being
                      overridden IS the discounted evidence — discountedEvidence must NOT be null.
                      Example: "Standard grammar classifies shoulder_hold as upper evidence; this
                      override treats it as lower because high_pressure is absent in this image."
  reason: full analytical summary — tail shapes observed, zone weight, conclusion chain (not one sentence; must be complete)
  abstainReason: required when predictionLabel = abstain, must name both conflicting lower and upper signals

Phase 1 output contract purpose:
  tailShapes, zoneWeight, drivingEvidence, discountedEvidence are the V2 evidence extraction fields.
  Every correct prediction: tailShapes + drivingEvidence become positive V2 rules.
  Every wrong prediction: discountedEvidence reveals which opposing signal was noticed but overridden
    — V2 correction rules are built from this WITHOUT showing the correct answer first (prevents hindsight rationalization).
  reason provides the full analytical chain for human review.

Internal mapping:
  lower -> front
  upper -> back
  abstain -> abstain

Contract lock:
  AI-visible prompt package allowedLabels = lower | upper | abstain
  rendered GPT output contract = lower | upper | abstain
  parser accepts only lower | upper | abstain before mapping
  front/back are internal reveal/scoring labels only
  acceptance and audit must fail if these layers disagree
```

### Next Prediction Stability Flow

Purpose:

```txt
Send the same next-period image to the selected AI provider multiple times
so the operator can inspect output drift.
```

Execution order:

```txt
1. Sync official UAE Lottery Pick 3 data and verify full official coverage.
2. Build exactly one next-period blind L80 image per selected position.
3. Build the governed prompt package selected by user `promptMode` for each image.
4. Expand the AI Prompt Exchange request list by repeat index.
5. Each repeat sends one image only through Pick3GatewaySender / AI Input Gateway.
6. Persist each raw interaction and parsed prediction.
7. Write stability_results.json.
8. Stop; do not reveal, score, classify hit/miss, or write failure-review repair.
```

`batchSize` meaning in this mode:

```txt
batchSize = repeat-send count for the same image
```

It is not a target draw count.

Result row shape:

```ts
type Pick3StabilityResult = {
  position: "hundreds" | "tens" | "ones";
  imageId: string;
  repeatIndex: number;
  interactionId: string;
  predictionId: string | null;
  predictionLabel: "front" | "back" | "abstain" | null;
  visiblePredictionLabel: "lower" | "upper" | "abstain" | null;
  confidence: number | null;
  parseStatus: "parsed" | "parse_failed_raw_available";
  parseFailureReason: string | null;
  rawOutputRef: string;
};
```

Display rule:

```txt
Show every position/repeat row.
Do not show a final choice.
Do not show "recommended", "should pick", "majority result", "vote winner", or betting wording.
The operator makes the judgment manually.
```

Empty web-chat capture retry:

```txt
If AI Input Gateway returns empty normalizedText:
  retry the same one-image prompt once through the same AI Input Gateway sender
  do not create a Pick3 interaction for the empty transport attempt
  if the local retry still has no parsed result, defer that image/repeat into the same Prompt Exchange completion queue
  continue sending the remaining images/repeats before returning to deferred work

If response is structured JSON but predictionLabel is an explicit directional synonym (`rise`, `rising`, `up`, `upward`, `upper`, `fall`, `falling`, `down`, `downward`, or `lower`):
  normalize through the directional alias whitelist
  continue normal confidence and evidence validation
  do not treat the normalized alias as a retry-worthy parse failure

If response is structured JSON but predictionLabel is an explicitly non-directional invalid word (`hold`, `neutral`, `flat`, `sideways`, `unclear`, or `no_direction`):
  normalize to internal abstain with null confidence
  set abstainReason to non_directional_prediction_label_<word> when the provider omitted one
  never map the non-directional word to lower/upper

If response is structured JSON but predictionLabel is another invalid shape word:
  retry the same one-image prompt once through the same AI Input Gateway sender
  do not map the shape word to lower/upper
  do not create a Pick3 interaction for the first invalid-label attempt
  if the local retry still has no parsed result, defer that image/repeat into the same Prompt Exchange completion queue

If provider-reported missing image text is returned (`未收到图片`, no image, cannot see image, or equivalent):
  retry the same governed one-image prompt package and same image three local retries
  do not map the missing-image text to abstain, lower, or upper
  if one of the three local retries parses, persist only the parsed interaction and sealed prediction
  if all three local retries still report missing image, persist one terminal skipped interaction:
    parse_status = skipped_provider_reported_image_missing
    parse_failure_reason = pick3_provider_reported_image_missing_retry_exhausted
  skipped provider-reported-missing-image interactions do not create ai_predictions
  skipped provider-reported-missing-image interactions do not reveal, score, or create Playbook lessons
  continue sending the remaining images/repeats; this condition must not stop the full batch or next-stability task

If retry still returns empty:
  schedule deferred_retry_scheduled unless completion rounds are exhausted
  after completion rounds are exhausted, create parse_failed_raw_available from final raw response
  stop before reveal/scoring only if unresolvedCount > 0

If response is non-empty but invalid JSON:
  do not guess repair
  defer through the same Prompt Exchange completion queue before persisting a final unresolved interaction
  after completion rounds are exhausted, parse_status = parse_failed_raw_available
  stop before reveal/scoring only if unresolvedCount > 0
```

### Prompt Exchange Completion Queue

Production-grade Pick3 batches must converge inside the existing Prompt Exchange instead of stopping on the first one-image failure.

```txt
Initial pass:
  build all image/repeat requests in the existing order
  for each request, run the existing one-image send attempt and its local retry rules
  parsed result -> persist the parsed interaction and sealed prediction
  skipped provider-reported-missing-image result -> persist the skipped interaction and continue
  unresolved result -> do not persist as terminal yet; enqueue the same request for completion

Completion pass:
  keep using the same Pick3GatewaySender and AI Input Gateway one-image path
  add a completion round suffix to roundId only for traceability
  resend the same imageId + promptPackageId + one-image payload
  continue until all requests parse or bounded completion rounds are exhausted

Terminal rule:
  expectedCount = images.length * repeatCount
  completedCount = final parsed predictions + skipped provider-reported-missing-image interactions
  deferredRetryCount = number of queued completion retries
  skippedCount = number of skipped provider-reported-missing-image interactions
  unresolvedCount = expectedCount - completedCount
```

If `unresolvedCount = 0`, full_pipeline may continue to reveal/scoring even if earlier transient web-chat sends failed before a later completion round recovered or a provider-reported missing-image request was skipped after three local retries. Skipped requests are not predictions and are not valid for accuracy.

If `unresolvedCount > 0`, write the prompt-exchange failure artifacts and stop before reveal/scoring with `review_required`.

Forbidden:

```txt
second provider adapter
second transport path
second prediction table
second scoring path
skipping remaining images because one image failed
infinite retry loop
persisting an interim failed attempt as the final result when a later completion round succeeds
```

Submitted image binding proof:

```txt
Pre-submit attachment count is only readiness:
  composer-scoped count can allow submit
  global attachment count can only allow a submit attempt when followed by post-submit binding proof

After submit, Pick3 must prove:
  last [data-message-author-role="user"] message contains at least one real image/attachment candidate
  Add Files buttons, profile/avatar controls, menus, and stale global attachments are excluded

Implementation:
  Script builder: buildVerifyLastUserMessageAttachmentsScript(expectedCount)
  File: src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts
  Called through: verifyLastUserMessageAttachments (web-chat-submit-page-actions.ts)
  Runtime gate: submitPromptViaClipboard waits after verified submit before answer extraction
  Scopes to: last visible [data-message-author-role="user"] element only
  Excluded: Add Files, profile/avatar/account/menu/button/send controls
  Size guard: tiny invisible candidates are excluded
  Returns:
    status:"success" -> continue to answer extraction
    repeated pending until timeout -> throw review_required: provider_missing_bound_image

If proof fails:
  status = provider_missing_bound_image
  do not persist pick3_ai_interactions
  do not create ai_predictions
  do not reveal
  do not score
  abandon the failed current ChatGPT conversation without deleting provider history
  reopen new chat in the same pick3-is-blind-eval workspace tab
  resend the same governed one-image prompt package and image once
  if the second submit is still missing the bound image, stop as review_required
  Recovery path: isPick3MissingBoundImageError + recoverPick3MissingBoundImageConversation (web-chat-shared.ts)
  missingBoundImageRecovered flag prevents infinite loop (max 1 recovery attempt)
```

Pick3 GPT rate-limit immediate acknowledgement:

```txt
If ChatGPT shows a rate-limit dialog:
  Chinese signals:
    请求过于频繁
    请稍等几分钟后再重试
  English signals:
    too many requests
    request too frequent
    try again later
    temporarily limited

The dialog is provider throttling, not model output.
It must not create ai_predictions.
It must not reveal or score the batch.

Handling:
  after the ChatGPT provider workspace opens, start startPick3RateLimitDialogWatcher on the same BrowserController
  keep the watcher active until the web-chat feed exits
  immediately click 明白了 / OK / Got it through BrowserController native click
  verify the rate-limit dialog disappeared after the click
  emit terminal stdout line for ack result
  continue the existing web-chat loop that was interrupted by the dialog
  do not refresh
  do not reopen the provider page
  do not open a new chat
  do not restart the task
  do not resend the image or prompt
  do not create a second route inside the acknowledgement helper

Terminal stdout format:
  [GRASSEYE][PICK3][RATE_LIMIT] mission=<missionKey> imageId=<imageId> promptPackageId=<promptPackageId> attempt=N phase=immediate_acknowledgement_result totalWaitSec=0 elapsedSec=0 remainingSec=0 recoveryAction=pick3_rate_limit_immediate_acknowledgement_completed — ackStatus=rate_limit_ack_clicked_and_dialog_closed

Immediate acknowledgement rule:
  first rate-limit occurrence:  click acknowledgement immediately
  second rate-limit occurrence: click acknowledgement immediately
  third rate-limit occurrence:  click acknowledgement immediately
  every later visible occurrence: click acknowledgement immediately

The schedule must not wait before clicking the acknowledgement.
After each verified acknowledgement, the current web-chat loop must continue.

Runtime logs and terminal stdout must include imageId, promptPackageId, missionKey, attempt, and recoveryAction.

After each detected rate-limit dialog:
  RECOVERY_STARTED reason=pick3_rate_limit_immediate_acknowledgement_started
  click the rate-limit acknowledgement
  verify the dialog is closed
  RECOVERY_COMPLETED / RECOVERY_FAILED reason=pick3_rate_limit_immediate_acknowledgement_completed|failed

The following waits must call the visible-dialog acknowledgement guard before each poll:
  pre-submit conversation snapshot
  prompt pasted verification
  prompt submitted verification
  submitted user-message attachment verification
  send-button readiness wait
  response capture

The lifecycle watcher covers the gaps between those waits:
  attachment upload
  composer focus
  clipboard paste
  provider generation
  browser wait phases
  any other in-feed pause while the ChatGPT workspace tab is active

Forbidden rate-limit side effects:
  no openProviderPage because of the rate-limit dialog
  no new ChatGPT conversation because of the rate-limit dialog
  no same-payload resend because of the rate-limit dialog
  no providerRecoveryStatus that claims rate-limit resend recovery
  no review_required merely because the acknowledgement count reached a cap

Provider proof:
  rate-limit acknowledgement is terminal/log proof only

Pick3 post-parse throttle delay (pick3-is-blind-eval.ai.ts):
  trigger: result.parsed is truthy in runPick3PromptExchange's queue loop (a successful parse)
  delayMs = randomPick3PostParseDelayMs() = random integer in [5000, 30000], re-rolled every time
  terminal log: post_parse_throttle_delay imageId=<imageId> position=<position> delayMs=<delayMs>
  purpose: sending too fast triggers ChatGPT rate-limit popups (请求过于频繁) more often
  scope: only after a successful parse; a failed/retried attempt does not get this extra delay on top of its own retry path
  providerRecoveryStatus is not used to claim a rate-limit resend recovery

Implementation:
  logger source = Workbench runtimeLogger
  injection path = createWorkbenchAiInputGateway -> AiInputGatewayExecutionContext -> AiProviderAdapterContext
  helper = web-chat-pick3-recovery-log.ts
  acknowledgement helper = acknowledgePick3RateLimitDialogIfVisible
  lifecycle watcher = startPick3RateLimitDialogWatcher
  no private console.log / JSONL / second log chain
```

Pick3 GPT no-result recovery:

```txt
If the Pick3 GPT web-chat prompt has been submitted and no provider result is captured after 200 seconds:
  refresh the current ChatGPT conversation URL in the same workspace tab
  do not delete that current ChatGPT conversation history entry while provider history deletion is temporarily disabled
  reopen https://chatgpt.com/ in the same workspace tab
  click New chat through the existing AI Input Gateway openProviderPage path
  resend the same governed one-image prompt package exactly once
  persist providerProof.providerRecoveryStatus
  persist providerProof.providerRecoveryAttemptCount = 1

This recovery is Pick3-only.
It must not create a second GPT browser tab per image.
It must not delete untracked or user-owned ChatGPT history.
Current conversation history deletion status:
  current_history_delete_temporarily_disabled
  does not block same-workspace new-chat recovery
```

Pick3 GPT workspace tab identity:

```txt
workspaceId = pick3-is-blind-eval
workspace tab anchor = https://chatgpt.com/
conversation ledger entries = https://chatgpt.com/c/<conversation-id>
Gemini workspace tab anchor = https://gemini.google.com/app
Gemini conversation ledger entries = https://gemini.google.com/app/<conversation-id>

The workspace tab anchor and conversation ledger are different facts.
Do not save a /c/<conversation-id> URL as the workspace tab anchor.
Do not use reuse-exact-url against a /c/<conversation-id> URL to find the Pick3 workspace tab.
Record Gemini /app/<conversation-id> URLs in the same provider-specific conversation ledger after response capture, otherwise history cleanup cannot protect the current and immediately previous Gemini conversations.
Use host/workspace tab reuse for Pick3:
  focus any existing chatgpt.com provider tab owned by the workspace when available
  otherwise open https://chatgpt.com/ with reuse-host-tab
  then click New chat inside that same tab

Provider proof must show:
  webChatWorkspaceId = pick3-is-blind-eval
  providerTabPolicy = reuse-single-provider-workspace-tab

This is the production guard against one browser tab per image.
```

Pick3 source-restore policy:

```txt
If GPT raw output has already been captured, a post-response source page restoration failure must not erase the raw output.
The provider proof must keep restoredSourcePage=false.
This exception is Pick3-only because no downstream DOM action depends on the source workbench tab after one-image GPT capture.
```

Every prediction call must persist:

```txt
prompt_package_id
prompt_contract_id
raw_response_text
raw_response_hash
raw_output_ref
provider_proof_json
parse_status
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
provider_proof_json.webChatWorkspaceId
provider_proof_json.providerTabPolicy
provider_proof_json.providerRecoveryStatus
provider_proof_json.providerRecoveryAttemptCount
provider_proof_json.staleConversationCleanupStatus
provider_proof_json.staleConversationHistoryCleanupStatus
```

Hard binding rule:

```txt
If GPT output imageId != active image.imageId:
  parse_status = parse_failed_raw_available
  no ai_predictions row
  no reveal

If GPT output promptPackageId != active promptPackage.playbookVersionId:
  parse_status = parse_failed_raw_available
  no ai_predictions row
  no reveal

If any one-image interaction has parse_status = parse_failed_raw_available:
  stop full_pipeline
  status = review_required
  reached_step = ai_prompt_exchange_failed
  no reveal
  no scoring
```

GPT cleanup rule:

```txt
AI Input Gateway keeps a Pick3 workspace conversation ledger.
After a response is captured:
  record current ChatGPT conversation URL
  retain up to 100 provider conversation URLs so a 25-batch three-position Gemini run can be cleaned from ledger evidence
  keep current and immediately previous Pick3 conversation tabs
  close only older recorded Pick3 conversation tabs
  do not truncate the provider conversation ledger during stale tab closure
  temporarily skip provider sidebar history deletion
  return provider_history_delete_temporarily_disabled for stale provider-history cleanup
  return current_history_delete_temporarily_disabled for current-conversation cleanup attempts
  never delete the current or immediately previous protected workspace URLs
  persist staleConversationHistoryCleanupStatus in provider proof
  do not convert disabled cleanup into parse_failed_raw_available after the AI answer already parsed
  log cleanupStatus beside parse_result so runtime hygiene status stays visible without corrupting prediction parsing

Never close arbitrary user ChatGPT tabs.
Never delete arbitrary user ChatGPT sidebar history.
Never open provider history sidebars, click Delete, or confirm Delete chat? while provider history deletion is temporarily disabled.
Never depend on browser tab title to identify Pick3 ownership.

Temporary provider-history deletion disable rule:
  reason = deleting provider conversation history triggers data-protection / history-access rate limits such as 请求过于频繁
  stale provider-history cleanup status = provider_history_delete_temporarily_disabled
  current provider-history cleanup status = current_history_delete_temporarily_disabled
  preserve workspace conversation ledger
  preserve stale provider-tab cleanup
  do not open ChatGPT or Gemini history sidebars for deletion
  do not click conversation menus
  do not click Delete
  do not confirm Delete chat?
  continue training when this disabled cleanup status is returned

Gemini pre-image cleanup rule:
  before every Gemini Pick3 attachment upload, run pre_image_history_cleanup in the existing Gemini workspace tab
  return provider_history_delete_temporarily_disabled while provider history deletion is disabled
  emit terminal-visible pre_image_history_cleanup timing logs with the cleanup status
  do not block attachment upload for visible stale Gemini provider history while provider history deletion is disabled

Controlled Pick3 training title allowlist:
  Pick3 Blind Eval
  Blind Eval
  Blind Chart
  Blind Time-Series
  Blind Series
  Visual Pattern Prediction

These titles are cleanup ownership hints only. They are not prediction input and must not be inserted into the blind prompt payload.
If cleanup sees a matching visible sidebar record outside the current and immediately previous protected URLs:
  it must attempt delete through the verified sidebar delete path
  refresh/reopen https://chatgpt.com/ in the same workspace tab
  verify the /c/<id> pathname is absent from visible sidebar anchors
  report failed_N when any non-protected training title remains visible
```

Live Chrome deletion verification, 2026-06-17:

```txt
Observed ChatGPT sidebar order:
  1. Blind Time-Series Evaluation -> /c/6a32e2f5-0a6c-83ed-bbc0-ac5925e9acb8
  2. Blind Time-Series Evaluation -> /c/6a32e2d1-7a28-83eb-8314-0271b18407b6
  3. Blind Chart Evaluation -> /c/6a32e2b1-a428-83eb-9899-eb9705776efd

Verified deletion path:
  1. Locate conversation row via a[href] matching target URL/path
  2. scrollIntoView({block:"center"}) the row
  3. browser.move? to hover native point + dispatch JS mouseenter/mouseover events on row as mandatory fallback
  4. Wait 600ms for ChatGPT to render the "…" options button
  5. Poll for options button via bounding-box overlap check, up to 1000ms total
  6. Click options button through BrowserController native browserViewport point
  7. Wait 350ms; locate menu item 删除
  8. Click 删除 through BrowserController native browserViewport point
  9. Wait 350ms; locate confirm 删除
  10. Click confirm through BrowserController native browserViewport point
  11. Reopen https://chatgpt.com/ in the same workspace tab
  12. Verify the deleted /c/<id> path is absent from visible sidebar anchors

Hover implementation rule:
  browser.move? is an optional chain — if native hover is unavailable, it silently no-ops.
  JS mouseenter/mouseover dispatch on the row element is MANDATORY as a co-trigger so the
  "…" button always appears even when native hover does not fire.
  Wait must be 600ms after hover (not 250ms) to allow ChatGPT animation to complete.
  Poll for button appearance for up to 1000ms after the 600ms wait before declaring failure.

Composer focus rule:
  Before every focusComposer call, dismiss any floating menus or dialogs via:
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}))
    + blur active element
  Wait 200ms after dismiss before calling focusComposer.
  waitForComposerFocused timeout cap must be 5000ms (not 2000ms).

Critical production rules:
  Do not verify against the old DOM immediately after confirm 删除.
  ChatGPT can leave the deleted conversation link in the current DOM until sidebar refresh.
  Verification must refresh/reopen the ChatGPT home sidebar, then compare by conversation pathname.
  Do not use synthetic element.click() as the production deletion action.
```

Prompt Exchange source file:

```txt
src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts
```

Scoring source file:

```txt
src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts
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

For all 3 positions (hundreds, tens, ones), the shared system.md + visual-grammar.md are used; each position's own experience comes only from filtering pick3_playbook_lessons by that position, not from a separate per-position file.

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

Classifier coverage:

```txt
low_rebound_missed: rebound, sharp_bottom, bare_low
high_exhaustion_missed: top, sharp_top, high_to_shoulder_edge
shoulder_false_break: shoulder, shoulder_hold, shoulder_return, shoulder_reject
momentum_overfollow: momentum, inertia, surge_up, kill_down
unknown: only when no current Playbook visual grammar family is present
```

## Playbook Lesson Store Flow

Law:

```txt
GRASSEYE-PICK3-PLAYBOOK-LESSON-STORE-011-V1
```

Automatic path:

```txt
full_pipeline + promptMode=playbook_v1 completes reveal/scoring
  -> compare sealed prediction with official answer
  -> for every failed position, create failure_review
  -> build one evidence package per failed position
  -> send the same failed image plus historical prompt and raw AI reply to AI
  -> persist pick3_playbook_lessons with source=auto_review and status=candidate
```

Manual path:

```txt
History tab phaseReports miss position
  -> human clicks manual Playbook review for that phase + position
  -> system rebuilds the same historical evidence package
  -> AI returns a new post-mortem analysis
  -> persist pick3_playbook_lessons with source=manual_review and status=candidate
```

Evidence package:

```txt
phase
position
failed image
historical renderedPromptText
historical rawResponseText
sealed predictionLabel
revealed answerLabel
failureReview.promptProblem
playbookVersionId
promptPackageId
rawResponseHash / rawOutputRef
```

AI review prompt boundary:

```txt
Do not make a new prediction.
Do not change historical prediction.
Do not propose a Playbook rewrite yet.
Analyze only why this already sealed Playbook prediction was wrong.
Return rootCause and candidateLesson.
```

Reply parse failure handling:

```txt
If the reply does not parse into a valid {rootCause, candidateLesson} JSON object, retry the same failure up to PICK3_PLAYBOOK_REVIEW_MAX_ATTEMPTS = 3 attempts total.
If all 3 attempts fail to parse, discard this failure entirely; do not store a placeholder lesson (no manual_review_required, no ai_review_raw_text_not_json content) in pick3_playbook_lessons.
A discarded failure simply produces no lesson for that batch; it may be picked up again by a later manual review or a later auto_review run.
```

Position isolation:

```txt
hundreds lessons aggregate only with hundreds lessons.
tens lessons aggregate only with tens lessons.
ones lessons aggregate only with ones lessons.
Counts from different positions must never be merged into a shared N.
```

Promotion boundary:

```txt
One accepted lesson is already experience: there is no minimum lesson count before a position/aggregateKey is extracted.
Zero lessons for a position means there is nothing to extract yet, not that a count was withheld.
Every non-rejected lesson is assembled live into the blind prompt payload at prompt-build time, as soon as it exists.
A single failed phase already enters the blind prompt payload the next time a prompt is built; the only filter is rejected status, never a minimum-count gate or a human content judgment.
```

## Prompt Rewrite Flow (Live Experience Assembly)

There is no candidate Playbook file, no human promotion step, and no minimum lesson count. Experience inclusion is purely mechanical (the lesson exists and is not rejected), because the content itself is AI-summarized experience, not a hand-written rule, so there is nothing for a human to approve and nothing to wait to accumulate.

For each prompt package built (every batch, every image), at the moment `buildPick3PlaybookPromptPackage` runs:

```txt
1. read all non-rejected pick3_playbook_lessons for that exact position (storage.listPlaybookLessonsByPosition).
2. group lessons by aggregate_key.
3. every group with at least one non-rejected lesson is included (assemblePick3ExperienceSection in pick3-is-blind-eval.prompt-versioning.ts) — no minimum count.
3b. within an included group, every case is rendered in full — code never selects a "latest" or "representative" case and never summarizes multiple cases into one, no matter how many cases accumulate (1 case or 10,000 cases). Dead code has no standing to judge or compress dynamically generated AI content; only the AI reading the full text at prediction time may weigh which cases matter.
4. render the included groups as a "historical experience reference, not a hard rule" text block.
5. splice that block into businessPrompt, between visual-grammar.md and the position playbook file, before the image payload line.
6. this recomputes from scratch every time; nothing is cached, saved as a file, or versioned as a separate Playbook artifact.
```

The active Playbook files under `src/plugins/pick3-is-blind-eval/playbooks/` (`system.md`, `visual-grammar.md`) are never edited or replaced by this flow. Only the assembled prompt text changes as lessons accumulate; the on-disk files stay fixed. Traceability comes from `pick3_ai_interactions.rendered_prompt_text` and `business_prompt_hash`, which capture exactly which experience text was used for every single image, every single time — not from a versioned candidate file.

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
  -> send each image through Pick3 Prompt Exchange
  -> persist pick3_ai_interactions
  -> parse interactions
  -> persist sealed predictions
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
  promptMode?: "playbook_v1" | "free_analysis_strict_reasoning";
  source: "theuaelottery";
  lotteryType?: 72;
  windowSize?: 80;
  positions?: Array<"hundreds" | "tens" | "ones">;
  targetMode?: "latest_unrevealed" | "historical_blind_batch" | "explicit_phases";
  explicitTargetPhases?: string[];
  batchSize?: number;
  artifactRoot?: string;
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
    officialStartTime: string;
    officialEndTime: string;
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

## Official Trend Display

Purpose:

```txt
Human review surface for latest official Pick3 trend data.
It is not an AI prompt, not a blind image, not a prediction result, and not a recommendation surface.
```

Data chain:

```txt
official sync -> pick3_draws -> listPick3TrendSnapshot -> GET /api/pick3-is-blind-eval/trend -> Pick3 Trend App Shell surface
```

Required route:

```txt
GET /api/pick3-is-blind-eval/trend
```

Route rules:

```txt
localUiAllowed: true
externalApiAllowed: false
requiresApiKey: false
jobOwner: pick3-is-blind-eval
purpose: local_pick3_trend_snapshot
```

Trend snapshot shape:

```ts
type Pick3TrendSnapshot = {
  source: "pick3_draws";
  windowSize: 80;
  drawCount: number;
  latestPhase: string | null;
  latestWindowStartIndex: number;
  draws: Array<{
    index: number;
    phase: string;
    expectedPrizeTime: string;
    expectedPrizeTimestamp: string;
    numbers: string;
    positions: {
      hundreds: number;
      tens: number;
      ones: number;
    };
  }>;
};
```

UI contract:

```txt
Default view = latest 80 stored official draws.
Visible window size = 80 and must not change during drag.
Rows = hundreds, tens, ones as three separated rows.
Hover point info = phase + official drawn numbers + expected prize time.
Mouse drag = move historical start index over stored official draws.
Dragging right/left changes the window location, not the 80-draw window size.
Empty or insufficient data must show counts honestly; it must not synthesize missing draws.
```

Visual standard:

```txt
The Trend surface lives inside the existing Pick3 workspace page stack.
The chart should use a dense workbench-style SVG surface, compact metrics, clear row labels, visible point targets, and a floating tooltip.
It must stay readable on desktop and narrow workbench widths without overlapping text.
```

Forbidden:

```txt
No external lottery mirror.
No browser DOM scraping for trend truth.
No localStorage or fixture rows as production truth.
No /Users/nexgen/Documents/trend-intuition-brain runtime read.
No trend-specific storage table.
No trend data mixed into blind image generation.
No phase/date/answer text in AI blind images.
No recommendation, final selected label, betting, stake, or purchase action.
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
11. active Playbook files are inside AGENT Pick3 plugin owner.
12. AGENT code, law, and blueprint contain no runtime dependency on trend-intuition-brain.
13. Playbook prompt package contains hashes and no target phase/date/answer fields.
14. Trend snapshot reads pick3_draws, returns windowSize=80, and computes latestWindowStartIndex.
15. Trend route is admitted only through the existing Workbench API Boundary as local_pick3_trend_snapshot.
16. Trend UI exposes a fixed L80 three-row surface with hover point info and drag navigation.
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
8. open local Workbench Pick3 Trend surface.
9. verify latest 80 draw window renders as three separated rows: hundreds, tens, ones.
10. hover a point and verify phase + official drawn numbers + expected prize time.
11. drag the trend surface and verify the phase range changes while the visible window remains 80.
```

Verification commands:

```bash
npm run typecheck
npm run lint
npm run audit:pick3-is-blind-eval
npm run acceptance:pick3-is-blind-eval
```

## Next Prediction Stability Human Review History

Law:

```txt
GRASSEYE-PICK3-HUMAN-REVIEW-HISTORY-009-V1
```

Purpose:

```txt
Give the human reviewer the full evidence needed to decide manually:
task history, phase context, same-image repeat proof, every repeat result,
and the complete AI answer. The system does not choose, vote, recommend,
or describe a buying action.
```

Single source chain:

```txt
task summary: runtime-data/pick3-is-blind-eval/tasks/<taskId>/task.json
AI raw answer: pick3_ai_interactions.raw_response_text
AI prompt/proof: pick3_ai_interactions rendered_prompt_text/provider_proof_json/raw_output_ref
prediction row: ai_predictions joined by interaction_id
image proof: task.batch.images imageId/imageSha256/targetPhase/visibleStartPhase/visibleEndPhase
```

No second chain:

```txt
Do not create a second history DB, second result file, second answer file,
or second route family. History APIs are read-only projections over the
existing task.json and SQLite interaction/prediction records.
```

Workbench API:

```txt
GET /api/pick3-is-blind-eval/history
  returns persisted next_prediction_stability and full_pipeline task summaries.

GET /api/pick3-is-blind-eval/task?taskId=<taskId>
  returns phase context, image proof, repeat rows or full_pipeline answer rows,
  observed distribution, phaseReports, evidence completeness, and AI answer payloads.

GET /api/pick3-is-blind-eval/interaction?taskId=<taskId>&interactionId=<interactionId>
  returns one raw AI answer payload for direct Inspector viewing.

POST /api/pick3-is-blind-eval/playbook-review
  body: { taskId, phase, position }
  manually creates a Playbook lesson for one failed full_pipeline playbook_v1 position.
```

History row fields:

```txt
taskId
batchId
status
createdAt
providerKind
repeatCount
selectedPositions
newestOfficialPhase
targetPhase
visibleStartPhase
visibleEndPhase
expectedRepeatResults
actualRepeatResults
rawAnswerCount
evidenceCompleteness
taskMode
scoring
```

Task detail fields:

```txt
images[]
  position
  imageId
  imageSha256
  targetPhase
  visibleStartPhase
  visibleEndPhase

repeats[]
  position
  imageId
  repeatIndex
  interactionId
  predictionId
  predictionLabel
  visiblePredictionLabel
  confidence
  parseStatus
  parseFailureReason
  rawResponseHash
  rawOutputRef
  sameImageForPosition
  aiAnswer.rawResponseText
  aiAnswer.renderedPromptText
  aiAnswer.promptPackageId
  aiAnswer.promptContractId
  aiAnswer.providerProofJson

phaseReports[] for full_pipeline historical scoring
  phase
  status: hit | miss | abstain | incomplete
  errorReason
  positions[]
    position
    predictionLabel
    answerLabel
    hit
    confidence
    errorReason
    lessonStatus

playbookLessons[]
  lessonId
  phase
  position
  source
  status
  aggregateKey
  predictedLabel
  answerLabel
  rootCause
  candidateLesson
  aiReviewRawText
  evidenceRefsJson
```

Full pipeline history value rule:

```txt
full_pipeline is historical scoring, so history must not hide it behind latest-task.json.
For every target phase, combine hundreds/tens/ones into one phaseReports[] row.
status = hit only when all three positions hit.
status = miss when any non-abstain position is wrong.
status = abstain when at least one position abstained and no position is missing.
status = incomplete when any position is missing prediction/reveal proof.
errorReason must explain the wrong or abstained position using failure review promptProblem,
abstainReason, parseFailureReason, or a prediction-vs-answer fallback.
```

UI:

```txt
Pick3 workspace adds a History tab.
History tab left column: task rows with phase and completeness.
History tab right column: selected task context, phaseReports, playbookLessons, images, repeat/answer table.
Clicking a repeat opens Inspector with the full AI answer.
Clicking a lesson opens Inspector with the AI post-mortem result and evidence refs.
For failed playbook_v1 positions, History exposes a manual Playbook review action.
Observed distribution may be shown as evidence counts only, grouped by position.
No final selected label, majority instruction, betting advice, or buy text.
```

observedDistribution shape:

```txt
observedDistribution: Record<position, Record<visibleLabel, count>>
e.g. { "hundreds": { "lower": 2, "upper": 3 }, "tens": { "lower": 5 } }
```

Counts for different positions must never be summed into one shared total. A task that
selects multiple positions must show one count bucket per position, so a human reading
the distribution for "hundreds" never sees votes that actually came from "tens" or "ones".

Acceptance:

```txt
1. Create a next_prediction_stability fixture with batchSize=5 and one image.
2. Persist task.json through existing Pick3 storage.
3. Persist five pick3_ai_interactions through the existing Prompt Exchange path.
4. Verify history returns newest official phase, target phase, selected position, repeat count, and completeness.
5. Verify task detail returns five repeats tied to one image id.
6. Verify every repeat exposes rawResponseText and prompt/proof metadata.
7. Verify observedDistribution is present, grouped by position, and no final recommendation field exists.
8. Create a second fixture selecting two positions and verify their counts land in separate observedDistribution buckets, never summed together.
9. Create a full_pipeline fixture with one target phase and three positions, force one wrong position, and verify history lists the task, phaseReports[0].status = miss, and errorReason is visible.
10. In a playbook_v1 full_pipeline fixture, verify automatic playbookLessons are created for failed positions only, each lesson keeps its own hundreds/tens/ones position, aggregateKey starts with that position, and candidate lessons do not create active Playbook mutations.
11. Verify manual POST /api/pick3-is-blind-eval/playbook-review can create a source=manual_review lesson for the same failed phase/position.
12. Verify free_analysis_strict_reasoning full_pipeline failures do not create playbookLessons.
```

## Human Review History Physical Delete

Law:

```txt
GRASSEYE-PICK3-HISTORY-PHYSICAL-DELETE-010-V1
```

Purpose:

```txt
Let the human reviewer permanently remove a bad/noisy/test Pick3 stability
history record from the local evidence set. This is a destructive operation,
not an archive or soft delete.
```

UI rule:

```txt
History detail exposes a Delete button for the selected task.
Clicking Delete must call window.confirm before any DELETE request.
The confirm copy must say physical delete, irreversible, task evidence,
AI answers, and artifact files.
Cancel means no backend request.
Confirm means the backend DELETE route executes.
```

API:

```txt
DELETE /api/pick3-is-blind-eval/task?taskId=<taskId>
```

Physical delete scope:

```txt
runtime-data/pick3-is-blind-eval/tasks/<taskId>/
runtime-data/pick3-is-blind-eval/latest-task.json when it points to taskId
task.batch.artifactDir when it is inside GrassEye runtime data
pick3_ai_interactions rows for task.batch.batchId
ai_predictions rows for task.batch.batchId
ai_reveals rows joined through ai_predictions for task.batch.batchId
failure_reviews rows for task.batch.batchId
is_blind_images rows for task.batch.batchId
is_blind_batches row for task.batch.batchId
rawOutputRef files recorded by pick3_ai_interactions when inside GrassEye runtime data
```

Path safety:

```txt
Only delete paths contained by the local GrassEye data directory.
Never delete arbitrary absolute paths, provider profile paths, browser profile
paths, or anything outside runtime data.
```

Acceptance:

```txt
1. Persist a next_prediction_stability fixture with task.json, batch rows, interaction rows, prediction rows, artifact dir, and raw output ref file.
2. Call deletePick3HumanReviewTask(taskId).
3. Verify task detail returns null.
4. Verify history no longer lists taskId.
5. Verify task directory, artifact dir, and raw output ref file no longer exist.
6. Verify SQLite rows for the deleted batch no longer exist.
7. Browser test must prove cancel keeps the record and confirm deletes it.
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
