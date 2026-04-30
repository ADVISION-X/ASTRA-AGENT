# Map Plugin Orchestration Integration Scorecard

Target state: MAP_PLUGIN_ORCHESTRATION_INTEGRATION_READY_TO_ESTABLISH

| Dimension | Score | Note |
| -- | -- | -- |
| Schema Ownership | 97 | operational-map and platform-id package schemas now live under map-plugins and Orchestration consumes them. |
| Active Map Binding | 96 | map selection resolves only active approved records through mapId, taskTemplateId, or activationId. |
| Commander Ordinary Feed | 96 | ordinary task templates start from taskTemplateId while internal bindings stay developer-only. |
| Runtime Proof Metadata | 95 | proof carries taskTemplateId, activationId, packageId, packageVersion, and mapVersion. |
| Legacy Static Map Removal | 97 | retired static TS map modules were removed from active source truth. |
| Enforcement Coverage | 96 | dedicated integration inspector covers required shape, forbidden shape, boundary attack, anti-escape, and negative proof. |

Ready decision: PASS