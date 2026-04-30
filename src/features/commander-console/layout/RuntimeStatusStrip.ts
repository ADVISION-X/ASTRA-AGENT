import { localizeCommanderText } from "../locale.js";
import { escapeHtml } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { formatElapsed, formatRuntimeState, getActiveTaskTemplate } from "../view-helpers.js";

export function renderRuntimeStatusStrip(viewModel: CommanderConsoleViewModel, label: string, hint: string): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const taskTemplate = getActiveTaskTemplate(viewModel);

  return `<footer class="cc-runtime-strip">
    <div class="cc-runtime-strip-copy">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(hint)}</span>
    </div>
    <div class="cc-runtime-strip-items">
      <span>${escapeHtml(t("状态", "State"))}: ${escapeHtml(formatRuntimeState(viewModel))}</span>
      <span>${escapeHtml(t("任务", "Task"))}: ${escapeHtml(taskTemplate?.displayName ?? t("未选择", "Unselected"))}</span>
      <span>${escapeHtml(t("运行时长", "Elapsed"))}: ${escapeHtml(formatElapsed(viewModel))}</span>
    </div>
  </footer>`;
}