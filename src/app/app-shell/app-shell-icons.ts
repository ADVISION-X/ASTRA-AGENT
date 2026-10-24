const ICON_PATHS = {
  chevron: '<path d="M12 5l-5 5 5 5"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
  console: '<rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/><path d="M2.5 12.5h15"/>',
  eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.4"/>',
  inspector: '<rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/><path d="M12.5 3.5v13"/>',
  refresh: '<path d="M16.2 10a6.2 6.2 0 1 1-1.9-4.5"/><path d="M16.2 3.8v3.4H12.8"/>',
  sidebar: '<rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/><path d="M7.5 3.5v13"/>',
  terminal: '<path d="M4 6l4 4-4 4"/><path d="M10.5 14.5H16"/>',
} as const;

export type AppShellIconName = keyof typeof ICON_PATHS;

export const renderAppShellIcon = (name: AppShellIconName): string =>
  `<svg class="icon icon-${name}" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
