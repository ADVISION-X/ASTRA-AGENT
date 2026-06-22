import { renderDeepResearchPanel } from "../workbench-deep-research-panel.js";
import { renderAmazonProductMiningWorkspace } from "../skills/amazon-product-mining/amazon-product-mining-workspace.js";
import { renderMediaOptimizerWorkspace } from "../skills/media-optimizer/media-optimizer-workspace.js";
import { renderAmazonInvoiceWorkspace } from "./amazon-invoice-workspace.js";
import { renderLotteryTicketPlanWorkspace } from "./lottery-ticket-plan-workspace.js";

const renderFacebookWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="facebook-video-mining" data-job-panel="facebook">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Level 2 Skill Workspace</span>
      <h1>Facebook Video Mining</h1>
      <p>Governed feed scan result surface. Run details open in Inspector.</p>
    </div>
  </div>
  <nav class="skill-page-nav" data-workspace-page-nav="facebook-video-mining" aria-label="Facebook Video Mining pages">
    <button class="skill-page-tab" type="button" data-workspace-page="records" data-workspace-page-skill="facebook-video-mining" aria-pressed="true">Saved Records</button>
    <button class="skill-page-tab" type="button" data-workspace-page="run" data-workspace-page-skill="facebook-video-mining" aria-pressed="false">New Run</button>
    <button class="skill-page-tab" type="button" data-workspace-page="runtime" data-workspace-page-skill="facebook-video-mining" aria-pressed="false">Runtime</button>
  </nav>
  <div class="skill-page-stack secondary-page-stack">
    <section class="skill-page-surface" data-workspace-surface="records" data-workspace-surface-skill="facebook-video-mining">
      <section class="panel history-panel" data-facebook-results>
        <div class="panel-title-row">
          <div>
            <span class="eyebrow">Primary History</span>
            <h2>Saved product records</h2>
          </div>
          <span class="status-badge status-insufficient"><b data-facebook-saved-count>0</b>/<b data-facebook-target-count>0</b></span>
        </div>
        <div class="record-list" data-facebook-record-list></div>
        <section class="empty-state app-empty-surface" data-facebook-empty-records>
          <span class="eyebrow">Agent Records</span>
          <h2>No saved records loaded</h2>
          <p>Run Facebook Video Mining or load Latest to review persisted product video records. Selecting a record opens the Inspector.</p>
        </section>
      </section>
    </section>
    <section class="skill-page-surface hidden" data-workspace-surface="run" data-workspace-surface-skill="facebook-video-mining">
      <section class="panel app-form-panel">
        <form class="form-grid compact-form" data-facebook-form>
          <div class="field"><label>Target product count</label><input name="targetProductCount" type="number" min="1" value="3" required /></div>
          <div class="actions wide">
            <button class="btn" type="submit">Start</button>
            <button class="btn secondary" type="button" data-facebook-latest>Latest</button>
            <button class="btn secondary" type="button" data-facebook-export>Export</button>
          </div>
        </form>
      </section>
    </section>
    <section class="skill-page-surface hidden" data-workspace-surface="runtime" data-workspace-surface-skill="facebook-video-mining">
      <section class="panel empty-state app-empty-surface">
        <span class="eyebrow">Runtime Events</span>
        <h2>Use the bottom console for live events</h2>
        <p>Task started, completed, manual_required, and failed events stay in the independent Runtime Console, not in the history table.</p>
      </section>
    </section>
  </div>
</section>`;

const renderVideoSourceSurface = (): string => `
<section class="skill-page-surface" data-workspace-surface="source" data-workspace-surface-skill="video-downloader">
  <section class="panel app-form-panel">
    <form class="form-grid compact-form" data-video-download-form>
      <input name="platform" type="hidden" value="telegram-web" />
      <input name="telegramDocumentIdHash" type="hidden" value="" />
      <div class="platform-tabs wide" data-video-platform-tabs>
        <button class="platform-tab" type="button" data-video-platform="telegram" aria-pressed="true">Telegram Web</button>
        <button class="platform-tab" type="button" data-video-platform="youtube" aria-pressed="false">YouTube</button>
        <button class="platform-tab" type="button" data-video-platform="universal" aria-pressed="false">Universal</button>
        <button class="platform-tab" type="button" data-video-platform="facebook" aria-pressed="false">Facebook</button>
        <button class="platform-tab" type="button" data-video-platform="tiktok" aria-pressed="false">TikTok</button>
      </div>
      <div class="notice wide" data-video-platform-note="telegram" data-video-download-telegram-boundary>
        <b>Telegram Web boundary</b>
        <span>Open and authorize the target Telegram Web page in local Chrome, play the target video, then detect the current source.</span>
        <a class="btn secondary" href="https://web.telegram.org/k/" target="_blank" rel="noopener noreferrer">Open Telegram Web</a>
      </div>
      <div class="notice wide hidden" data-video-platform-note="youtube"><b>YouTube</b><span>URL -> governed local runtime -> optional subtitles.</span></div>
      <div class="notice wide hidden" data-video-platform-note="universal"><b>Universal</b><span>Visible page media candidates -> one validated artifact.</span></div>
      <div class="notice wide hidden" data-video-platform-note="facebook"><b>Facebook</b><span>Visible video URL -> governed media artifact.</span></div>
      <div class="notice wide hidden" data-video-platform-note="tiktok"><b>TikTok</b><span>Visible video URL -> governed media artifact.</span></div>
      <div class="field wide"><label>Source page URL</label><input name="sourcePageUrl" type="url" required /></div>
      <div class="actions wide" data-video-detect-row>
        <button class="btn secondary" type="button" data-video-detect-source="telegram-web">Detect current video</button>
        <span class="muted" data-video-source-state>Play the video first, then detect.</span>
      </div>
      <div class="wide hidden" data-video-candidate-list></div>
      <div class="field">
        <label>Quality</label>
        <select name="preferredQuality">
          <option value="best_available">Best available</option>
          <option value="1080p">1080p</option>
          <option value="720p">720p</option>
          <option value="480p">480p</option>
        </select>
      </div>
      <div class="field"><label>Max MB</label><input name="maxMegabytes" type="number" min="1" max="5000" value="5000" required /></div>
      <label class="check" data-video-subtitles-field><input name="downloadSubtitles" type="checkbox" /> download subtitles</label>
      <div class="field" data-video-subtitle-languages-field><label>Subtitle languages</label><input name="subtitleLanguages" type="text" value="en" /></div>
      <label class="check wide"><input name="saveToDownloads" type="checkbox" checked /> Save to Downloads/GrassEye Video Downloads</label>
      <div class="wide hidden" data-video-download-progress>
        <progress></progress>
        <div class="muted" data-video-download-progress-label></div>
      </div>
      <div class="notice wide hidden" data-video-download-result></div>
      <div class="actions wide"><button class="btn" type="submit">Start</button></div>
    </form>
  </section>
</section>`;

const renderVideoArtifactSurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="artifact" data-workspace-surface-skill="video-downloader">
  <section class="panel empty-state app-empty-surface">
    <span class="eyebrow">Artifact</span>
    <h2>No media artifact selected</h2>
    <p>Verified video artifacts, subtitles, and failure reasons open here from backend results.</p>
  </section>
</section>`;

const renderVideoSettingsSurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="settings" data-workspace-surface-skill="video-downloader">
  <section class="panel empty-state app-empty-surface">
    <span class="eyebrow">Settings</span>
    <h2>Source-specific controls</h2>
    <p>Platform mode, quality ceiling, size limit, and download destination stay bounded to this skill workspace.</p>
  </section>
</section>`;

const renderVideoDownloadWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="video-downloader" data-job-panel="video-download">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Level 2 Skill Workspace</span>
      <h1>Video Downloader</h1>
      <p>One source page, one verified media artifact.</p>
    </div>
  </div>
  <nav class="skill-page-nav" data-workspace-page-nav="video-downloader" aria-label="Video Downloader pages">
    <button class="skill-page-tab" type="button" data-workspace-page="source" data-workspace-page-skill="video-downloader" aria-pressed="true">Source</button>
    <button class="skill-page-tab" type="button" data-workspace-page="artifact" data-workspace-page-skill="video-downloader" aria-pressed="false">Artifact</button>
    <button class="skill-page-tab" type="button" data-workspace-page="settings" data-workspace-page-skill="video-downloader" aria-pressed="false">Settings</button>
  </nav>
  <div class="skill-page-stack secondary-page-stack">
    ${renderVideoSourceSurface()}
    ${renderVideoArtifactSurface()}
    ${renderVideoSettingsSurface()}
  </div>
</section>`;

const renderPlannedWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="tiktok-product-mining">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Planned Skill Workspace</span>
      <h1>TikTok Product Mining</h1>
      <p>This skill is registered but disabled until a future law authorizes its job flow.</p>
    </div>
    <span class="status-badge status-insufficient">planned</span>
  </div>
  <section class="panel empty-state">
    <h2>No production surface</h2>
    <p>Planned skills remain visible in the registry without creating a second implementation path.</p>
  </section>
</section>`;

const renderPick3Header = (): string => `
<div class="skill-header">
  <div>
    <span class="eyebrow">Research Executor</span>
    <h1>Pick3 IS Blind Eval</h1>
    <p>Official UAE Pick 3 data sync and isolated L80 visual batches.</p>
  </div>
  <span class="status-badge status-active">active</span>
</div>`;

const renderPick3PageNav = (): string => `
  <nav class="skill-page-nav" data-workspace-page-nav="pick3-is-blind-eval" aria-label="Pick3 IS Blind Eval pages">
    <button class="skill-page-tab" type="button" data-workspace-page="run" data-workspace-page-skill="pick3-is-blind-eval" aria-pressed="true">Run</button>
    <button class="skill-page-tab" type="button" data-workspace-page="trend" data-workspace-page-skill="pick3-is-blind-eval" aria-pressed="false">Trend</button>
    <button class="skill-page-tab" type="button" data-workspace-page="images" data-workspace-page-skill="pick3-is-blind-eval" aria-pressed="false">Images</button>
    <button class="skill-page-tab" type="button" data-workspace-page="history" data-workspace-page-skill="pick3-is-blind-eval" aria-pressed="false">History</button>
    <button class="skill-page-tab" type="button" data-workspace-page="audit" data-workspace-page-skill="pick3-is-blind-eval" aria-pressed="false">Audit</button>
  </nav>`;

const renderPick3RunForm = (): string => `
<section class="panel app-form-panel">
  <form class="form-grid compact-form" data-pick3-form>
    <div class="field">
      <label>Mode</label>
      <select name="mode">
        <option value="generate_batch">Sync and generate images</option>
        <option value="full_pipeline">Full pipeline via GPT web chat</option>
        <option value="next_prediction_stability">Next prediction stability</option>
        <option value="sync_only">Sync only</option>
      </select>
    </div>
    <div class="field">
      <label>AI provider</label>
      <select name="providerKind">
        <option value="gpt-web-chat">GPT web chat</option>
        <option value="gemini-web-chat">Gemini web chat</option>
      </select>
    </div>
    <div class="field">
      <label>AI analysis mode</label>
      <select name="promptMode">
        <option value="playbook_v1">Playbook mode</option>
        <option value="free_analysis_strict_reasoning">AI free analysis mode</option>
      </select>
    </div>
    <div class="field"><label>Batch size</label><input name="batchSize" type="number" min="1" max="100" value="20" required /></div>
    <div class="field"><label>Last target phase</label><select name="lastTargetPhase" data-pick3-last-target-phase><option value="">Latest stored target</option></select></div>
    <label class="check"><input name="hundreds" type="checkbox" checked /> hundreds</label>
    <label class="check"><input name="tens" type="checkbox" checked /> tens</label>
    <label class="check"><input name="ones" type="checkbox" checked /> ones</label>
    <div class="notice wide">
      <b>Blind boundary</b>
      <span>L80 images contain no title, axis, phase, date, Chart number, point count, answer, or position text.</span>
    </div>
    <div class="notice wide">
      <b>Historical range</b>
      <span>For generated or full historical batches, choose a stored official Last target phase; the batch ends at that phase and walks backward by batch size.</span>
    </div>
    <div class="notice wide">
      <b>Next stability</b>
      <span>In next prediction stability, batch size is repeat sends of the same one image per selected position.</span>
    </div>
    <div class="actions wide">
      <button class="btn" type="submit">Start</button>
      <button class="btn secondary" type="button" data-pick3-latest>Latest</button>
    </div>
  </form>
</section>`;

const renderPick3LatestPanel = (): string => `
<section class="panel history-panel">
  <div class="panel-title-row">
    <div>
      <span class="eyebrow">Latest Task</span>
      <h2 data-pick3-summary-title>No Pick3 task loaded</h2>
    </div>
    <span class="status-badge" data-pick3-status>idle</span>
  </div>
  <div class="detail-grid inspector-detail-grid">
    <div><b>Rows seen</b><span data-pick3-rows-seen>-</span></div>
    <div><b>Inserted</b><span data-pick3-rows-inserted>-</span></div>
    <div><b>Updated</b><span data-pick3-rows-updated>-</span></div>
    <div><b>Newest phase</b><span data-pick3-newest-phase>-</span></div>
    <div><b>Batch</b><span data-pick3-batch-id>-</span></div>
    <div><b>Images</b><span data-pick3-image-count>-</span></div>
    <div><b>Artifact dir</b><span data-pick3-artifact-dir>-</span></div>
    <div><b>Random baseline</b><span>50% single / 12.5% combo</span></div>
  </div>
  <div class="record-list" data-pick3-stability-list></div>
</section>`;

const renderPick3RunSurface = (): string => `
<section class="skill-page-surface" data-workspace-surface="run" data-workspace-surface-skill="pick3-is-blind-eval">
  ${renderPick3RunForm()}
  ${renderPick3LatestPanel()}
</section>`;

const renderPick3ImagesSurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="images" data-workspace-surface-skill="pick3-is-blind-eval">
  <section class="panel history-panel">
    <div class="panel-title-row">
      <div>
        <span class="eyebrow">AI Image Manifest</span>
        <h2>One image per AI call</h2>
      </div>
      <span class="status-badge status-active" data-pick3-image-total>0</span>
    </div>
    <div class="record-list" data-pick3-image-list></div>
  </section>
</section>`;

const renderPick3TrendSurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="trend" data-workspace-surface-skill="pick3-is-blind-eval">
  <section class="panel pick3-trend-panel">
    <div class="panel-title-row">
      <div>
        <span class="eyebrow">Official Trend</span>
        <h2>Latest 80 draw window</h2>
      </div>
      <div class="actions">
        <span class="status-badge status-active">L80</span>
        <button class="btn secondary" type="button" data-pick3-trend-refresh>Refresh</button>
      </div>
    </div>
    <div class="pick3-trend-metrics">
      <div><b>Window</b><span data-pick3-trend-window>-</span></div>
      <div><b>Phase range</b><span data-pick3-trend-range>-</span></div>
      <div><b>Latest phase</b><span data-pick3-trend-latest>-</span></div>
      <div><b>Historical offset</b><span data-pick3-trend-offset>-</span></div>
      <div><b>Total draws</b><span data-pick3-trend-total>-</span></div>
    </div>
    <div class="pick3-trend-shell" data-pick3-trend-shell>
      <div class="pick3-trend-chart" data-pick3-trend-chart></div>
      <div class="pick3-trend-tooltip hidden" data-pick3-trend-tooltip></div>
    </div>
  </section>
</section>`;

const renderPick3HistorySurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="history" data-workspace-surface-skill="pick3-is-blind-eval">
  <section class="panel history-panel">
    <div class="panel-title-row">
      <div>
        <span class="eyebrow">Pick3 History</span>
        <h2>Scoring and human review evidence</h2>
      </div>
      <div class="actions">
        <span class="status-badge status-active" data-pick3-history-count>0</span>
        <button class="btn secondary" type="button" data-pick3-history-refresh>Refresh</button>
        <button class="btn secondary" type="button" data-pick3-history-delete>Delete</button>
      </div>
    </div>
    <div class="split-grid two-column-grid">
      <div class="record-list" data-pick3-history-list></div>
      <div class="detail-section">
        <div class="detail-grid inspector-detail-grid">
          <div><b>Task</b><span data-pick3-history-task-id>-</span></div>
          <div><b>Status</b><span data-pick3-history-status>-</span></div>
          <div><b>Phase</b><span data-pick3-history-phase>-</span></div>
          <div><b>Window</b><span data-pick3-history-window>-</span></div>
          <div><b>Provider</b><span data-pick3-history-provider>-</span></div>
          <div><b>Scoring</b><span data-pick3-history-scoring>-</span></div>
          <div><b>Repeats</b><span data-pick3-history-repeats>-</span></div>
          <div><b>Completeness</b><span data-pick3-history-completeness>-</span></div>
          <div><b>Observed distribution</b><span data-pick3-history-distribution>-</span></div>
        </div>
        <h3>Phase Result</h3>
        <div class="record-list compact-record-list" data-pick3-history-phase-report-list></div>
        <h3>Playbook Lessons</h3>
        <div class="record-list compact-record-list" data-pick3-history-lesson-list></div>
        <h3>Images</h3>
        <div class="record-list compact-record-list" data-pick3-history-image-list></div>
        <h3>AI Answers</h3>
        <div class="record-list compact-record-list" data-pick3-history-repeat-list></div>
      </div>
    </div>
  </section>
</section>`;

const renderPick3AuditSurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="audit" data-workspace-surface-skill="pick3-is-blind-eval">
  <section class="panel empty-state app-empty-surface">
    <span class="eyebrow">Statistical Honesty</span>
    <h2>Confidence is not probability</h2>
    <p>Model id, temperature, image detail, prompt versions, random baselines, calibration, and abstain coverage are required by law before AI scoring is considered complete.</p>
  </section>
</section>`;

const renderPick3Workspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="pick3-is-blind-eval" data-job-panel="pick3-is-blind-eval">
  ${renderPick3Header()}
  ${renderPick3PageNav()}
  <div class="skill-page-stack secondary-page-stack">
    ${renderPick3RunSurface()}
    ${renderPick3TrendSurface()}
    ${renderPick3ImagesSurface()}
    ${renderPick3HistorySurface()}
    ${renderPick3AuditSurface()}
  </div>
</section>`;

export const renderMainWorkspace = (): string => `
<main class="workspace" data-app-shell-workspace>
  ${renderAmazonProductMiningWorkspace()}
  ${renderFacebookWorkspace()}
  ${renderPlannedWorkspace()}
  <section class="skill-workspace hidden" data-skill-workspace="deep-research-analysis" data-job-panel="deep-research">
    ${renderDeepResearchPanel()}
  </section>
  ${renderPick3Workspace()}
  ${renderLotteryTicketPlanWorkspace()}
  ${renderVideoDownloadWorkspace()}
  ${renderMediaOptimizerWorkspace()}
  ${renderAmazonInvoiceWorkspace()}
</main>`;
