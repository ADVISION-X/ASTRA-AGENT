import { skillRegistry } from "./skill-registry.js";

const renderStatusDot = (status: string): string => `<span class="sidebar-status-dot status-${status}" aria-hidden="true"></span>`;

export const renderSidebar = (): string => `
<aside class="sidebar" data-app-shell-sidebar data-job-flow-list>
  <div class="sidebar-header">
    <span>Skill Registry</span>
    <button class="icon-button" type="button" data-sidebar-toggle aria-label="Collapse sidebar" title="Collapse sidebar">‹</button>
  </div>
  <nav class="skill-list" data-skill-registry>
    ${skillRegistry.map((skill, index) => `
      <button
        class="skill-nav-item"
        type="button"
        data-skill-id="${skill.id}"
        data-job-card="${skill.id}"
        data-skill-status="${skill.status}"
        aria-pressed="${index === 0 ? "true" : "false"}"
      >
        ${renderStatusDot(skill.status)}
        <span class="skill-nav-copy">
          <strong>${skill.label}</strong>
          <small>${skill.description}</small>
        </span>
      </button>
    `).join("")}
  </nav>
</aside>`;
