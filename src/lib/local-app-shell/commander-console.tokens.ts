const fontTokens = {
  ui: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", sans-serif',
  display: 'system-ui, -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", sans-serif',
  mono: '"JetBrains Mono", "SFMono-Regular", ui-monospace, monospace',
} as const;

const textTokens = {
  xs: "11px",
  sm: "12px",
  md: "14px",
  lg: "16px",
  xl: "20px",
  xxl: "24px",
} as const;

const lineHeightTokens = {
  xs: "1.25",
  sm: "1.35",
  md: "1.45",
  lg: "1.55",
} as const;

const spaceTokens = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
} as const;

const layoutTokens = {
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
} as const;

const renderFontTokenCss = () => `
  --cc-font-ui: ${fontTokens.ui};
  --cc-font-display: ${fontTokens.display};
  --cc-font-mono: ${fontTokens.mono};`;

const renderTextTokenCss = () => `
  --cc-text-xs: ${textTokens.xs};
  --cc-text-sm: ${textTokens.sm};
  --cc-text-md: ${textTokens.md};
  --cc-text-lg: ${textTokens.lg};
  --cc-text-xl: ${textTokens.xl};
  --cc-text-2xl: ${textTokens.xxl};
  --cc-line-xs: ${lineHeightTokens.xs};
  --cc-line-sm: ${lineHeightTokens.sm};
  --cc-line-md: ${lineHeightTokens.md};
  --cc-line-lg: ${lineHeightTokens.lg};`;

const renderSpaceTokenCss = () => `
  --cc-space-1: ${spaceTokens[1]};
  --cc-space-2: ${spaceTokens[2]};
  --cc-space-3: ${spaceTokens[3]};
  --cc-space-4: ${spaceTokens[4]};
  --cc-space-5: ${spaceTokens[5]};
  --cc-space-6: ${spaceTokens[6]};
  --cc-space-8: ${spaceTokens[8]};`;

const renderLayoutTokenCss = () => `
  --cc-toolbar-height: ${layoutTokens.toolbarHeight};
  --cc-titlebar-height: ${layoutTokens.titlebarHeight};
  --cc-status-strip-height: ${layoutTokens.statusStripHeight};
  --cc-sidebar-width: ${layoutTokens.sidebarWidth};
  --cc-inspector-width: ${layoutTokens.inspectorWidth};
  --cc-shell-max-width: ${layoutTokens.shellMaxWidth};
  --cc-shell-max-height: ${layoutTokens.shellMaxHeight};
  --cc-shell-min-width: ${layoutTokens.shellMinWidth};
  --cc-shell-min-height: ${layoutTokens.shellMinHeight};
  --cc-page-max-width: ${layoutTokens.pageMaxWidth};
  --cc-button-height: ${layoutTokens.buttonHeight};
  --cc-input-height: ${layoutTokens.inputHeight};
  --cc-row-height: ${layoutTokens.rowHeight};
  --cc-card-padding: ${layoutTokens.cardPadding};
  --cc-card-gap: ${layoutTokens.cardGap};
  --cc-radius: ${layoutTokens.radius};
  --cc-radius-large: ${layoutTokens.radiusLarge};`;

export function renderCommanderTokenCss(): string {
  return `
:root {
${renderFontTokenCss()}
${renderTextTokenCss()}
${renderSpaceTokenCss()}
${renderLayoutTokenCss()}
}
`;
}