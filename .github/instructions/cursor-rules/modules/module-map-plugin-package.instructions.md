---
name: "GrassEye Retired Map Plugin Package"
description: "Retired tombstone. Map packages, task templates, route plans, and route labels are no longer active governance routes."
applyTo: ".github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md"
---

# GrassEye Retired Map Plugin Package

status: retired

authority: this file is a tombstone only. It must never act as an active owner or routing target.

Retirement verdict:
- Map plugin package is retired.
- src/map-plugins and scripts/audit/domains/map-plugin-package are retired paths.
- taskTemplateId, selectedMapId, routePlanId, routeLabel, map authoring, map activation, and activation snapshot are not valid production startup owners.

Route all new work by direct active owner:
- APP start surfaces, user requirement entry, run limits, and history reuse -> commander-console-capability
- Platform metadata, entry URLs, allowed hosts, and target titles -> open-capability until a dedicated PlatformRegistry law exists
- AI prompt contracts and action-plan output schemas -> ai-capability
- actionCode catalogs, composite expansion, and scheduler binding -> capability-group-governance plus the direct runtime owner
- mission flow and action dispatch -> orchestration-capability
- physical cleanup, anti-regression scans, and retired residue detection -> code-purity

FORBIDDEN:
- Reactivating this module as an active law.
- Routing new work here from the index.
- Restoring map packages, task templates, route plans, route labels, or map authoring as production truths.
