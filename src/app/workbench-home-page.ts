import { renderWorkbenchDeepResearchClient } from "./workbench-deep-research-client.js";
import { renderDeepResearchPanel } from "./workbench-deep-research-panel.js";
import { renderWorkbenchDeepResearchStyles } from "./workbench-deep-research-styles.js";
import { renderWorkbenchHomeClient } from "./workbench-home-client.js";
import { renderWorkbenchHomeStyles } from "./workbench-home-styles.js";
import { renderWorkbenchVideoDownloadClient } from "./workbench-video-download-client.js";

const renderJobRail = (): string => `
<aside class="rail">
  <h2>Job flows</h2>
  <div class="job-list" data-job-flow-list>
    <button class="job-card" type="button" data-job-card="amazon" aria-pressed="true">
      <strong>Amazon invoice upload</strong>
      <span class="muted">approved PDF -> order invoice</span>
    </button>
    <button class="job-card" type="button" data-job-card="facebook" aria-pressed="false">
      <strong>Facebook product video mining</strong>
      <span class="muted">feed scan -> evidence refs</span>
    </button>
    <button class="job-card" type="button" data-job-card="video-download" aria-pressed="false">
      <strong>Video download skill</strong>
      <span class="muted">source URL -> media artifact</span>
    </button>
    <button class="job-card" type="button" data-job-card="deep-research" aria-pressed="false">
      <strong>Deep Research Analysis</strong>
      <span class="muted">question -> debate -> final report</span>
    </button>
  </div>
</aside>`;

const renderAmazonPanel = (): string => `
<section data-job-panel="amazon">
  <h1>Amazon invoice upload</h1>
  <p class="muted">amazon-invoice-upload.flow.ts</p>
  <form class="form-grid" data-amazon-form>
    <div class="field"><label>Marketplace</label><select name="marketplace"><option>AE</option><option>SA</option><option>JP</option><option>US</option><option>UK</option></select></div>
    <div class="field"><label>Amazon order ID</label><input name="amazonOrderId" required /></div>
    <div class="field wide"><label>Seller Central URL</label><input name="sellerCentralEntryUrl" type="url" required /></div>
    <div class="field"><label>Invoice number</label><input name="invoiceNo" required /></div>
    <div class="field"><label>Approved PDF</label><input name="invoicePdf" type="file" accept="application/pdf" required /></div>
    <div class="field wide"><label>Admin order URL</label><input name="adminOrderUrl" type="url" /></div>
    <label class="check wide"><input name="requireHumanFinalSubmit" type="checkbox" checked /> require human final submit</label>
    <div class="actions wide">
      <button class="btn" type="submit">Start</button>
      <button class="btn secondary" type="button" data-amazon-resume>Resume</button>
      <button class="btn secondary" type="button" data-amazon-latest>Latest</button>
    </div>
  </form>
</section>`;

const renderFacebookPanel = (): string => `
<section class="hidden" data-job-panel="facebook">
  <h1>Facebook product video mining</h1>
  <p class="muted">facebook-product-video-mining.flow.ts</p>
  <form class="form-grid" data-facebook-form>
    <div class="field"><label>Target product count</label><input name="targetProductCount" type="number" min="1" value="3" required /></div>
    <div class="actions wide">
      <button class="btn" type="submit">Start</button>
      <button class="btn secondary" type="button" data-facebook-latest>Latest</button>
      <button class="btn secondary" type="button" data-facebook-export>Export</button>
    </div>
  </form>
  <section class="result-strip" data-facebook-results>
    <div class="result-summary">
      <span><b data-facebook-saved-count>0</b>/<b data-facebook-target-count>0</b></span>
      <span class="muted">saved product records</span>
    </div>
    <div class="record-list" data-facebook-record-list></div>
  </section>
</section>`;

const renderVideoDownloadPanel = (): string => `
<section class="hidden" data-job-panel="video-download">
  <h1>Video download skill</h1>
  <p class="muted">one platform, one verified media artifact</p>
  <form class="form-grid" data-video-download-form>
    <input name="childCapabilityId" type="hidden" value="download-telegram-web-video-once" />
    <input name="telegramDocumentIdHash" type="hidden" value="" />
    <div class="platform-tabs wide" data-video-platform-tabs>
      <button class="platform-tab" type="button" data-video-platform="telegram" data-child-capability-id="download-telegram-web-video-once" aria-pressed="true">Telegram Web</button>
      <button class="platform-tab" type="button" data-video-platform="youtube" data-child-capability-id="download-youtube-video-once" aria-pressed="false">YouTube</button>
      <button class="platform-tab" type="button" data-video-platform="universal" data-child-capability-id="download-web-video-once" aria-pressed="false">Universal</button>
      <button class="platform-tab" type="button" data-video-platform="facebook" data-child-capability-id="download-facebook-video-once" aria-pressed="false">Facebook</button>
      <button class="platform-tab" type="button" data-video-platform="tiktok" data-child-capability-id="download-tiktok-video-once" aria-pressed="false">TikTok</button>
      <button class="platform-tab" type="button" data-video-platform="instagram" data-child-capability-id="download-instagram-video-once" aria-pressed="false">Instagram</button>
      <button class="platform-tab" type="button" data-video-platform="bilibili" data-child-capability-id="download-bilibili-video-once" aria-pressed="false">Bilibili</button>
      <button class="platform-tab" type="button" data-video-platform="douyin" data-child-capability-id="download-douyin-video-once" aria-pressed="false">Douyin</button>
      <button class="platform-tab" type="button" data-video-platform="x" data-child-capability-id="download-x-video-once" aria-pressed="false">X</button>
      <button class="platform-tab" type="button" data-video-platform="xiaohongshu" data-child-capability-id="download-xiaohongshu-video-once" aria-pressed="false">Xiaohongshu</button>
    </div>
    <div class="notice wide" data-video-platform-note="telegram" data-video-download-telegram-boundary style="display:flex;flex-direction:column;gap:8px;padding:12px 14px">
      <b style="font-size:13px">如何下载 Telegram 指定视频：</b>
      <ol style="margin:0;padding-left:20px;line-height:2;font-size:13px">
        <li>点击下方按钮打开 Telegram Web，<b>找到要下载的视频并点击播放</b></li>
        <li>视频播放后回到此页，点击 <b>② 自动检测当前视频</b></li>
        <li>确认 URL 已填入，勾选"保存到 ~/Downloads"，点击 <b>Start</b></li>
      </ol>
      <div><a class="btn" href="https://web.telegram.org/k/" target="_blank" rel="noopener noreferrer">① 打开 Telegram Web ↗</a></div>
    </div>
    <div class="notice wide hidden" data-video-platform-note="youtube"><b>YouTube</b><span>URL -> governed local runtime -> optional subtitles.</span></div>
    <div class="notice wide hidden" data-video-platform-note="universal"><b>Universal</b><span>Visible page media candidates -> one validated artifact.</span></div>
    <div class="notice wide hidden" data-video-platform-note="facebook"><b>Facebook</b><span>Visible reel/video URL -> governed media artifact.</span></div>
    <div class="notice wide hidden" data-video-platform-note="tiktok"><b>TikTok</b><span>Visible video URL -> governed media artifact.</span></div>
    <div class="notice wide hidden" data-video-platform-note="instagram"><b>Instagram</b><span>Visible video URL -> governed media artifact.</span></div>
    <div class="notice wide hidden" data-video-platform-note="bilibili"><b>Bilibili</b><span>Visible video URL -> governed media artifact.</span></div>
    <div class="notice wide hidden" data-video-platform-note="douyin"><b>Douyin</b><span>Visible video URL -> governed media artifact.</span></div>
    <div class="notice wide hidden" data-video-platform-note="x"><b>X</b><span>Visible post/video URL -> governed media artifact.</span></div>
    <div class="notice wide hidden" data-video-platform-note="xiaohongshu"><b>Xiaohongshu</b><span>Visible note/video URL -> governed media artifact.</span></div>
    <div class="field wide"><label>Source page URL</label><input name="sourcePageUrl" type="url" required /></div>
    <div class="actions wide" data-video-detect-row>
      <button class="btn secondary" type="button" data-video-detect-source="telegram-web">② 自动检测当前视频</button>
      <span class="muted" data-video-source-state>（先播放视频，再点此按钮）</span>
    </div>
    <div class="wide hidden" data-video-candidate-list></div>
    <div class="field">
      <label>Quality</label>
      <select name="preferredQuality">
        <option value="best_available">Best available</option>
        <option value="1080p">1080p</option>
        <option value="720p">720p</option>
        <option value="480p">480p</option>
        <option value="hd">HD</option>
        <option value="sd">SD</option>
      </select>
    </div>
    <div class="field"><label>Max MB</label><input name="maxMegabytes" type="number" min="1" max="5000" value="5000" required /></div>
    <label class="check" data-video-subtitles-field><input name="downloadSubtitles" type="checkbox" /> download subtitles</label>
    <label class="check wide" style="font-weight:600;color:#1a73e8"><input name="saveToDownloads" type="checkbox" checked /> ③ 保存到 ~/Downloads（完成后可在 Finder 下载文件夹找到）</label>
    <div class="wide hidden" data-video-download-progress>
      <progress style="width:100%;height:14px"></progress>
      <div class="muted" data-video-download-progress-label></div>
    </div>
    <div class="actions wide">
      <button class="btn" type="submit">Start</button>
    </div>
  </form>
</section>`;

const renderLedger = (): string => `
<aside class="ledger" data-task-status-panel>
  <div class="panel">
    <h2>Task status</h2>
    <div class="kv">
      <div><b>ID</b><span data-task-id>-</span></div>
      <div><b>Status</b><span data-task-status>-</span></div>
      <div><b>Step</b><span data-task-step>-</span></div>
      <div><b>Reason</b><span data-task-reason>-</span></div>
      <div><b>Evidence</b><span data-evidence-ref>-</span></div>
    </div>
  </div>
  <div class="panel">
    <h2>Result record</h2>
    <pre data-raw-result>{}</pre>
  </div>
</aside>`;

export const renderWorkbenchHomePage = (): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GrassEye Local Workbench</title>
  <style>${renderWorkbenchHomeStyles()}${renderWorkbenchDeepResearchStyles()}</style>
</head>
<body>
  <div class="shell" data-workbench-shell>
    <header class="topbar">
      <div class="brand"><strong>GrassEye Local Workbench</strong><span>job-flow gate</span></div>
      <div class="status">
        <span class="pill"><span>health</span><b data-health-status>-</b></span>
        <span class="pill"><span>mode</span><b data-mode-status>-</b></span>
        <button class="btn secondary" type="button" data-refresh-shell>Refresh</button>
      </div>
    </header>
    <main class="main">
      ${renderJobRail()}
      <div class="workspace">${renderAmazonPanel()}${renderFacebookPanel()}${renderVideoDownloadPanel()}${renderDeepResearchPanel()}</div>
      ${renderLedger()}
    </main>
    <footer class="activity" data-activity-panel>
      <h3>Local activity</h3>
      <div class="activity-log" data-activity-log></div>
    </footer>
  </div>
  <script>${renderWorkbenchHomeClient()}${renderWorkbenchVideoDownloadClient()}${renderWorkbenchDeepResearchClient()}</script>
</body>
</html>`;
