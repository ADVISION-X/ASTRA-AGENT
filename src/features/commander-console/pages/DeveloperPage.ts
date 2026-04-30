import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderCard, renderJsonBlock } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { getActiveTaskTemplate } from "../view-helpers.js";
import { renderPageHeader } from "../layout/PageHeader.js";

export function renderDeveloperPage(viewModel: CommanderConsoleViewModel, _appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const latestInspect = viewModel.inspectItems[0] ?? null;
  const activeTemplate = getActiveTaskTemplate(viewModel);
  const developerRefs = {
    selectedMapId: activeTemplate?.developerBinding?.mapId ?? null,
    requestedPlatformId: activeTemplate?.developerBinding?.requestedPlatformId ?? null,
    targetProfileRef: viewModel.commandDraft.targetProfileRef,
    mapId: activeTemplate?.developerBinding?.mapId ?? null,
    stepId: viewModel.rawSnapshot.runtime.currentStep,
    abilityGroupId: null,
    childCapabilityId: null,
    proofRef: latestInspect?.id ?? null,
    runtimeProof: viewModel.runtimeProofTimeline[0] ?? null,
    prompt: null,
    rawResponse: null,
    debugJson: latestInspect?.json ?? null,
  };

  return `<section class="cc-page" data-app-page="developer" data-developer-page>
    ${renderPageHeader(t("开发者", "Developer"), t("只有显式打开开发者模式后，这些字段才允许出现。", "These fields appear only after developer mode is explicitly opened."))}
    <div class="cc-page-stack">
      ${renderCard(t("内部引用", "Developer References"), t("Developer Only", "Developer Only"), `<div class="cc-developer-grid">${Object.entries(developerRefs).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value === null ? t("未提供", "Not surfaced") : typeof value === "string" ? value : JSON.stringify(value))}</strong></div>`).join("")}</div>`)}
      ${renderCard(t("调试 JSON", "Debug JSON"), t("Developer Only", "Developer Only"), renderJsonBlock(developerRefs))}
    </div>
  </section>`;
}