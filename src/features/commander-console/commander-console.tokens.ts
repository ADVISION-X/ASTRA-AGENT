export const commanderConsoleTokens = {
  font: {
    ui: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", sans-serif',
    display: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", sans-serif',
    mono: '"JetBrains Mono", "SFMono-Regular", ui-monospace, monospace',
  },
  text: {
    xs: "11px",
    sm: "12px",
    md: "14px",
    lg: "16px",
    xl: "20px",
    xxl: "24px",
  },
  lineHeight: {
    xs: "1.25",
    sm: "1.35",
    md: "1.45",
    lg: "1.55",
  },
  space: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
  },
  layout: {
    toolbarHeight: "56px",
    titlebarHeight: "34px",
    statusStripHeight: "34px",
    sidebarWidth: "208px",
    inspectorWidth: "356px",
    shellMaxWidth: "1320px",
    shellMaxHeight: "920px",
    shellMinWidth: "900px",
    shellMinHeight: "675px",
    pageMaxWidth: "1080px",
    buttonHeight: "36px",
    inputHeight: "38px",
    rowHeight: "34px",
    cardPadding: "16px",
    cardGap: "14px",
    radius: "16px",
    radiusLarge: "22px",
  },
} as const;

export function renderCommanderTokenCss(): string {
  return `
:root {
  --cc-font-ui: ${commanderConsoleTokens.font.ui};
  --cc-font-display: ${commanderConsoleTokens.font.display};
  --cc-font-mono: ${commanderConsoleTokens.font.mono};
  --cc-text-xs: ${commanderConsoleTokens.text.xs};
  --cc-text-sm: ${commanderConsoleTokens.text.sm};
  --cc-text-md: ${commanderConsoleTokens.text.md};
  --cc-text-lg: ${commanderConsoleTokens.text.lg};
  --cc-text-xl: ${commanderConsoleTokens.text.xl};
  --cc-text-2xl: ${commanderConsoleTokens.text.xxl};
  --cc-line-xs: ${commanderConsoleTokens.lineHeight.xs};
  --cc-line-sm: ${commanderConsoleTokens.lineHeight.sm};
  --cc-line-md: ${commanderConsoleTokens.lineHeight.md};
  --cc-line-lg: ${commanderConsoleTokens.lineHeight.lg};
  --cc-space-1: ${commanderConsoleTokens.space[1]};
  --cc-space-2: ${commanderConsoleTokens.space[2]};
  --cc-space-3: ${commanderConsoleTokens.space[3]};
  --cc-space-4: ${commanderConsoleTokens.space[4]};
  --cc-space-5: ${commanderConsoleTokens.space[5]};
  --cc-space-6: ${commanderConsoleTokens.space[6]};
  --cc-space-8: ${commanderConsoleTokens.space[8]};
  --cc-toolbar-height: ${commanderConsoleTokens.layout.toolbarHeight};
  --cc-titlebar-height: ${commanderConsoleTokens.layout.titlebarHeight};
  --cc-status-strip-height: ${commanderConsoleTokens.layout.statusStripHeight};
  --cc-sidebar-width: ${commanderConsoleTokens.layout.sidebarWidth};
  --cc-inspector-width: ${commanderConsoleTokens.layout.inspectorWidth};
  --cc-shell-max-width: ${commanderConsoleTokens.layout.shellMaxWidth};
  --cc-shell-max-height: ${commanderConsoleTokens.layout.shellMaxHeight};
  --cc-shell-min-width: ${commanderConsoleTokens.layout.shellMinWidth};
  --cc-shell-min-height: ${commanderConsoleTokens.layout.shellMinHeight};
  --cc-page-max-width: ${commanderConsoleTokens.layout.pageMaxWidth};
  --cc-button-height: ${commanderConsoleTokens.layout.buttonHeight};
  --cc-input-height: ${commanderConsoleTokens.layout.inputHeight};
  --cc-row-height: ${commanderConsoleTokens.layout.rowHeight};
  --cc-card-padding: ${commanderConsoleTokens.layout.cardPadding};
  --cc-card-gap: ${commanderConsoleTokens.layout.cardGap};
  --cc-radius: ${commanderConsoleTokens.layout.radius};
  --cc-radius-large: ${commanderConsoleTokens.layout.radiusLarge};
}
`;
}