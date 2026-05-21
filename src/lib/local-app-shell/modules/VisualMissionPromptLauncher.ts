import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderStatusPill } from "../render-utils.js";
import type {
  CommanderConsoleStartPlatformId,
  CommanderConsoleUserRequirementHistoryEntry,
  CommanderConsoleViewModel,
} from "../types.js";

type Localize = (zh: string, en: string) => string;

const START_PLATFORMS: Array<{ id: CommanderConsoleStartPlatformId; labelZh: string; labelEn: string; hintZh: string; hintEn: string }> = [
  {
    id: "facebook-web",
    labelZh: "Facebook Web",
    labelEn: "Facebook Web",
    hintZh: "Reels / 推荐视频流",
    hintEn: "Reels / recommended video feed",
  },
  {
    id: "tiktok-web",
    labelZh: "TikTok Web",
    labelEn: "TikTok Web",
    hintZh: "For You / 推荐视频流",
    hintEn: "For You / recommended video feed",
  },
];

function renderHistoryEmptyState(t: Localize): string {
  return `<div class="cc-history-empty" data-user-requirement-history-empty>
      <p class="cc-section-title">${escapeHtml(t("还没有需求历史", "No Requirement History Yet"))}</p>
      <p class="cc-note">${escapeHtml(t("启动成功后会自动写入最近需求，后续可一键复用。", "Successful starts will be saved here so you can reuse them in one click."))}</p>
    </div>`;
}

function renderHistoryItem(input: {
  entry: CommanderConsoleUserRequirementHistoryEntry;
  selectedHistoryEntryId: string | null;
  t: Localize;
}): string {
  const { entry, selectedHistoryEntryId, t } = input;
  const selected = entry.id === selectedHistoryEntryId;
  const platformSummary = entry.selectedPlatforms.join(" / ");
  return `<article class="cc-history-card${selected ? " is-selected" : ""}" data-history-entry-id="${escapeHtml(entry.id)}">
      <div class="cc-history-card-main">
        <div class="cc-history-card-copy">
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.userRequirementText)}</p>
        </div>
        <div class="cc-history-card-meta">
          <span>${escapeHtml(platformSummary)}</span>
          <span>${escapeHtml(t(`${entry.useCount} 次`, `${entry.useCount} uses`))}</span>
        </div>
      </div>
      <div class="cc-inline-actions">
        <button
          type="button"
          class="cc-button cc-button-tight"
          data-history-reuse="${escapeHtml(entry.id)}"
          data-history-title="${escapeHtml(entry.title)}"
          data-history-requirement="${escapeHtml(entry.userRequirementText)}"
          data-history-platforms="${escapeHtml(entry.selectedPlatforms.join(","))}"
          data-history-max-rounds="${escapeHtml(String(entry.maxRounds))}"
          data-history-max-minutes="${escapeHtml(String(entry.maxMinutes))}"
        >${escapeHtml(t("复用", "Reuse"))}</button>
        <button type="button" class="cc-button cc-button-tight cc-button-danger" data-history-delete="${escapeHtml(entry.id)}">${escapeHtml(t("删除", "Delete"))}</button>
      </div>
    </article>`;
}

function renderHistoryList(viewModel: CommanderConsoleViewModel, t: Localize): string {
  if (viewModel.userRequirementHistory.length === 0) {
    return renderHistoryEmptyState(t);
  }

  return `<div class="cc-history-list" data-user-requirement-history-list>
      ${viewModel.userRequirementHistory
        .map((entry) => renderHistoryItem({
          entry,
          selectedHistoryEntryId: viewModel.commandDraft.historyEntryId,
          t,
        }))
        .join("")}
    </div>`;
}

function renderPlatformOption(input: {
  platformId: CommanderConsoleStartPlatformId;
  label: string;
  hint: string;
  selectedPlatforms: CommanderConsoleStartPlatformId[];
}): string {
  const checked = input.selectedPlatforms.includes(input.platformId);
  return `<label class="cc-platform-option${checked ? " is-selected" : ""}" data-platform-option="${escapeHtml(input.platformId)}">
      <input type="checkbox" name="selectedPlatforms" value="${escapeHtml(input.platformId)}"${checked ? " checked" : ""} />
      <div>
        <strong>${escapeHtml(input.label)}</strong>
        <p>${escapeHtml(input.hint)}</p>
      </div>
    </label>`;
}

function renderPlatformSelector(viewModel: CommanderConsoleViewModel, t: Localize): string {
  return `<section class="cc-start-platforms">
      <div class="cc-section-copy">
        <p class="cc-section-title">${escapeHtml(t("平台勾选", "Platforms"))}</p>
        <p class="cc-note">${escapeHtml(t("用户只选择目标平台；内部绑定字段和退役地图字段都不在启动页暴露。", "The operator only chooses target platforms. Internal binding fields and retired map fields stay hidden from the start page."))}</p>
      </div>
      <div class="cc-platform-option-grid" data-platform-selector>
        ${START_PLATFORMS.map((platform) => renderPlatformOption({
          platformId: platform.id,
          label: t(platform.labelZh, platform.labelEn),
          hint: t(platform.hintZh, platform.hintEn),
          selectedPlatforms: viewModel.commandDraft.selectedPlatforms,
        })).join("")}
      </div>
    </section>`;
}

function renderMissionModeSelector(t: Localize): string {
  return `<section class="cc-start-platforms">
      <div class="cc-section-copy">
        <p class="cc-section-title">${escapeHtml(t("任务模式", "Mission Mode"))}</p>
        <p class="cc-note">${escapeHtml(t("纯视觉走原单轮视觉闭环；DOM 模式用于真实页面种草视频挖掘。", "Pure Visual uses the original visual loop; DOM mode mines product videos on real pages."))}</p>
      </div>
      <div class="cc-platform-option-grid" data-mission-mode-selector>
        <label class="cc-platform-option is-selected" data-mission-mode-option="pure_visual">
          <input type="radio" name="missionMode" value="pure_visual" checked />
          <div><strong>${escapeHtml(t("纯视觉", "Pure Visual"))}</strong><p>${escapeHtml(t("看图判断与动作规划", "Visual judgment and action planning"))}</p></div>
        </label>
        <label class="cc-platform-option" data-mission-mode-option="dom_product_video">
          <input type="radio" name="missionMode" value="dom_product_video" />
          <div><strong>${escapeHtml(t("DOM 模式", "DOM Mode"))}</strong><p>${escapeHtml(t("AI 判定种草视频，DOM 点赞、取评、下一条", "AI judges product videos; DOM likes, records comments, and advances"))}</p></div>
        </label>
      </div>
    </section>`;
}

function renderRequirementField(viewModel: CommanderConsoleViewModel, t: Localize): string {
  return `<label class="cc-field cc-visual-mission-field">
      <span>${escapeHtml(t("用户需求", "User Requirement"))}</span>
      <textarea
        id="cc-user-requirement-text"
        name="userRequirementText"
        rows="10"
        placeholder="${escapeHtml(t("例如：帮我在 Facebook 上挖掘种草产品，是产品视频就保存线索 + 点赞 + 下一条。", "Example: Find product-seeding videos on Facebook. If it is a product video, save the lead, like it, and move to the next video."))}"
      >${escapeHtml(viewModel.commandDraft.userRequirementText)}</textarea>
      <small class="cc-note">${escapeHtml(t("这里写目标，不写内部能力组名称。AI 会把自然动作映射到系统动作手册。", "Describe the goal here, not internal ability names. AI will map natural actions to the governed action manual."))}</small>
    </label>`;
}

function renderProductVideoDomField(t: Localize): string {
  return `<label class="cc-field cc-visual-mission-field">
      <span>${escapeHtml(t("DOM 视频页面 URL", "DOM Video Page URL"))}</span>
      <input
        id="cc-product-video-page-url"
        name="productVideoPageUrl"
        type="url"
        placeholder="https://www.facebook.com/reel/..."
      />
      <small class="cc-note">${escapeHtml(t("DOM 模式必须填写真实视频页 URL；系统会用本机 Chrome 登录态打开页面。", "DOM mode requires a real video URL; the system opens it with local Chrome login state."))}</small>
    </label>`;
}

function renderRunLimits(viewModel: CommanderConsoleViewModel, t: Localize): string {
  return `<div class="cc-launch-limit-grid">
      <label class="cc-field cc-launch-limit-field">
        <span>${escapeHtml(t("最多处理轮次", "Max Rounds"))}</span>
        <input id="cc-max-rounds" name="maxRounds" type="number" min="1" value="${escapeHtml(String(viewModel.commandDraft.maxRounds))}" />
      </label>
      <label class="cc-field cc-launch-limit-field">
        <span>${escapeHtml(t("运行时长", "Max Minutes"))}</span>
        <input id="cc-max-minutes" name="maxMinutes" type="number" min="1" value="${escapeHtml(String(viewModel.commandDraft.maxMinutes))}" />
      </label>
      <p class="cc-note cc-span-2" data-app-run-limit-default-note>${escapeHtml(t("默认值来自设置页；这里可按本次任务覆盖。", "Defaults come from Settings; you can override them for this mission."))}</p>
    </div>`;
}

function renderActionDock(launchLocked: boolean, t: Localize): string {
  return `<div class="cc-start-action-dock">
      <button type="submit" class="cc-button cc-button-primary cc-button-large"${launchLocked ? ' disabled="disabled"' : ""}>${escapeHtml(t("启动任务", "Start Mission"))}</button>
      <div class="cc-inline-actions">
        <button type="button" class="cc-button cc-button-tight" data-nav-page="mission">${escapeHtml(t("查看运行页", "Open Mission"))}</button>
        <button type="button" class="cc-button cc-button-tight cc-button-danger" data-command-action="emergency-stop">${escapeHtml(t("急停", "Emergency"))}</button>
      </div>
    </div>`;
}

export function renderVisualMissionPromptLauncher(viewModel: CommanderConsoleViewModel, launchLocked = false): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return `<section class="cc-start-console cc-visual-mission-launcher" data-home-launcher>
      <div class="cc-start-library">
        <div class="cc-start-library-header">
          <div class="cc-section-copy">
            <p class="cc-section-title">${escapeHtml(t("任务启动入口", "Mission Launcher"))}</p>
            <p class="cc-note">${escapeHtml(t("用户写目标，系统按模式走纯视觉或 DOM 种草视频链路。", "Write the goal; the system follows Pure Visual or DOM product-video mode."))}</p>
          </div>
          ${renderStatusPill(launchLocked ? t("运行中", "Busy") : t("可启动", "Ready"), launchLocked ? "attention" : "ok")}
        </div>
        ${renderMissionModeSelector(t)}
        ${renderRequirementField(viewModel, t)}
        ${renderProductVideoDomField(t)}
        ${renderPlatformSelector(viewModel, t)}
        ${renderRunLimits(viewModel, t)}
      </div>
      <aside class="cc-start-inspector" aria-label="${escapeHtml(t("需求历史与启动", "Requirement History and Launch"))}">
        <div class="cc-start-inspector-header">
          <p class="cc-section-title">${escapeHtml(t("最近需求", "Recent Requirements"))}</p>
          <span class="cc-template-count">${escapeHtml(t(`${viewModel.userRequirementHistory.length} 条`, `${viewModel.userRequirementHistory.length} entries`))}</span>
        </div>
        <input type="hidden" name="historyEntryId" value="${escapeHtml(viewModel.commandDraft.historyEntryId ?? "")}" data-selected-history-entry-id />
        ${renderHistoryList(viewModel, t)}
        <div class="cc-selected-task">
          <h3>${escapeHtml(t("启动边界", "Launch Boundary"))}</h3>
          <p>${escapeHtml(t("启动页只收集目标、平台和运行限制，不暴露任何退役地图字段。", "The start page collects goal, platforms, and run limits only. It does not expose any retired map fields."))}</p>
        </div>
        ${renderActionDock(launchLocked, t)}
      </aside>
    </section>`;
}
